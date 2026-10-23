import * as v from "valibot";
import { money } from "@shopper/money";

const int = v.pipe(v.number(), v.safeInteger());
const amount = v.pipe(int, v.transform(money));
const day = v.string();

/** The days a statement can cover, and the entries between with the balance after each. */
export const statementView = v.object({
  from: day,
  to: day,
  opening: amount,
  closing: amount,
  entries: v.array(
    v.object({
      id: v.string(),
      kind: v.string(),
      amount,
      balance: amount,
      method: v.nullable(v.string()),
      reason: v.nullable(v.string()),
      occurredAt: v.string(),
    }),
  ),
});
export type StatementView = v.InferOutput<typeof statementView>;

export const statementLinks = v.array(
  v.object({
    id: v.string(),
    from: day,
    to: day,
    expiresAt: v.string(),
    revokedAt: v.nullable(v.string()),
    viewedAt: v.nullable(v.string()),
    viewCount: int,
  }),
);
export type StatementLink = v.InferOutput<typeof statementLinks>[number];

/** A link just made: its address is shown once, because the server keeps no copy of the token. */
export const newStatementLink = v.object({ id: v.string(), token: v.string(), url: v.string() });

export const statementDeliveries = v.object({
  items: v.array(
    v.object({
      id: v.string(),
      channel: v.picklist(["sms", "email", "pdf"]),
      status: v.picklist(["queued", "sent", "failed"]),
      from: day,
      to: day,
      createdAt: v.string(),
    }),
  ),
});
export type StatementDelivery = v.InferOutput<typeof statementDeliveries>["items"][number];

export const customerSales = v.object({
  items: v.array(
    v.object({
      id: v.string(),
      receiptNumber: v.nullable(v.string()),
      occurredAt: v.string(),
      total: amount,
      status: v.string(),
    }),
  ),
});
export type CustomerSale = v.InferOutput<typeof customerSales>["items"][number];

export const customerLoyalty = v.object({
  points: int,
  enabled: v.boolean(),
  tier: v.nullable(v.object({ name: v.string() })),
  projection: v.nullable(
    v.object({ from: v.string(), to: v.nullable(v.string()), on: v.string() }),
  ),
  entries: v.array(
    v.object({
      id: v.string(),
      reason: v.string(),
      points: int,
      balance: int,
      occurredAt: v.string(),
    }),
  ),
});
export type CustomerLoyalty = v.InferOutput<typeof customerLoyalty>;

export const AGEING_BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;
export const ageingReport = v.object({
  items: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      phone: v.string(),
      total: amount,
      buckets: v.object(Object.fromEntries(AGEING_BUCKETS.map((bucket) => [bucket, amount]))),
    }),
  ),
});
export type AgeingRow = v.InferOutput<typeof ageingReport>["items"][number];

export const transferred = v.object({ points: int });
export const queued = v.object({ id: v.string() });
export const revoked = v.object({ id: v.string() });
