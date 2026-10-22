import type { KycErrorCode } from "./types";

export class KycError extends Error {
  constructor(
    readonly code: KycErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "KycError";
  }
}
