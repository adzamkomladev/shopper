import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { stockTakeStatuses } from "@shopper/db-pg";
import { listQuery } from "../catalogue/inputs";
import { quantity } from "./document";
import { tillId } from "../till/fields";

const id = uuidV7Schema;

/** A take is the whole branch or one category; the client's UUIDv7 makes a retried start a replay. */
export const takeStart = v.pipe(
  v.strictObject({
    id: tillId,
    branchId: tillId,
    scope: v.picklist(["full", "category"]),
    categoryId: v.optional(tillId),
  }),
  v.check(
    (take) => (take.scope === "category") === (take.categoryId !== undefined),
    "A category take names its category; a full take does not",
  ),
);
export type TakeStart = v.InferOutput<typeof takeStart>;

export const takeCounts = v.object({
  lines: v.pipe(
    v.array(v.strictObject({ productId: tillId, countedThousandths: quantity(0) })),
    v.minLength(1),
    v.maxLength(500),
    v.check(
      (rows) => new Set(rows.map((row) => row.productId)).size === rows.length,
      "A product is counted once per request",
    ),
  ),
});
export type TakeCounts = v.InferOutput<typeof takeCounts>;

export const takesQuery = v.object({
  branchId: v.optional(id),
  status: v.optional(v.picklist(stockTakeStatuses)),
  cursor: v.optional(id),
  limit: listQuery.entries.limit,
});
