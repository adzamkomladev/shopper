const statuses = {
  busy: 409,
  not_found: 404,
  not_ready: 409,
  running: 409,
  too_many_rows: 413,
} as const;

/** Why an archive request was refused; the API turns `code` into an HTTP status. */
export class ExportError extends Error {
  constructor(
    readonly code: "busy" | "not_found" | "not_ready" | "running" | "too_many_rows",
    message: string,
  ) {
    super(message);
  }

  get status() {
    return statuses[this.code];
  }
}
