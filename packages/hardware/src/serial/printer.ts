import { PrinterOffline } from "../network";
import type { ReceiptPrinter } from "../types";
import type { SerialOptions } from "../types";
import { writeOnce } from "./port";

/** Only open/write/drain failures are offline; once drained the job is done, so a retry never double prints. */
export function serialPrinter(options: SerialOptions): ReceiptPrinter {
  return {
    print: (bytes) =>
      writeOnce(options, bytes).catch((cause: unknown) => {
        throw new PrinterOffline(cause);
      }),
  };
}
