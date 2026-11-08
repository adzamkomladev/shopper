/** The SDC could not be reached or failed on its side; the document stays pending and is retried. */
export class SdcUnavailable extends Error {
  readonly name = "SdcUnavailable";
  /** True when the SDC answered (a 5xx or an unreadable reply); false when it could not be reached at all. */
  readonly reached: boolean;
  constructor(message: string, options?: ErrorOptions & { reached?: boolean }) {
    super(message, options);
    this.reached = options?.reached ?? false;
  }
}
