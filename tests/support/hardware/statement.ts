import type { Json } from "@shopper/ports";

/** A small statement document in the shape the renderers take: an opening balance, three entries and a deposit at the end. */
export const goldenStatement = {
  v: 1,
  shop: { name: "Market" },
  customer: { name: "Ama Mensah", phone: "0241234567" },
  period: { from: "2026-10-01", to: "2026-10-31" },
  opening: 400_000,
  entries: [
    {
      kind: "charge",
      method: null,
      amount: 200_000,
      balance: 600_000,
      occurredAt: "2026-10-05T09:00:00.000Z",
    },
    {
      kind: "credit_note",
      method: null,
      amount: -50_000,
      balance: 550_000,
      occurredAt: "2026-10-12T09:00:00.000Z",
    },
    {
      kind: "payment",
      method: "cash",
      amount: -700_000,
      balance: -150_000,
      occurredAt: "2026-10-31T23:30:00.000Z",
    },
  ],
  closing: -150_000,
} as const satisfies Json;
