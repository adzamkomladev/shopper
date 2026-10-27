import * as v from "valibot";

const day = v.pipe(v.string(), v.isoDate());
const status = v.picklist(["completed", "refunded", "pending"]);
export const TENDERS = ["cash", "card", "momo", "credit", "loyalty"] as const;

/** The explorer's address: an Accra date range, a search, narrowing filters and the status tab. */
export const transactionSearch = v.object({
  from: v.optional(day),
  to: v.optional(day),
  q: v.optional(v.string()),
  branchId: v.optional(v.string()),
  tender: v.optional(v.picklist(TENDERS)),
  status: v.optional(v.picklist(["all", "completed", "refunded", "pending"])),
});
export type TransactionSearch = v.InferOutput<typeof transactionSearch>;

export const transactionRow = v.object({
  id: v.string(),
  kind: v.picklist(["sale", "payment"]),
  occurredAt: v.string(),
  receiptNumber: v.nullable(v.string()),
  branchId: v.string(),
  cashierId: v.string(),
  cashierName: v.nullable(v.string()),
  customerId: v.nullable(v.string()),
  customerName: v.nullable(v.string()),
  total: v.number(),
  status,
  tenders: v.array(v.string()),
  items: v.number(),
});
export type TransactionRow = v.InferOutput<typeof transactionRow>;

export const transactionPage = v.object({
  rows: v.array(transactionRow),
  counts: v.object({
    all: v.number(),
    completed: v.number(),
    refunded: v.number(),
    pending: v.number(),
  }),
  next: v.nullable(v.string()),
});

const tax = v.object({ vat: v.number(), nhil: v.number(), getfund: v.number(), covid: v.number() });

export const transactionDetail = v.object({
  id: v.string(),
  receiptNumber: v.string(),
  occurredAt: v.string(),
  branchId: v.string(),
  deviceId: v.string(),
  cashier: v.object({ id: v.string(), name: v.nullable(v.string()) }),
  customer: v.nullable(v.object({ id: v.string(), name: v.nullable(v.string()) })),
  status: v.picklist(["completed", "refunded"]),
  total: v.number(),
  cashRounding: v.number(),
  change: v.number(),
  lines: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      sku: v.nullish(v.string()),
      quantity: v.number(),
      unitPrice: v.number(),
      discount: v.number(),
      tax,
      total: v.number(),
    }),
  ),
  tenders: v.array(
    v.object({
      kind: v.string(),
      amount: v.number(),
      reference: v.nullable(v.string()),
      last4: v.nullable(v.string()),
      payment: v.nullable(
        v.object({
          reference: v.string(),
          provider: v.string(),
          status: v.string(),
          network: v.nullable(v.string()),
          providerReference: v.nullable(v.string()),
        }),
      ),
    }),
  ),
  refunds: v.array(
    v.object({
      id: v.string(),
      creditNoteNumber: v.nullable(v.string()),
      occurredAt: v.string(),
      reason: v.nullable(v.string()),
      tenderKind: v.string(),
      total: v.number(),
      providerRefunds: v.array(
        v.object({ status: v.string(), amount: v.number(), reason: v.nullable(v.string()) }),
      ),
    }),
  ),
  fiscal: v.array(
    v.object({
      kind: v.string(),
      invoiceNumber: v.nullable(v.string()),
      status: v.string(),
      sdcId: v.nullable(v.string()),
      refundId: v.nullable(v.string()),
      signedAt: v.nullable(v.string()),
    }),
  ),
  audit: v.array(
    v.object({
      id: v.string(),
      command: v.string(),
      actorId: v.nullable(v.string()),
      actorName: v.nullable(v.string()),
      approverId: v.nullable(v.string()),
      at: v.string(),
    }),
  ),
});
export type TransactionDetail = v.InferOutput<typeof transactionDetail>;

export const receiptEmailed = v.object({
  saleId: v.string(),
  email: v.string(),
  queued: v.boolean(),
});
