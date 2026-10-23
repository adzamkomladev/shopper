import * as v from "valibot";
import { money } from "@shopper/money";
import { customerKindSchema } from "@shopper/core/schemas";

const int = v.pipe(v.number(), v.safeInteger());
const amount = v.pipe(int, v.transform(money));

/** A customer as the API reads it: its fields with the balance and points folded from the ledgers. */
export const customerView = v.object({
  id: v.string(),
  name: v.string(),
  phone: v.string(),
  kind: customerKindSchema,
  businessName: v.nullable(v.string()),
  tin: v.nullable(v.string()),
  email: v.nullable(v.string()),
  creditLimit: amount,
  version: int,
  /** When their identity was verified; a credit limit needs it. */
  kycVerifiedAt: v.nullable(v.string()),
  /** Their newest sale; null before the first. */
  lastVisitAt: v.nullable(v.string()),
  archivedAt: v.nullable(v.string()),
  mergedIntoId: v.nullable(v.string()),
  /** What they owe; below zero is a deposit held for them. */
  balance: amount,
  points: int,
});

export const customerPage = v.object({
  items: v.array(customerView),
  nextCursor: v.nullable(v.string()),
});
