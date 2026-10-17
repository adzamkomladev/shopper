import { paper } from "../profiles";
import { qrMatrix } from "../qr";
import type { PaperMm, PrinterProfile } from "../types";

const QR_SCALE = 6;
const bytesOf = new TextEncoder();

/** Printable ASCII only: strips accents, maps the cedi sign and replaces anything else (incl. control bytes) with `?`. */
export function ascii(value: string) {
  return value
    .replaceAll("₵", "GHS")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\x20-\x7e]/gu, "?");
}

/** Chainable ESC/POS byte builder. Every string is passed through `ascii`, so data can never inject commands. */
export function escpos(profile: PrinterProfile, paperMm: PaperMm = 80) {
  const out: number[] = [];
  const push = (...bytes: number[]) => {
    out.push(...bytes);
    return api;
  };
  const pushAll = (data: Uint8Array) => {
    for (const byte of data) out.push(byte);
    return api;
  };
  const api = {
    init: () => push(0x1b, 0x40),
    text(value: string) {
      pushAll(bytesOf.encode(ascii(value)));
      return push(0x0a);
    },
    bold: (on: boolean) => push(0x1b, 0x45, on ? 1 : 0),
    align: (value: "left" | "center" | "right") =>
      push(0x1b, 0x61, { left: 0, center: 1, right: 2 }[value]),
    size: (width: number, height: number) => push(0x1d, 0x21, ((width - 1) << 4) | (height - 1)),
    feed: (lines: number) => push(0x1b, 0x64, lines),
    raster(data: Uint8Array, widthBytes: number, height: number) {
      push(0x1d, 0x76, 0x30, 0, widthBytes & 255, widthBytes >> 8, height & 255, height >> 8);
      return pushAll(data);
    },
    qr(payload: string) {
      if (!profile.nativeQr) return api.raster(...qrBitmap(payload, paper[paperMm].dots / 8));
      const gsk = (...body: number[]) => {
        push(0x1d, 0x28, 0x6b, body.length & 255, body.length >> 8);
        return push(...body);
      };
      gsk(0x31, 0x41, 0x32, 0x00); // model 2
      gsk(0x31, 0x43, QR_SCALE); // module size
      gsk(0x31, 0x45, 0x31); // error correction M
      gsk(0x31, 0x50, 0x30, ...bytesOf.encode(ascii(payload)));
      return gsk(0x31, 0x51, 0x30);
    },
    drawer: () => push(0x1b, 0x70, profile.drawer.pin, profile.drawer.on, profile.drawer.off),
    cut() {
      api.feed(3);
      return profile.cut === "gs" ? push(0x1d, 0x56, 66, 0) : push(0x1b, 0x69);
    },
    bytes: () => Uint8Array.from(out),
  };
  return api;
}

/** QR bitmap centred in a row `widthBytes` wide; returns the `raster` arguments. */
function qrBitmap(payload: string, widthBytes: number): [Uint8Array, number, number] {
  const matrix = qrMatrix(payload);
  // Shrink modules to fit the paper; a QR wider than one dot per module cannot print.
  const scale = Math.min(QR_SCALE, Math.floor((widthBytes * 8) / matrix.length));
  if (scale < 1) throw new RangeError(`QR payload too large for ${widthBytes * 8} dots`);
  const side = matrix.length * scale;
  const left = Math.floor((widthBytes * 8 - side) / 2);
  const data = new Uint8Array(widthBytes * side);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++)
      if (matrix[Math.floor(y / scale)]?.[Math.floor(x / scale)]) {
        const dot = left + x;
        data[y * widthBytes + (dot >> 3)]! |= 0x80 >> (dot & 7);
      }
  return [data, widthBytes, side];
}
