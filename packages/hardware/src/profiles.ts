import type { PaperMm, PrinterModel, PrinterProfile } from "./types";

/** 203 dpi: `dots` is the printable width in dots, `mm` the printable width, `cols` font A columns. */
export const paper: Record<PaperMm, { dots: number; mm: number; cols: number }> = {
  80: { dots: 576, mm: 72, cols: 48 },
  58: { dots: 384, mm: 48, cols: 32 },
};

const drawer = { pin: 0, on: 25, off: 250 } as const;

export const printerProfiles: Record<PrinterModel, PrinterProfile> = {
  epson: { nativeQr: true, cut: "gs", drawer },
  xprinter: { nativeQr: false, cut: "gs", drawer },
  bixolon: { nativeQr: true, cut: "esc-i", drawer },
};
