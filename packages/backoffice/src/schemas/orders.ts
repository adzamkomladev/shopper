import * as v from "valibot";

export const STAGES = ["new", "preparing", "ready", "done"] as const;
export type Stage = (typeof STAGES)[number];

/** The queue's address: the stage tab and, optionally, one branch. */
export const orderSearch = v.object({
  stage: v.optional(v.picklist(STAGES)),
  branchId: v.optional(v.string()),
  q: v.optional(v.string()),
});
export type OrderSearch = v.InferOutput<typeof orderSearch>;

const status = v.picklist([
  "placed",
  "expired",
  "cancelled",
  "paid",
  "accepted",
  "picking",
  "ready",
  "out_for_delivery",
  "completed",
  "refunded",
]);
export type OrderStatus = v.InferOutput<typeof status>;

export const orderRow = v.object({
  id: v.string(),
  number: v.number(),
  status,
  branch: v.object({ id: v.string(), name: v.string() }),
  fulfilment: v.picklist(["pickup", "delivery"]),
  slotStart: v.string(),
  slotEnd: v.string(),
  customerName: v.string(),
  items: v.number(),
  gross: v.number(),
  placedAt: v.string(),
});
export type OrderRow = v.InferOutput<typeof orderRow>;

export const orderQueue = v.object({
  counts: v.object({ new: v.number(), preparing: v.number(), ready: v.number(), done: v.number() }),
  orders: v.array(orderRow),
});

const pick = v.object({
  outcome: v.picklist(["picked", "short", "substituted"]),
  pickedThousandths: v.number(),
  substitute: v.nullish(
    v.object({
      productId: v.string(),
      name: v.string(),
      quantityThousandths: v.number(),
      gross: v.number(),
    }),
  ),
});
export type Pick = v.InferOutput<typeof pick>;

export const orderLine = v.object({
  id: v.string(),
  kind: v.picklist(["product", "delivery"]),
  productId: v.nullable(v.string()),
  name: v.string(),
  sku: v.nullable(v.string()),
  unit: v.string(),
  quantityThousandths: v.number(),
  gross: v.number(),
  barcodes: v.array(v.string()),
  pick: v.optional(pick),
});
export type OrderLine = v.InferOutput<typeof orderLine>;

export const staffOrder = v.object({
  id: v.string(),
  number: v.number(),
  status,
  branch: v.object({ id: v.string(), name: v.string() }),
  fulfilment: v.picklist(["pickup", "delivery"]),
  slotStart: v.string(),
  slotEnd: v.string(),
  deliveryAddress: v.nullable(v.record(v.string(), v.string())),
  customer: v.object({ name: v.string(), phone: v.string(), email: v.nullable(v.string()) }),
  receiptNumber: v.nullable(v.string()),
  gross: v.number(),
  fulfilledGross: v.nullable(v.number()),
  lines: v.array(orderLine),
  adjustment: v.nullish(
    v.object({ beforeGross: v.number(), afterGross: v.number(), refundAmount: v.number() }),
  ),
  events: v.array(v.object({ status: v.string(), at: v.string() })),
});
export type StaffOrder = v.InferOutput<typeof staffOrder>;

/** What the picker tells the server about one line. */
export type PickBody = {
  pickedThousandths: number;
  substitute?: { productId: string; quantityThousandths: number };
};

/** The steps the store takes with an order, each one a call to the API. */
export type Step = "accept" | "decline" | "start" | "ready" | "dispatch" | "handover" | "cancel";
