// Full answers for the store's online order screens, replayed with page.route so the specs can draw them busy: a queue
// with an order in every stage, one order being picked, and the same order as the shopper reads it.
const GHS = 10_000;
const soon = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const branch = { id: "019a0000-0000-7000-8000-000000000b01", name: "Osu" };

export const ORDER_ID = "019a0000-0000-7000-8000-0000000004a1";
export const queueRow = (n: number, status: string, minutes: number, over = {}) => ({
  id: `019a0000-0000-7000-8000-0000000004${n}0`,
  number: 1000 + n,
  status,
  branch,
  fulfilment: n % 2 ? "pickup" : "delivery",
  slotStart: soon(minutes),
  slotEnd: soon(minutes + 60),
  customerName: ["Ama Mensah", "Kofi Boateng", "Efua Asante", "Yaw Owusu"][n % 4]!,
  items: n + 1,
  gross: (40 + n * 13) * GHS,
  placedAt: soon(-30),
  ...over,
});

export const busyQueue = (stage: "new" | "preparing" | "ready" | "done") => ({
  counts: { new: 2, preparing: 3, ready: 1, done: 4 },
  orders: {
    new: [queueRow(1, "paid", 90), queueRow(2, "paid", 180)],
    preparing: [
      queueRow(3, "accepted", 40),
      queueRow(4, "picking", 75),
      queueRow(5, "accepted", 200),
    ],
    ready: [queueRow(6, "ready", 10)],
    done: [queueRow(7, "completed", -240), queueRow(8, "refunded", -300)],
  }[stage],
});

const line = (
  position: number,
  name: string,
  unit: string,
  quantityThousandths: number,
  gross: number,
  pick?: unknown,
) => ({
  id: `019a0000-0000-7000-8000-0000000005${position}0`,
  kind: "product",
  productId: `019a0000-0000-7000-8000-0000000006${position}0`,
  name,
  sku: `SKU${position}`,
  unit,
  quantityThousandths,
  gross,
  barcodes: [`600123456789${position}`],
  ...(pick ? { pick } : {}),
});

/** The order as the picker sees it at each point in its life. */
export const staffOrder = (status: string, over = {}) => ({
  id: ORDER_ID,
  number: 1004,
  status,
  branch,
  fulfilment: "pickup",
  slotStart: soon(45),
  slotEnd: soon(105),
  deliveryAddress: null,
  customer: { name: "Ama Mensah", phone: "0241234567", email: null },
  receiptNumber: "OSU-W-001004",
  gross: 87_5000,
  fulfilledGross: null,
  lines: [
    line(1, "Frytol oil 1L", "each", 2_000, 60 * GHS),
    line(2, "Jasmine rice", "kg", 1_500, 27_7500),
    line(3, "Milo tin 400g", "each", 1_000, 45 * GHS),
  ],
  adjustment: null,
  events: [
    { status: "paid", at: soon(-20) },
    { status: "accepted", at: soon(-15) },
  ],
  ...over,
});

/** The same order as the shopper's page reads it, picked with one item short and one replaced. */
export const shopperOrder = (status: string, over = {}) => ({
  id: ORDER_ID,
  number: 1004,
  channel: "online",
  status,
  branch,
  fulfilment: "pickup",
  slotStart: soon(45),
  slotEnd: soon(105),
  deliveryAddress: null,
  customerName: "Ama Mensah",
  holdExpiresAt: soon(-5),
  receiptNumber: "OSU-W-001004",
  paidAt: soon(-20),
  payment: null,
  placedAt: soon(-30),
  timeline: [
    { status: "placed", at: soon(-30) },
    { status: "paid", at: soon(-20) },
    { status: "accepted", at: soon(-15) },
    { status: "picking", at: soon(-8) },
    { status: "ready", at: soon(-2) },
    ...(status === "out_for_delivery" ? [{ status, at: soon(-1) }] : []),
    ...(status === "completed" ? [{ status, at: soon(-1) }] : []),
  ],
  adjustment: { beforeGross: 87_5000, afterGross: 77_5000, refundAmount: 10 * GHS },
  canReview: status === "completed",
  review: null,
  totals: {
    base: 75_0000,
    vat: 7_5000,
    nhil: 2_0000,
    getfund: 2_0000,
    covid: 1_0000,
    gross: 87_5000,
  },
  lines: [
    {
      id: "019a0000-0000-7000-8000-000000000510",
      kind: "product",
      productId: "019a0000-0000-7000-8000-000000000610",
      quantityThousandths: 2_000,
      gross: 60 * GHS,
      name: "Frytol oil 1L",
      baseUnit: "each",
      pick: {
        outcome: "substituted",
        pickedThousandths: 1_000,
        substitute: { name: "Palm oil 1L", quantityThousandths: 1_000, gross: 20 * GHS },
      },
    },
    {
      id: "019a0000-0000-7000-8000-000000000520",
      kind: "product",
      productId: "019a0000-0000-7000-8000-000000000620",
      quantityThousandths: 1_500,
      gross: 27_7500,
      name: "Jasmine rice",
      baseUnit: "kg",
      pick: { outcome: "picked", pickedThousandths: 1_500, substitute: null },
    },
  ],
  ...over,
});
