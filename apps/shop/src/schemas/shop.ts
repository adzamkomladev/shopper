import * as v from "valibot";
import { receiptDocument } from "@shopper/core/schemas";
import { money } from "@shopper/money";

const amount = v.pipe(v.number(), v.safeInteger(), v.transform(money));
const nullableText = v.nullable(v.string());

export const shopInfo = v.object({ name: v.string(), code: v.string() });
/** A shop code from the link, compared as the API stores it. */
export const shopCodeParam = v.pipe(v.string(), v.trim(), v.toLowerCase());
/** A 204 reply. */
export const noContent = v.null();
/** What the API says when it refuses: the message, and the tries left after a wrong code. */
export const refusalReply = v.object({
  error: v.string(),
  attemptsLeft: v.optional(v.number()),
  /** A refused checkout says why (slot, stock, closed) and which products ran short. */
  code: v.optional(v.string()),
  products: v.optional(v.array(v.string())),
});

export const shopAccount = v.object({
  id: v.string(),
  phone: v.string(),
  name: nullableText,
  email: nullableText,
  shop: shopInfo,
});

export const shopPoints = v.object({
  enabled: v.boolean(),
  points: v.number(),
  tier: v.nullable(v.object({ name: v.string() })),
  entries: v.array(
    v.object({
      id: v.string(),
      reason: v.string(),
      points: v.number(),
      saleId: nullableText,
      occurredAt: v.string(),
    }),
  ),
});

const receiptItem = v.object({
  id: v.string(),
  receiptNumber: nullableText,
  occurredAt: v.string(),
  total: amount,
  status: v.string(),
  branchName: v.string(),
  pdf: v.boolean(),
});

export const shopReceipts = v.object({ items: v.array(receiptItem) });

export const shopReceipt = v.object({
  ...receiptItem.entries,
  receipt: v.nullable(receiptDocument),
});

export const shopAddress = v.object({
  id: v.string(),
  label: v.string(),
  line1: v.string(),
  area: v.string(),
  city: v.string(),
  landmark: nullableText,
  phone: v.string(),
  isDefault: v.boolean(),
});

export const shopAddresses = v.object({ items: v.array(shopAddress) });

export const loginStarted = v.object({ loginId: v.string() });
export const loginVerified = v.object({ accountId: v.string() });
export const codeResent = v.object({ sent: v.boolean() });

export type ShopReceiptItem = v.InferOutput<typeof receiptItem>;
export type ShopAddress = v.InferOutput<typeof shopAddress>;
export type ShopAccount = v.InferOutput<typeof shopAccount>;
export type ShopPoints = v.InferOutput<typeof shopPoints>;
