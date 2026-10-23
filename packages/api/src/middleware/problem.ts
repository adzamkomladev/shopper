import * as v from "valibot";
import type { Context } from "hono";
import { AssetError } from "@shopper/assets";
import { AdministrationError } from "@shopper/auth";
import { KycError } from "@shopper/auth/kyc";
import { ManagementError } from "@shopper/core/management";
import { CustomerError } from "@shopper/core/customers";
import { StockError } from "@shopper/core/stock";

const customerStatus = { NOT_FOUND: 404 } as const;
const kycStatus = {
  NOT_FOUND: 404,
  OTP_INVALID: 400,
  OTP_LOCKED: 429,
  ID_NOT_ACCEPTED: 400,
  ID_NOT_SIGHTED: 400,
  LIMIT_REQUIRED: 400,
  UNAVAILABLE: 503,
} as const;
const stockStatus = { NOT_FOUND: 404, INVALID_REFERENCE: 400, INVALID_SIGN: 400 } as const;

// Unique constraints the catalogue exposes, as the body field they belong to.
const uniqueField = (constraint?: string) => {
  if (constraint?.includes("barcode")) return "barcodes";
  if (constraint?.includes("sku")) return "sku";
  return undefined;
};

/** Maps validation, management and constraint errors to a problem body; `field` names the culprit. */
export function problem(error: Error, c: Context): Response {
  if (v.isValiError(error)) {
    const [issue] = error.issues;
    const field = v.getDotPath(issue) ?? undefined;
    return c.json({ error: "Invalid request data", detail: issue.message, field }, 400);
  }
  if (error instanceof AssetError) return c.json({ error: error.message }, error.status);
  if (error instanceof ManagementError) return c.json({ error: error.message }, error.status);
  // The code lets a client tell the conflicts apart (TAKE_OPEN from NOT_COUNTED, say) without reading the words.
  if (error instanceof StockError)
    return c.json(
      { error: error.message, code: error.code },
      stockStatus[error.code as keyof typeof stockStatus] ?? 409,
    );
  if (error instanceof AdministrationError) return c.json({ error: error.message }, error.status);
  if (error instanceof KycError)
    return c.json(
      { error: error.message, code: error.code },
      kycStatus[error.code as keyof typeof kycStatus] ?? 409,
    );
  if (error instanceof CustomerError)
    return c.json(
      { error: error.message, code: error.code, ...error.detail },
      customerStatus[error.code as keyof typeof customerStatus] ?? 409,
    );
  const pg = error as {
    code?: string;
    constraint?: string;
    cause?: { code?: string; constraint?: string };
  };
  const code = pg.code ?? pg.cause?.code;
  if (code === "23505")
    return c.json(
      { error: "Already exists", field: uniqueField(pg.constraint ?? pg.cause?.constraint) },
      409,
    );
  if (code === "23503")
    return c.json({ error: "Referenced record does not exist or is in use" }, 409);
  throw error;
}
