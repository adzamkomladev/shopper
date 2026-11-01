import { and, desc, eq, sql } from "drizzle-orm";
import { asset, branch, sale, type ShopperDatabase } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import * as v from "valibot";
import { receiptDocument } from "../schemas/receipts/document";
import { ShopError } from "./error";
import { customersOf } from "./queries";
import type { ShopSession } from "./types";

// ponytail: newest 100 only; add a cursor when a shopper's history outgrows it.
const RECENT = 100;

/** The shopper's purchases at this shop, newest first: sales rung up to their phone's customer rows. */
export async function listShopReceipts(db: ShopperDatabase, session: ShopSession) {
  const rows = await receipts(db, session)
    .orderBy(desc(sale.occurredAt), desc(sale.id))
    .limit(RECENT);
  return { items: rows.map(({ receipt: _receipt, ...row }) => itemView(row)) };
}

/** One of their purchases with the receipt document the till printed; any other sale is not found. */
export async function readShopReceipt(db: ShopperDatabase, session: ShopSession, rawId: unknown) {
  const row = await ownReceipt(db, session, rawId);
  return {
    ...itemView(row),
    receipt: row.receipt ? v.parse(receiptDocument, row.receipt) : null,
  };
}

/**
 * Where the till's PDF of one of their purchases is stored, once a copy is linked and its bytes were verified.
 * The shop hands out a short grant on it and never renders a receipt on view.
 */
export async function shopReceiptPdfKey(db: ShopperDatabase, session: ShopSession, rawId: unknown) {
  const row = await ownReceipt(db, session, rawId);
  if (!row.pdfKey) throw new ShopError("This receipt has no PDF yet", 404);
  return row.pdfKey;
}

function receipts(db: ShopperDatabase, session: ShopSession, id?: string) {
  const verified = sql<boolean>`${asset.verifiedSha256} IS NOT NULL AND ${asset.verifiedSha256} = ${asset.sha256}`;
  return db
    .select({
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      occurredAt: sale.occurredAt,
      total: sale.total,
      status: sale.status,
      branchName: branch.name,
      receipt: sale.receipt,
      pdfKey: sql<string | null>`CASE WHEN ${verified} THEN ${asset.key} END`,
    })
    .from(sale)
    .innerJoin(branch, and(eq(branch.orgId, sale.orgId), eq(branch.id, sale.branchId)))
    .leftJoin(asset, and(eq(asset.orgId, sale.orgId), eq(asset.id, sale.receiptAssetId)))
    .where(
      and(
        eq(sale.orgId, session.orgId),
        sql`${sale.customerId} IN (${customersOf(session)})`,
        ...(id ? [eq(sale.id, id)] : []),
      ),
    )
    .$dynamic();
}

async function ownReceipt(db: ShopperDatabase, session: ShopSession, rawId: unknown) {
  const id = v.safeParse(uuidV7Schema, rawId);
  const [row] = id.success ? await receipts(db, session, id.output) : [];
  if (!row) throw new ShopError("We could not find that receipt", 404);
  return row;
}

type Row = Omit<Awaited<ReturnType<ReturnType<typeof receipts>["execute"]>>[number], "receipt">;

function itemView(row: Row) {
  return {
    id: row.id,
    receiptNumber: row.receiptNumber,
    occurredAt: row.occurredAt.toISOString(),
    total: row.total,
    status: row.status,
    branchName: row.branchName,
    pdf: row.pdfKey !== null,
  };
}
