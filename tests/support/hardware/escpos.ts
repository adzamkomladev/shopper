export type Command =
  | { name: "init" }
  | { name: "bold"; on: boolean }
  | { name: "align"; value: "left" | "center" | "right" }
  | { name: "size"; width: number; height: number }
  | { name: "feed"; lines: number }
  | { name: "qrConfig"; fn: number }
  | { name: "qrStore"; payload: string }
  | { name: "qrPrint" }
  | { name: "raster"; widthBytes: number; height: number }
  | { name: "drawer"; pin: number; on: number; off: number }
  | { name: "cut"; kind: "gs" | "esc-i" };

const ALIGN = ["left", "center", "right"] as const;

/** Walks the bytes exactly as a printer would; unknown commands throw so drift is loud. */
export function decodeEscPos(bytes: Uint8Array): { text: string[]; commands: Command[] } {
  const text: string[] = [];
  const commands: Command[] = [];
  let line = "";
  let i = 0;
  const at = (offset: number) => {
    const byte = bytes[offset];
    if (byte === undefined) throw new Error(`Truncated ESC/POS command at byte ${offset}`);
    return byte;
  };
  const flush = () => {
    text.push(line);
    line = "";
  };
  while (i < bytes.length) {
    const byte = at(i);
    if (byte === 0x0a) {
      flush();
      i += 1;
    } else if (byte === 0x1b) {
      i = escape(at(i + 1), i);
    } else if (byte === 0x1d) {
      i = group(at(i + 1), i);
    } else {
      line += String.fromCharCode(byte);
      i += 1;
    }
  }
  if (line) flush();
  return { text, commands };

  function escape(code: number, start: number): number {
    if (code === 0x40) commands.push({ name: "init" });
    else if (code === 0x45) commands.push({ name: "bold", on: (at(start + 2) & 1) === 1 });
    else if (code === 0x61)
      commands.push({ name: "align", value: ALIGN[at(start + 2) & 3] ?? "left" });
    else if (code === 0x64) commands.push({ name: "feed", lines: at(start + 2) });
    else if (code === 0x69) {
      commands.push({ name: "cut", kind: "esc-i" });
      return start + 2;
    } else if (code === 0x70) {
      commands.push({
        name: "drawer",
        pin: at(start + 2),
        on: at(start + 3),
        off: at(start + 4),
      });
      return start + 5;
    } else throw new Error(`Unknown ESC 0x${code.toString(16)} at byte ${start}`);
    return start + (code === 0x40 ? 2 : 3);
  }

  function group(code: number, start: number): number {
    if (code === 0x21) {
      const n = at(start + 2);
      commands.push({ name: "size", width: (n >> 4) + 1, height: (n & 15) + 1 });
      return start + 3;
    }
    if (code === 0x56) {
      const mode = at(start + 2);
      commands.push({ name: "cut", kind: "gs" });
      return start + (mode === 65 || mode === 66 ? 4 : 3);
    }
    if (code === 0x76) return raster(start);
    if (code === 0x28 && at(start + 2) === 0x6b) return qr(start);
    throw new Error(`Unknown GS 0x${code.toString(16)} at byte ${start}`);
  }

  function raster(start: number): number {
    if (at(start + 2) !== 0x30) throw new Error(`Expected GS v 0 at byte ${start}`);
    const widthBytes = at(start + 4) + at(start + 5) * 256;
    const height = at(start + 6) + at(start + 7) * 256;
    commands.push({ name: "raster", widthBytes, height });
    const end = start + 8 + widthBytes * height;
    if (end > bytes.length) throw new Error(`Truncated raster at byte ${start}`);
    return end;
  }

  function qr(start: number): number {
    const length = at(start + 3) + at(start + 4) * 256;
    const fn = at(start + 6);
    const end = start + 5 + length;
    if (end > bytes.length) throw new Error(`Truncated GS ( k at byte ${start}`);
    if (fn === 80) {
      const payload = String.fromCharCode(...bytes.subarray(start + 8, end));
      commands.push({ name: "qrStore", payload });
    } else if (fn === 81) commands.push({ name: "qrPrint" });
    else commands.push({ name: "qrConfig", fn });
    return end;
  }
}
