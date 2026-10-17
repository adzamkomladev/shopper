/** Nothing reached the printer (cannot open, cannot start): safe to retry. */
export class PrinterOffline extends Error {
  constructor(cause: unknown) {
    super("Printer is offline", { cause });
    this.name = "PrinterOffline";
  }
}

/** Bytes were handed over but completion is unknown (write fault, timeout): a retry may print twice. */
export class PrinterUncertain extends Error {
  constructor(cause: unknown) {
    super("Printer may have printed part of this job", { cause });
    this.name = "PrinterUncertain";
  }
}
