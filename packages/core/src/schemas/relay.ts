import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { name, text } from "./fields";

/** The most rows one publish batch carries; the Publisher splits larger catalogues (Day 47). */
const BATCH_ROWS = 500;

/**
 * What a box may publish to its relay org: an allowlist of fields (strict objects), so a cost price, supplier or
 * anything else the shop keeps private is refused, never stored. Parents come before their children.
 */
export const relayBatch = v.strictObject({
  categories: v.optional(
    v.pipe(
      v.array(v.strictObject({ id: uuidV7Schema, name, parentId: v.nullable(uuidV7Schema) })),
      v.maxLength(BATCH_ROWS),
    ),
    [],
  ),
  products: v.optional(
    v.pipe(
      v.array(
        v.strictObject({
          id: uuidV7Schema,
          sku: text(64),
          name,
          categoryId: v.nullable(uuidV7Schema),
          taxClass: v.picklist(["standard", "zero-rated", "exempt"]),
          baseUnit: v.picklist(["each", "kg", "g", "l", "ml"]),
          onlineVisible: v.boolean(),
        }),
      ),
      v.maxLength(BATCH_ROWS),
    ),
    [],
  ),
});
export type RelayBatch = v.InferOutput<typeof relayBatch>;
