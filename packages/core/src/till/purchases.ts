import * as v from "valibot";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import {
  localSale,
  receiptOutput,
  saleDraft,
  saleDraftLine,
  saleDraftTender,
  paymentIntent,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import { saleSnapshot } from "../schemas/till/sale";
import { receiptDocument } from "../schemas/receipts/document";
import { purchaseInput, purchasesInput } from "../schemas/till/purchases";
import type { DraftScope } from "../schemas/till/drafts";
import { toView } from "./drafts/queries";
import { TillError } from "./error";
import { paymentSale } from "./tenders/consumption";

export async function listPurchases(db: TillDatabase, raw: unknown) {
  const input = v.parse(purchasesInput, raw);
  return db.read(async (tx) => {
    const rows = await purchases(tx, input.scope, input.at);
    const filtered = rows.filter(
      (row) =>
        (input.status === "all" || row.status === input.status) &&
        (input.kind === "all" || row.kinds.some((kind) => kind === input.kind)) &&
        (row.receiptNumber ?? row.id).toLowerCase().includes(input.query.toLowerCase()),
    );
    return {
      purchases: filtered
        .slice((input.page - 1) * input.pageSize, input.page * input.pageSize)
        .map((row) => ({
          id: row.id,
          status: row.status,
          receiptNumber: row.receiptNumber,
          occurredAt: row.occurredAt,
          total: row.total,
          kinds: row.kinds,
        })),
      total: filtered.length,
      page: input.page,
      pageSize: input.pageSize,
    };
  });
}

export async function readPurchase(db: TillDatabase, raw: unknown) {
  const input = v.parse(purchaseInput, raw);
  return db.read(async (tx) => {
    const rows = await purchases(tx, input.scope, input.at, input.saleId);
    const row = rows.find((row) => row.id === input.saleId);
    if (!row) throw new TillError("SALE_UNKNOWN", "This purchase is unavailable on this register");
    return { ...row, delivery: row.sale ? await deliveryOf(tx, row.id) : null };
  });
}

/** What happened to a sale's receipt: printed or failed, reprinted, and whether its PDF reached the server. */
async function deliveryOf(tx: TillSqlite, saleId: string) {
  const [output] = await tx.select().from(receiptOutput).where(eq(receiptOutput.saleId, saleId));
  return {
    printedAt: output?.printedAt ?? null,
    reprints: output?.reprints ?? 0,
    printError: output?.printError ?? null,
    pdf: !output?.pdfSha256
      ? null
      : output.uploadedAt
        ? ("uploaded" as const)
        : ("pending" as const),
  };
}

async function purchases(tx: TillSqlite, scope: DraftScope, at: Date, saleId?: string) {
  const day = at.toISOString().slice(0, 10);
  const nextDay = new Date(
    Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate() + 1),
  ).toISOString();
  const saved = await tx
    .select()
    .from(localSale)
    .where(
      and(
        eq(localSale.orgId, scope.orgId),
        eq(localSale.deviceId, scope.deviceId),
        ...(saleId ? [eq(localSale.id, saleId)] : []),
      ),
    );
  const completed = saved.flatMap((row) => {
    const sale = v.parse(saleSnapshot, row.payload);
    const occurredAt = new Date(
      new Date(sale.deviceTime).valueOf() - sale.clockOffsetMs,
    ).toISOString();
    if (sale.branchId !== scope.branchId || (!saleId && !occurredAt.startsWith(day))) return [];
    return [
      {
        id: row.id,
        status: "completed" as const,
        receiptNumber: sale.receiptNumber,
        occurredAt,
        total: sale.total,
        kinds: [...new Set(sale.tenders.map((tender) => tender.kind))],
        sale,
        receipt: row.receipt ? v.parse(receiptDocument, row.receipt) : null,
        draft: null,
      },
    ];
  });
  const drafts = await tx
    .select()
    .from(saleDraft)
    .where(
      and(
        eq(saleDraft.orgId, scope.orgId),
        eq(saleDraft.deviceId, scope.deviceId),
        eq(saleDraft.branchId, scope.branchId),
        ...(saleId
          ? [eq(saleDraft.id, saleId)]
          : [gte(saleDraft.updatedAt, `${day}T00:00:00.000Z`), lt(saleDraft.updatedAt, nextDay)]),
      ),
    );
  const pending = [];
  for (const draft of drafts) {
    const lines = await tx
      .select()
      .from(saleDraftLine)
      .where(eq(saleDraftLine.draftId, draft.id))
      .orderBy(asc(saleDraftLine.position));
    const view = await toView(tx, scope, at, { draft, lines });
    if (
      draft.status !== "voided" &&
      !view.draft?.tenders.some((t) => t.kind === "momo" && ["pending", "otp"].includes(t.status))
    )
      continue;
    pending.push({
      id: draft.id,
      status: draft.status === "voided" ? ("voided" as const) : ("pending" as const),
      receiptNumber: null,
      occurredAt: draft.voidedAt ?? draft.updatedAt,
      total: view.quote.totals.gross,
      kinds: [...new Set(view.draft?.tenders.map((t) => t.kind) ?? [])],
      sale: null,
      receipt: null,
      draft: view,
    });
  }
  const intents = await tx
    .select()
    .from(paymentIntent)
    .where(
      and(
        eq(paymentIntent.orgId, scope.orgId),
        eq(paymentIntent.deviceId, scope.deviceId),
        eq(paymentIntent.branchId, scope.branchId),
        ...(saleId ? [eq(paymentIntent.reference, saleId)] : []),
      ),
    );
  const used = new Set(
    saved.flatMap((row) =>
      v.parse(saleSnapshot, row.payload).tenders.flatMap((t) => (t.reference ? [t.reference] : [])),
    ),
  );
  const orphans = [];
  for (const intent of intents) {
    if (
      !["pending", "otp", "confirmed"].includes(intent.status) ||
      used.has(intent.reference) ||
      (saleId && (await paymentSale(tx, scope.orgId, intent.reference)))
    )
      continue;
    const [attached] = await tx
      .select({ status: saleDraft.status, tenderStatus: saleDraftTender.status })
      .from(saleDraftTender)
      .innerJoin(saleDraft, eq(saleDraft.id, saleDraftTender.draftId))
      .where(
        and(
          eq(saleDraftTender.orgId, scope.orgId),
          eq(saleDraftTender.reference, intent.reference),
        ),
      );
    if (
      attached?.status === "open" &&
      (intent.status !== "confirmed" || attached.tenderStatus === "confirmed")
    )
      continue;
    const payment = {
      reference: intent.reference,
      amount: intent.amount,
      phone: intent.phone,
      network: intent.network,
      status: intent.status,
      failureReason: intent.failureReason,
    };
    orphans.push({
      id: intent.reference,
      status: "pending" as const,
      receiptNumber: null,
      occurredAt: intent.createdAt,
      total: intent.amount,
      kinds: ["momo" as const],
      sale: null,
      receipt: null,
      draft: null,
      payment,
    });
  }
  return [...completed, ...pending, ...orphans].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
}
