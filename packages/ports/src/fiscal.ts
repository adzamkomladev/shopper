/** The SDC could not be reached or failed on its side; the document stays pending and is retried. */
export class SdcUnavailable extends Error {
  readonly name = "SdcUnavailable";
}
