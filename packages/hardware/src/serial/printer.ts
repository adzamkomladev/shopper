import type { ReceiptPrinter, SerialOptions } from "../types";
import { writeOnce } from "./port";

export function serialPrinter(options: SerialOptions): ReceiptPrinter {
  return { print: (bytes) => writeOnce(options, bytes) };
}
