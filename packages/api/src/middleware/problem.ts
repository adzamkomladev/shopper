import * as v from "valibot";
import type { Context } from "hono";
import { ManagementError } from "@shopper/core/management";

// Unique constraints the catalogue exposes, as the body field they belong to.
const uniqueField = (constraint?: string) => {
  if (constraint?.includes("barcode")) return "barcodes";
  if (constraint?.includes("sku")) return "sku";
  return undefined;
};

/** Maps validation, management and constraint errors to a problem body; `field` names the culprit. */
export function problem(error: Error, c: Context) {
  if (v.isValiError(error)) {
    const [issue] = error.issues;
    const field = v.getDotPath(issue) ?? undefined;
    return c.json({ error: "Invalid request data", detail: issue.message, field }, 400);
  }
  if (error instanceof ManagementError) return c.json({ error: error.message }, error.status);
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
