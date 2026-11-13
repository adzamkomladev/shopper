import type { ZipEntry } from "./types";

// A stored (uncompressed) ZIP, so the owner can open a `.shopper` file with any unzip tool and the sizes and CRCs
// are known before the first byte is written. shortcut: no ZIP64, so under 4 GB and 65,535 files, upgrade when a
// business reaches either.
const encoder = new TextEncoder();
const MAX = 0xffffffff;

const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** The exact size of the ZIP `zipStream` will produce, for `Content-Length`; throws when it cannot be a plain ZIP. */
export function zipLength(entries: ZipEntry[]) {
  const names = entries.map((entry) => encoder.encode(entry.path).length);
  const length = entries.reduce(
    (sum, entry, i) => sum + 30 + names[i]! + entry.bytes + 46 + names[i]!,
    22,
  );
  if (entries.length > 0xffff || length > MAX)
    throw new Error("This business is too large for one archive file yet (4 GB or 65,535 files).");
  return length;
}

/** The ZIP as a stream that holds one file in memory at a time. */
export function zipStream(entries: ZipEntry[]) {
  zipLength(entries);
  const offsets: number[] = [];
  let offset = 0;
  let next = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (next === entries.length) {
        controller.enqueue(directory(entries, offsets, offset));
        return controller.close();
      }
      const entry = entries[next++]!;
      const data = await entry.read();
      if (data.length !== entry.bytes)
        throw new Error(`${entry.path} changed size while the archive was being written`);
      const header = record(30, 0x04034b50, entry);
      offsets.push(offset);
      offset += header.length + data.length;
      controller.enqueue(header);
      controller.enqueue(data);
    },
  });
}

export async function zipBytes(entries: ZipEntry[]) {
  return new Uint8Array(await new Response(zipStream(entries)).arrayBuffer());
}

/** Every file of a stored ZIP by path. CRCs are not checked here: the manifest's SHA-256 is the authority. */
export function readZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, Uint8Array>();
  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("Not a ZIP file");
  let at = view.getUint32(end + 16, true);
  for (let i = 0; i < view.getUint16(end + 10, true); i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("Not a ZIP file");
    if (view.getUint16(at + 10, true) !== 0) throw new Error("Only stored ZIP files are read");
    const size = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const rest = view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    if (start + size > bytes.length) throw new Error("Not a ZIP file");
    files.set(
      new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)),
      bytes.subarray(start, start + size),
    );
    at += 46 + nameLength + rest;
  }
  return files;
}

/** A local file header (`size` 30) or central directory record (46): the two share most of their fields. */
function record(size: 30 | 46, signature: number, entry: ZipEntry, offset = 0) {
  const name = encoder.encode(entry.path);
  const out = new Uint8Array(size + name.length);
  const view = new DataView(out.buffer);
  const central = size === 46;
  view.setUint32(0, signature, true);
  if (central) view.setUint16(4, 20, true);
  const o = central ? 2 : 0;
  view.setUint16(4 + o, 20, true); // version needed
  view.setUint16(6 + o, 0x0800, true); // UTF-8 names
  view.setUint16(8 + o, 0, true); // stored
  view.setUint16(10 + o, 0, true); // time
  view.setUint16(12 + o, 0x21, true); // date: 1980-01-01, so the same bytes make the same file
  view.setUint32(14 + o, entry.crc, true);
  view.setUint32(18 + o, entry.bytes, true);
  view.setUint32(22 + o, entry.bytes, true);
  view.setUint16(26 + o, name.length, true);
  if (central) view.setUint32(42, offset, true);
  out.set(name, size);
  return out;
}

function directory(entries: ZipEntry[], offsets: number[], start: number) {
  const records = entries.map((entry, i) => record(46, 0x02014b50, entry, offsets[i]));
  const size = records.reduce((sum, r) => sum + r.length, 0);
  const out = new Uint8Array(size + 22);
  let at = 0;
  for (const r of records) {
    out.set(r, at);
    at += r.length;
  }
  const view = new DataView(out.buffer);
  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, size, true);
  view.setUint32(at + 16, start, true);
  return out;
}
