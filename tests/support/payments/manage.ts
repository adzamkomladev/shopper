// Full answers for the Day 23 management screens, replayed with page.route: a day's reconciliation with a MoMo
// settlement short by GHS 1, two pending approvals, and a read-only subscription with an overdue invoice.
const GHS = 10_000;
const DAY = "2026-10-27";
const id = (tail: string) => `019a0000-0000-7000-8000-${tail.padStart(12, "0")}`;

export const busyReconciliation = {
  day: DAY,
  tenders: [
    {
      tender: "cash",
      taken: 4_820 * GHS,
      expected: 4_710 * GHS,
      declared: 4_705 * GHS,
      variance: -5 * GHS,
      settled: null,
    },
    {
      tender: "card",
      taken: 1_240 * GHS,
      expected: 1_240 * GHS,
      declared: 1_240 * GHS,
      variance: 0,
      settled: null,
    },
    {
      tender: "momo",
      taken: 2_315 * GHS,
      expected: 2_315 * GHS,
      declared: 2_315 * GHS,
      variance: 0,
      settled: 2_314 * GHS,
    },
  ],
  shifts: [
    {
      id: id("5001"),
      branchId: id("b01"),
      deviceId: id("d01"),
      closedAt: `${DAY}T14:02:00.000Z`,
      closedBy: id("c01"),
      tenders: [
        { tender: "cash", expected: 2_100 * GHS, declared: 2_095 * GHS, variance: -5 * GHS },
        { tender: "momo", expected: 1_015 * GHS, declared: 1_015 * GHS, variance: 0 },
      ],
    },
    {
      id: id("5002"),
      branchId: id("b01"),
      deviceId: id("d02"),
      closedAt: `${DAY}T21:40:00.000Z`,
      closedBy: id("c02"),
      tenders: [
        { tender: "cash", expected: 2_610 * GHS, declared: 2_610 * GHS, variance: 0 },
        { tender: "card", expected: 1_240 * GHS, declared: 1_240 * GHS, variance: 0 },
        { tender: "momo", expected: 1_300 * GHS, declared: 1_300 * GHS, variance: 0 },
      ],
    },
  ],
  momo: {
    unsettled: 1,
    mismatches: [
      {
        paymentId: id("6001"),
        reference: "SHP-MOMO-7F3A21",
        expected: 125 * GHS,
        settled: 124 * GHS,
        settledOn: "2026-10-28",
        saleId: id("100"),
        receiptNumber: "OSU1-T01-000481",
      },
    ],
    unapplied: 1,
  },
};

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const approval = (
  tail: string,
  kind: "refund" | "discount",
  amount: number,
  reason: string,
  minutes: number,
) => ({
  id: id(tail),
  kind,
  branchId: id("b01"),
  deviceId: id("d01"),
  requestedBy: id("c01"),
  requesterName: kind === "refund" ? "Akosua Darko" : "Kwame Nkansah",
  subject: { saleId: id("101"), receiptNumber: "OSU1-T01-000480", amount, reason },
  status: "pending",
  decidedBy: null,
  decidedAt: null,
  declineReason: null,
  expiresAt: minutesFromNow(minutes),
  consumed: false,
});

/** Built per test so the expiry countdowns read from now. */
export const busyApprovals = () => ({
  approvals: [
    approval("7001", "refund", 45 * GHS, "Customer returned a dented tin of milk", 8),
    approval("7002", "discount", 12 * GHS + 5_000, "Loyal customer, bulk rice purchase", 3),
  ],
});

export const busyBilling = {
  subscription: { status: "read_only", billingDay: 1, nextInvoiceOn: "2026-11-01" },
  invoices: [
    {
      id: id("8002"),
      reference: "INV-2026-10",
      periodStart: "2026-10-01",
      periodEnd: "2026-11-01",
      stores: 2,
      terminals: 3,
      amount: 1_700 * GHS,
      status: "open",
      checkoutUrl: "https://checkout.paystack.com/inv-2026-10",
      reminders: 2,
      paidAt: null,
    },
    {
      id: id("8001"),
      reference: "INV-2026-09",
      periodStart: "2026-09-01",
      periodEnd: "2026-10-01",
      stores: 2,
      terminals: 3,
      amount: 1_700 * GHS,
      status: "paid",
      checkoutUrl: null,
      reminders: 0,
      paidAt: "2026-09-03T10:12:00.000Z",
    },
  ],
};
