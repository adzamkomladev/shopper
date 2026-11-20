import * as v from "valibot";
import { uuidV7Schema } from "@shopper/ports";
import { ghanaPhone, name, text, timestamp } from "./fields";
import { receiptDocument } from "./receipts/document";
import { fulfilmentFields } from "./orders/fulfilment";

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
  /** Each branch's pickup, delivery, hours and slots: what the store's checkout offers. */
  fulfilment: rows(
    v.pipe(
      v.strictObject({ id: uuidV7Schema, branchId: uuidV7Schema, ...fulfilmentFields }),
      v.check((row) => row.closes > row.opens, "Closing must be after opening"),
    ),
  ),
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
      /** The photo's digest; the box offers its bytes on `/relay/images` first. */
      image: v.optional(v.nullable(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))), null),
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
  /** Per product, what each branch can still sell online (thousandths, floored to a step by the box). */
  availability: rows(
    v.strictObject({
      id: uuidV7Schema,
      branches: v.pipe(
        v.array(
          v.strictObject({
            branchId: uuidV7Schema,
            available: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(2 ** 31 - 1)),
          }),
        ),
        v.maxLength(BATCH_ROWS),
      ),
    }),
  ),
});
export type RelayBatch = v.InferOutput<typeof relayBatch>;

/** The Publisher's run: one loop per box org, its instance id the org id. */
export const relayPublisherParams = v.object({ orgId: uuidV7Schema });

/** The box's Online Orders switch and the units of every product kept back from the online store (unchanged when absent). */
export const onlineSettingsInput = v.strictObject({
  onlineOrders: v.boolean(),
  buffer: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(10_000))),
});

/** The most customers one `/relay/customers` batch carries: each brings up to 100 receipt documents. */
export const CUSTOMER_BATCH = 25;
const amount = v.pipe(v.number(), v.safeInteger());

/**
 * What a box publishes for customers who agreed to see receipts and points online (v1.5 Day 51): exactly what its own
 * account pages would show for their phone, and the ids of customers to take back. An allowlist: a credit limit, TIN,
 * note or anything else a customer row holds is refused.
 */
export const relayCustomers = v.strictObject({
  customers: v.pipe(
    v.array(
      v.strictObject({
        id: uuidV7Schema,
        phone: ghanaPhone,
        points: v.strictObject({
          enabled: v.boolean(),
          points: amount,
          tier: v.nullable(v.strictObject({ name })),
          entries: v.pipe(
            v.array(
              v.strictObject({
                id: uuidV7Schema,
                reason: text(16),
                points: amount,
                saleId: v.nullable(uuidV7Schema),
                occurredAt: timestamp,
              }),
            ),
            v.maxLength(50),
          ),
        }),
        receipts: v.pipe(
          v.array(
            v.strictObject({
              id: uuidV7Schema,
              receiptNumber: v.nullable(text(64)),
              occurredAt: timestamp,
              total: v.nullable(amount),
              status: text(32),
              branchName: name,
              receipt: v.nullable(receiptDocument),
            }),
          ),
          v.maxLength(100),
        ),
      }),
    ),
    v.maxLength(CUSTOMER_BATCH),
  ),
  withdrawn: v.optional(v.pipe(v.array(uuidV7Schema), v.maxLength(BATCH_ROWS)), []),
});
export type RelayCustomers = v.InferOutput<typeof relayCustomers>;
/** One customer as the box sends it and the shop reads it back (timestamps as ISO strings). */
export type RelayCustomerWire = v.InferInput<typeof relayCustomers>["customers"][number];
