export type PrinterModel = "epson" | "xprinter" | "bixolon";
export type PaperMm = 58 | 80;

export type PrinterProfile = {
  /** Native `GS ( k` QR support; otherwise the QR is printed as a `GS v 0` bitmap. */
  nativeQr: boolean;
  cut: "gs" | "esc-i";
  drawer: { pin: 0 | 1; on: number; off: number };
};

export interface ReceiptPrinter {
  print(bytes: Uint8Array): Promise<void>;
}

export interface CashDrawer {
  open(): Promise<void>;
}

export interface Scanner {
  onScan(listener: (barcode: string) => void): () => void;
}

export interface CustomerDisplay {
  show(lines: [string, string]): Promise<void>;
}

export interface Scale {
  /** Weight in thousandths of the base unit. */
  read(): Promise<number>;
}

export type EncodeOptions = {
  profile: PrinterProfile;
  paperMm: PaperMm;
  reprint: boolean;
  openDrawer: boolean;
};

export type SerialOptions = { path: string; baudRate: number };

/** What a payment slip says: who paid, how much, by what, and who took it. */
export type AccountPaymentSlip = {
  shopName: string;
  registerName: string;
  customerName: string;
  method: "cash" | "momo";
  amount: number;
  reference: string | null;
  /** Accra time, "2026-10-22 14:05". */
  at: string;
  cashierName: string;
};
