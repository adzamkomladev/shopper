import * as v from "valibot";
import { adjustmentCauses } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { text } from "../fields";
import { lines, quantity } from "./document";

const id = v.pipe(
  uuidV7Schema,
  v.transform((value) => value.toLowerCase()),
);

/** A goods received note keyed by the client's UUIDv7: a retried submit replays instead of doubling stock. */
export const receiptInput = v.strictObject({
  id,
  branchId: id,
  supplierId: id,
  reference: v.optional(text(200)),
  lines: lines({ quantityThousandths: quantity(1), unitCost: quantity(0) }),
});
export type ReceiptInput = v.InferOutput<typeof receiptInput>;

/** Wastage and corrections: lines carry a positive quantity and the cause (with `direction` for "other") gives the sign. */
export const adjustmentInput = v.strictObject({
  id,
  branchId: id,
  cause: v.picklist(adjustmentCauses),
  direction: v.optional(v.picklist(["add", "remove"])),
  lines: lines({ quantityThousandths: quantity(1) }),
});
export type AdjustmentInput = v.InferOutput<typeof adjustmentInput>;
