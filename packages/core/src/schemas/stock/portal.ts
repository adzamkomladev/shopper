import * as v from "valibot";
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
