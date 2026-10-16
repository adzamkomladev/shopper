import { describe, expect, test } from "vite-plus/test";
import { toDecimal, type Money } from "@shopper/money";
import { encodeReceipt, paper, printerProfiles, qrMatrix } from "@shopper/hardware";
import { decodeEscPos } from "../../../support/hardware/escpos";
import { goldenReceipt } from "../../../support/hardware/receipt";

const receipt = goldenReceipt();
const payload = `${receipt.header.receiptNumber}|${receipt.saleId}`;
const DRAWER = [0x1b, 0x70, 0x00, 0x19, 0xfa];

function encode(
  model: keyof typeof printerProfiles,
  options: {
    paperMm?: 58 | 80;
    reprint?: boolean;
    openDrawer?: boolean;
    doc?: typeof receipt;
  } = {},
) {
  return encodeReceipt(options.doc ?? receipt, {
    profile: printerProfiles[model],
    paperMm: options.paperMm ?? 80,
    reprint: options.reprint ?? false,
    openDrawer: options.openDrawer ?? false,
  });
}

function occurrences(bytes: Uint8Array, needle: number[]) {
  const haystack = Buffer.from(bytes);
  let count = 0;
  for (let at = haystack.indexOf(Buffer.from(needle)); at >= 0;) {
    count += 1;
    at = haystack.indexOf(Buffer.from(needle), at + 1);
  }
  return count;
}

const ghs = (amount: Money) => `GHS ${toDecimal(amount)}`;

describe("Epson 80 mm receipt", () => {
  const { text, commands } = decodeEscPos(encode("epson"));
  const all = text.join("\n");

  test("prints the header, lines, tax rows, tenders and change", () => {
    for (const expected of [
      receipt.header.org,
      "TIN",
      receipt.header.tin!,
      receipt.header.branch,
      receipt.header.receiptNumber!,
      receipt.header.cashier,
      ...receipt.lines.map((line) => line.name),
      "Net",
      "NHIL",
      "GETFund",
      "VAT",
      ghs(receipt.taxSummary.net),
      ghs(receipt.taxSummary.nhil),
      ghs(receipt.taxSummary.getfund),
      ghs(receipt.taxSummary.vat),
      ghs(receipt.total),
      ghs(receipt.change),
      "ABC123",
      "E-VAT QR pending",
    ])
      expect(all).toContain(expected);
    expect(receipt.taxSummary.nhil).toBeGreaterThan(0);
    for (const tender of receipt.tenders) expect(all).toContain(ghs(tender.amount));
    expect(all.toLowerCase()).toContain("cash");
    expect(all.toLowerCase()).toContain("card");
  });

  test("stores one native QR whose payload is receipt number and sale id", () => {
    const stored = commands.filter((command) => command.name === "qrStore");
    expect(stored).toEqual([{ name: "qrStore", payload }]);
    expect(commands.filter((command) => command.name === "qrPrint")).toHaveLength(1);
    expect(commands.some((command) => command.name === "raster")).toBe(false);
  });

  test("ends with a partial cut and keeps every line within 48 columns", () => {
    expect(paper[80].cols).toBe(48);
    expect(commands.at(-1)).toEqual({ name: "cut", kind: "gs" });
    expect(commands[0]).toEqual({ name: "init" });
    expect(Math.max(...text.map((line) => line.length))).toBeLessThanOrEqual(48);
  });
});

test("a 58 mm receipt keeps every line within 32 columns", () => {
  const { text } = decodeEscPos(encode("epson", { paperMm: 58 }));
  expect(paper[58].cols).toBe(32);
  expect(Math.max(...text.map((line) => line.length))).toBeLessThanOrEqual(32);
  expect(text.join("\n")).toContain(receipt.header.receiptNumber);
});

test("Xprinter prints the QR as a raster bitmap and never sends GS ( k", () => {
  const { commands } = decodeEscPos(encode("xprinter"));
  const rasters = commands.flatMap((command) => (command.name === "raster" ? [command] : []));
  expect(rasters.length).toBeGreaterThan(0);
  expect(qrMatrix(payload)).toEqual(qrMatrix(payload));
  for (const raster of rasters) {
    expect(raster.height).toBeGreaterThan(0);
    expect(raster.widthBytes).toBeGreaterThan(0);
    expect(raster.widthBytes * 8).toBeLessThanOrEqual(paper[80].dots);
  }
  expect(commands.some((command) => command.name === "qrStore")).toBe(false);
  expect(commands.at(-1)).toEqual({ name: "cut", kind: "gs" });
});

test("Bixolon cuts with ESC i and still uses the native QR", () => {
  const { commands } = decodeEscPos(encode("bixolon"));
  expect(commands.at(-1)).toEqual({ name: "cut", kind: "esc-i" });
  expect(commands.filter((command) => command.name === "cut")).toHaveLength(1);
  expect(commands).toContainEqual({ name: "qrStore", payload });
});

describe("cash drawer", () => {
  test("openDrawer emits the 25/250 pulse exactly once", () => {
    for (const model of ["epson", "xprinter", "bixolon"] as const) {
      const bytes = encode(model, { openDrawer: true });
      expect(occurrences(bytes, DRAWER)).toBe(1);
      const drawers = decodeEscPos(bytes).commands.filter((command) => command.name === "drawer");
      expect(drawers).toEqual([{ name: "drawer", pin: 0, on: 25, off: 250 }]);
    }
  });

  test("no drawer bytes unless asked", () => {
    const bytes = encode("epson", { openDrawer: false });
    expect(occurrences(bytes, DRAWER)).toBe(0);
    expect(decodeEscPos(bytes).commands.some((command) => command.name === "drawer")).toBe(false);
  });
});

test("a reprint is marked REPRINT and the original is not", () => {
  expect(decodeEscPos(encode("epson", { reprint: true })).text.join("\n")).toContain("REPRINT");
  expect(decodeEscPos(encode("epson")).text.join("\n")).not.toContain("REPRINT");
});

test("non-ASCII product names are transliterated so no byte above 0x7E is printed", () => {
  const doc = goldenReceipt(["Café crème ₵"]);
  for (const model of ["epson", "xprinter", "bixolon"] as const) {
    const { text } = decodeEscPos(encode(model, { doc }));
    expect(text.join("\n")).toContain("Cafe creme");
    for (const line of text)
      for (const char of line) expect(char.charCodeAt(0)).toBeLessThanOrEqual(0x7e);
  }
});

test("control bytes and accents in header fields can never reach the printer as commands", () => {
  const doc = goldenReceipt();
  doc.header.cashier = "Ama\x1bp\x00\x19\xfaÉsi";
  const bytes = encodeReceipt(doc, {
    profile: printerProfiles.epson,
    paperMm: 80,
    reprint: false,
    openDrawer: false,
  });
  const { text, commands } = decodeEscPos(bytes);
  expect(commands.some((command) => command.name === "drawer")).toBe(false);
  expect(text.some((line) => line.includes("Ama?p??uEsi"))).toBe(true);
});
