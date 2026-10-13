export class TillError extends Error {
  constructor(
    public readonly code: "scope" | "permission" | "session" | "reference" | "conflict" | "counter",
    message: string,
  ) {
    super(message);
    this.name = "TillError";
  }
}
