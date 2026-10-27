// Full answers for the transactions explorer, replayed with page.route so the specs can draw it busy: a day of
// sales with a refund and a pending MoMo payment, and one sale's drill-down.
const GHS = 10_000;
const at = (time: string) => `2026-10-27T${time}:00.000Z`;
const names = ["Ama Mensah", "Kofi Boateng", null, "Efua Asante", "Yaw Owusu", null, "Abena Osei"];

export const busyTransactions = {
  rows: [
    ...names.map((customerName, index) => ({
      id: `019a0000-0000-7000-8000-0000000001${String(index).padStart(2, "0")}`,
      kind: "sale",
      occurredAt: at(`1${index}:${10 + index}`),
      receiptNumber: `OSU1-T01-0004${81 - index}`,
      branchId: "019a0000-0000-7000-8000-000000000b01",
      cashierId: "019a0000-0000-7000-8000-000000000c01",
      cashierName: index % 2 ? "Akosua Darko" : "Kwame Nkansah",
      customerId: customerName ? `019a0000-0000-7000-8000-0000000002${index}0` : null,
      customerName,
      total: (16 + index * 7) * GHS + 4_500,
      status: index === 1 ? "refunded" : "completed",
      tenders: index === 3 ? ["cash", "momo"] : [["cash", "card", "momo"][index % 3]!],
      items: 1 + index,
    })),
    {
      id: "019a0000-0000-7000-8000-0000000003f0",
      kind: "payment",
      occurredAt: at("09:05"),
      receiptNumber: null,
      branchId: "019a0000-0000-7000-8000-000000000b01",
      cashierId: "019a0000-0000-7000-8000-000000000c01",
      cashierName: "Kwame Nkansah",
      customerId: null,
      customerName: null,
      total: 21 * GHS + 9_000,
      status: "pending",
      tenders: ["momo"],
      items: 0,
    },
  ],
  counts: { all: 8, completed: 6, refunded: 1, pending: 1 },
  next: null,
};

export const busySale = {
  id: "019a0000-0000-7000-8000-000000000100",
  receiptNumber: "OSU1-T01-000481",
  occurredAt: at("11:42"),
  branchId: "019a0000-0000-7000-8000-000000000b01",
  deviceId: "019a0000-0000-7000-8000-000000000d01",
  cashier: { id: "019a0000-0000-7000-8000-000000000c01", name: "Kwame Nkansah" },
  customer: { id: "019a0000-0000-7000-8000-000000000210", name: "Ama Mensah" },
  status: "refunded",
  total: 48 * GHS + 7_200,
  cashRounding: 0,
  change: 0,
  lines: [
    ["Fan Milk Fan Choco 250ml", "FM-250", 2_000, 7 * GHS + 4_900, 0, 15 * GHS - 200],
    ["Tasty Tom tomato mix 400g", "TT-400", 1_000, 8 * GHS + 9_500, 0, 8 * GHS + 9_500],
    ["Onions (loose)", "ONI-KG", 2_160, 5 * GHS + 2_200, 1 * GHS + 1_900, 10 * GHS + 1_800],
    ["Reusable shopping bag", "BAG-01", 1_000, 16 * GHS + 3_400, 2 * GHS, 14 * GHS + 3_400],
  ].map(([name, sku, quantity, unitPrice, discount, total], index) => ({
    id: `019a0000-0000-7000-8000-0000000004${index}0`,
    name,
    sku,
    quantity,
    unitPrice,
    discount,
    tax: { vat: 6_000, nhil: 1_000, getfund: 1_000, covid: 0 },
    total,
  })),
  tenders: [
    {
      kind: "momo",
      amount: 48 * GHS + 7_200,
      reference: null,
      last4: null,
      payment: {
        reference: "019a0000-0000-7000-8000-0000000005a0",
        provider: "paystack",
        status: "confirmed",
        network: "mtn",
        providerReference: "T873149206",
      },
    },
  ],
  refunds: [
    {
      id: "019a0000-0000-7000-8000-0000000006a0",
      creditNoteNumber: "OSU1-T01-CN-000012",
      occurredAt: at("15:20"),
      reason: "Damaged packaging",
      tenderKind: "momo",
      total: 8 * GHS + 9_500,
      providerRefunds: [{ status: "processed", amount: 8 * GHS + 9_500, reason: null }],
    },
  ],
  fiscal: [
    {
      kind: "invoice",
      invoiceNumber: "GRA-SDC-2026-0004810",
      status: "signed",
      sdcId: "SDC-ACC-0042",
      refundId: null,
      signedAt: at("11:42"),
    },
  ],
  audit: [
    ["sale.accept", "Kwame Nkansah", "11:43"],
    ["payment.momo.updated", null, "11:42"],
    ["refund.accept", "Akosua Darko", "15:21"],
    ["payment.refund.updated", null, "15:24"],
  ].map(([command, actorName, time], index) => ({
    id: `019a0000-0000-7000-8000-0000000007${index}0`,
    command,
    actorId: actorName ? "019a0000-0000-7000-8000-000000000c01" : null,
    actorName,
    approverId: null,
    at: at(time!),
  })),
};
