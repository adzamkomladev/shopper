import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { name, text, timestamp } from "./fields";

/** The most rows of one kind a publish batch carries; the Publisher splits larger catalogues. */
export const BATCH_ROWS = 500;

const rows = <T extends v.GenericSchema>(row: T) =>
  v.optional(v.pipe(v.array(row), v.maxLength(BATCH_ROWS)), []);

/**
 * What a box may publish to its relay org: an allowlist of fields (strict objects), so a cost price, supplier or
 * anything else the shop keeps private is refused, never stored. Parents come before their children.
 */
export const relayBatch = v.strictObject({
  stores: rows(v.strictObject({ id: uuidV7Schema, name })),
  branches: rows(v.strictObject({ id: uuidV7Schema, storeId: uuidV7Schema, name })),
  categories: rows(
    v.strictObject({
      id: uuidV7Schema,
      name,
      parentId: v.nullable(uuidV7Schema),
      onlineVisible: v.optional(v.boolean(), true),
    }),
  ),
  products: rows(
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
  prices: rows(
    v.strictObject({
      id: uuidV7Schema,
      productId: uuidV7Schema,
      branchId: v.nullable(uuidV7Schema),
      amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
      validFrom: timestamp,
      validTo: v.nullable(timestamp),
    }),
  ),
});
export type RelayBatch = v.InferOutput<typeof relayBatch>;

/** The Publisher's run: one loop per box org, its instance id the org id. */
export const relayPublisherParams = v.object({ orgId: uuidV7Schema });

/** The box's Online Orders switch, as the settings page saves it. */
export const onlineSettingsInput = v.strictObject({ onlineOrders: v.boolean() });
