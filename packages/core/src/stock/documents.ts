import * as v from "valibot";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { branch, product, stockDocument, stockMovement, supplier, user } from "@shopper/db-pg";
import { add, lineTotal, money, type Money } from "@shopper/money";
import { uuidV7Schema } from "@shopper/ports";
import { documentsQuery } from "../schemas/stock/views";
import type { Queryable } from "../types";
import { StockError } from "./error";
import { iso, requireBranch } from "./queries";

const notFound = (what: string) => new StockError("NOT_FOUND", `${what} not found`);

const documentColumns = {
  id: stockDocument.id,
  kind: stockDocument.kind,
  branchId: stockDocument.branchId,
  branchName: branch.name,
  supplierId: stockDocument.supplierId,
  // A till names its supplier in the document; the portal picks one from the list.
  supplierName: sql<
    string | null
  >`coalesce(${supplier.name}, ${stockDocument.payload} ->> 'supplier')`,
  cause: stockDocument.cause,
  reference: sql<string | null>`${stockDocument.payload} ->> 'reference'`,
  actorName: user.name,
  lineCount: sql<number>`jsonb_array_length(${stockDocument.payload} -> 'lines')`.mapWith(Number),
  occurredAt: stockDocument.occurredAt,
};
const selectDocuments = (db: Queryable) =>
  db
    .select(documentColumns)
    .from(stockDocument)
    .innerJoin(
      branch,
      and(eq(branch.orgId, stockDocument.orgId), eq(branch.id, stockDocument.branchId)),
    )
    .innerJoin(user, and(eq(user.orgId, stockDocument.orgId), eq(user.id, stockDocument.actorId)))
    .leftJoin(
      supplier,
      and(eq(supplier.orgId, stockDocument.orgId), eq(supplier.id, stockDocument.supplierId)),
    );

type Line = { quantityThousandths: number; unitCost: number | null; baseUnit: string };

/** The sum of the costed lines of a receipt, each rounded to the pesewa, or null when none has a cost. */
function totalCost(lines: Line[]) {
  const costed = lines.filter((line) => line.unitCost !== null);
  if (costed.length === 0) return null;
  return costed.reduce<Money>(
    (sum, line) => add(sum, lineTotal(money(line.unitCost!), line.quantityThousandths)),
    money(0),
  );
}

/** The signed change of an adjustment of one product, which the list shows in place of a line count. */
const singleChange = (lines: Line[]) =>
  lines.length === 1
    ? { quantityThousandths: lines[0]!.quantityThousandths, baseUnit: lines[0]!.baseUnit }
    : null;

/** What a record shows beyond its head, from the lines it posted. */
const summarize = (kind: string, lines: Line[]) => ({
  totalCost: kind === "receipt" ? totalCost(lines) : null,
  change: kind === "adjustment" ? singleChange(lines) : null,
});

/** Stock records (counts, receipts, adjustments), newest first, keyset-paged by id (UUIDv7 is time-ordered). */
export async function listDocuments(db: Queryable, orgId: string, rawQuery: unknown) {
  const { branchId, kind, cursor, limit } = v.parse(documentsQuery, rawQuery);
  if (branchId) await requireBranch(db, orgId, branchId);
  const inBranch = and(
    eq(stockDocument.orgId, orgId),
    branchId ? eq(stockDocument.branchId, branchId) : undefined,
  );
  const rows = await selectDocuments(db)
    .where(
      and(
        inBranch,
        kind ? eq(stockDocument.kind, kind) : undefined,
        cursor ? lt(stockDocument.id, cursor) : undefined,
      ),
    )
    .orderBy(desc(stockDocument.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const priced = page.filter((row) => row.kind !== "count").map((row) => row.id);
  const movements = priced.length
    ? await db
        .select({
          documentId: stockMovement.documentId,
          quantityThousandths: stockMovement.quantityThousandths,
          unitCost: stockMovement.unitCost,
          baseUnit: product.baseUnit,
        })
        .from(stockMovement)
        .innerJoin(
          product,
          and(eq(product.orgId, stockMovement.orgId), eq(product.id, stockMovement.productId)),
        )
        .where(and(eq(stockMovement.orgId, orgId), inArray(stockMovement.documentId, priced)))
    : [];
  const items = page.map((row) =>
    iso({
      ...row,
      ...summarize(
        row.kind,
        movements.filter((movement) => movement.documentId === row.id),
      ),
    }),
  );
  const tally = await db
    .select({ kind: stockDocument.kind, total: sql<number>`count(*)`.mapWith(Number) })
    .from(stockDocument)
    .where(inBranch)
    .groupBy(stockDocument.kind);
  const counts = { count: 0, receipt: 0, adjustment: 0 };
  for (const { kind: found, total } of tally) counts[found] = total;
  return { items, nextCursor: rows.length > limit ? items[limit - 1]!.id : null, counts };
}

/** One record with the movements it posted, by product name. A count line equal to on hand posted none. */
export async function readDocument(db: Queryable, orgId: string, id: string, onlyBranch?: string) {
  if (!v.is(uuidV7Schema, id)) throw new StockError("INVALID_REFERENCE", "Invalid stock record id");
  const [head] = await selectDocuments(db).where(
    and(
      eq(stockDocument.orgId, orgId),
      eq(stockDocument.id, id),
      onlyBranch ? eq(stockDocument.branchId, onlyBranch) : undefined,
    ),
  );
  if (!head) throw notFound("Stock record");
  const lines = await db
    .select({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      baseUnit: product.baseUnit,
      quantityThousandths: stockMovement.quantityThousandths,
      unitCost: stockMovement.unitCost,
    })
    .from(stockMovement)
    .innerJoin(
      product,
      and(eq(product.orgId, stockMovement.orgId), eq(product.id, stockMovement.productId)),
    )
    .where(and(eq(stockMovement.orgId, orgId), eq(stockMovement.documentId, id)))
    .orderBy(asc(product.name), asc(product.id));
  return { ...iso(head), ...summarize(head.kind, lines), lines };
}
