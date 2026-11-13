/** Why an archive request was refused; the API turns `code` into an HTTP status. */
export class ExportError extends Error {
  constructor(
    readonly code: "busy" | "not_found" | "not_ready" | "running",
    message: string,
  ) {
    super(message);
  }
}
