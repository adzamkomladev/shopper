import * as v from "valibot";
import { and, eq, sql } from "drizzle-orm";
import {
  localSale,
  reference,
  refund,
  type TillDatabase,
  type TillSqlite,
} from "@shopper/db-sqlite";
import { add, money } from "@shopper/money";
import { paidOut } from "../../customers/credit/refunds";
import { receiptDocument } from "../../schemas/receipts/document";
import { refundEvent, type RefundSnapshot } from "../../schemas/till/refund";
import type { ServerSale } from "../../schemas/till/refunds";
import { saleSnapshot } from "../../schemas/till/sale";
import { tillProductBase } from "../../schemas/till/reference";
import { findRegisterSettings } from "../register/settings";
import { eligibility } from "./eligibility";
import type { Original, Policy } from "./types";

type Scope = { orgId: string; deviceId: string; branchId: string };

export async function refundPolicy(tx: TillSqlite, scope: Scope): Promise<Policy> {
  const saved = await findRegisterSettings(tx, scope);
  return {
    returnWindowDays: saved?.value.returnWindowDays ?? 30,
    requirePinForReturns: saved?.value.requirePinForReturns ?? false,
  };
}

/** The refunds this till made of one sale, oldest first. */
export async function refundsOf(tx: TillSqlite, orgId: string, saleId: string) {
  const rows = await tx
    .select()
    .from(refund)
    .where(and(eq(refund.orgId, orgId), eq(refund.originalSaleId, saleId)))
    .orderBy(refund.id);
  return rows.map((row) => ({ row, snapshot: v.parse(refundEvent, row.payload).refund }));
}

/** A sale made on this till, with the refunds and final-sale flags it is judged by. */
export async function loadLocalOriginal(
  tx: TillSqlite,
  scope: Scope,
  saleId: string,
): Promise<Original | undefined> {
  const [row] = await tx
    .select()
    .from(localSale)
    .where(
      and(
        eq(localSale.orgId, scope.orgId),
        eq(localSale.deviceId, scope.deviceId),
        eq(localSale.id, saleId),
      ),
    );
  if (!row) return undefined;
  const sale = v.parse(saleSnapshot, row.payload);
  const refunded: Record<string, number> = {};
  let cashRefunded = money(0);
  let accountCredited = money(0);
  let pointsReturned = 0;
  for (const { snapshot } of await refundsOf(tx, scope.orgId, saleId)) {
    for (const line of snapshot.lines)
      refunded[line.originalLineId] =
        (refunded[line.originalLineId] ?? 0) + line.tax.quantityThousandths;
    if (snapshot.tender.kind === "cash") cashRefunded = add(cashRefunded, paidOut(snapshot));
    accountCredited = add(accountCredited, snapshot.accountCredit);
    pointsReturned += snapshot.pointsReturned;
  }
  const products = await tx.select().from(reference).where(eq(reference.entity, "product"));
  const finalSale = Object.fromEntries(
    products.map((product) => {
      const parsed = v.parse(tillProductBase, product.payload);
      return [parsed.id, parsed.finalSale];
    }),
  );
  return {
    origin: "local",
    sale,
    occurredAt: new Date(Date.parse(sale.deviceTime) - sale.clockOffsetMs).toISOString(),
    receipt: row.receipt ? v.parse(receiptDocument, row.receipt) : null,
    refunded,
    cashRefunded,
    accountCredited,
    pointsReturned,
    finalSale,
  };
}

/** The id of this till's sale with that receipt number. */
export async function findSaleByReceipt(db: TillDatabase, scope: Scope, receipt: string) {
  const [row] = await db.read((tx) =>
    tx
      .select({ id: localSale.id })
      .from(localSale)
      .where(
        and(
          eq(localSale.orgId, scope.orgId),
          eq(localSale.deviceId, scope.deviceId),
          sql`json_extract(${localSale.payload}, '$.receiptNumber') = ${receipt}`,
        ),
      ),
  );
  return row?.id;
}

export const refundView = ({ row, snapshot }: Awaited<ReturnType<typeof refundsOf>>[number]) => ({
  id: row.id,
  occurredAt: refundTime(snapshot),
  reason: snapshot.reason,
  tender: snapshot.tender,
  total: snapshot.total,
  approverId: snapshot.approverId,
  lines: snapshot.lines.map((line) => ({
    lineId: line.originalLineId,
    name: line.name,
    quantityThousandths: line.tax.quantityThousandths,
    gross: line.tax.gross,
  })),
  /** Sent to the server (or born accepted); a refund that is not yet accepted waits for the sale backlog. */
  accepted: row.acceptedAt !== null,
  blockedCode: row.blockedCode,
  blockedReason: row.blockedReason,
});

/** What the purchase detail and the return screen show for a sale: refunds made and what may still go back. */
export async function readEligibility(tx: TillSqlite, scope: Scope, original: Original, at: Date) {
  return eligibility(original, await refundPolicy(tx, scope), at);
}

/** One Returns row per refund made on this till on `day` (any day when empty), as the purchases list shows it. */
export async function returnedRows(tx: TillSqlite, scope: Scope, day?: string) {
  const rows = await tx.select().from(refund).where(eq(refund.orgId, scope.orgId));
  return rows.flatMap((row) => {
    const snapshot = v.parse(refundEvent, row.payload).refund;
    if (snapshot.branchId !== scope.branchId) return [];
    const occurredAt = refundTime(snapshot);
    if (day && !occurredAt.startsWith(day)) return [];
    return [
      { row, snapshot, occurredAt, refundOf: v.parse(receiptDocument, row.receipt).refundOf },
    ];
  });
}

export const refundTime = (snapshot: RefundSnapshot) =>
  new Date(Date.parse(snapshot.deviceTime) - snapshot.clockOffsetMs).toISOString();

/** How much of a sale has gone back, from the refunds this till made of it. */
export function returnedState(
  sale: v.InferOutput<typeof saleSnapshot>,
  returns: Awaited<ReturnType<typeof returnedRows>>,
) {
  const sold = sale.lines.reduce((sum, line) => sum + line.tax.quantityThousandths, 0);
  const back = returns
    .filter(({ snapshot }) => snapshot.originalSaleId === sale.id)
    .reduce(
      (sum, { snapshot }) =>
        sum + snapshot.lines.reduce((n, l) => n + l.tax.quantityThousandths, 0),
      0,
    );
  return back === 0 ? ("none" as const) : back >= sold ? ("full" as const) : ("partial" as const);
}

/** The purchase detail of a sale made on another register, from the server's lookup. */
export function serverPurchase(found: ServerSale, view: ReturnType<typeof eligibility>) {
  const { sale } = found;
  const sold = sale.lines.reduce((sum, line) => sum + line.tax.quantityThousandths, 0);
  const back = Object.values(found.refunded).reduce((sum, quantity) => sum + quantity, 0);
  return {
    id: sale.id,
    status: "completed" as const,
    receiptNumber: sale.receiptNumber,
    occurredAt: found.occurredAt,
    total: sale.total,
    kinds: [...new Set(sale.tenders.map((tender) => tender.kind))],
    refundOf: null,
    refunded:
      back === 0 ? ("none" as const) : back >= sold ? ("full" as const) : ("partial" as const),
    sale,
    receipt: found.receipt,
    draft: null,
    delivery: null,
    origin: "server" as const,
    refunds: [],
    eligibility: view,
  };
}
