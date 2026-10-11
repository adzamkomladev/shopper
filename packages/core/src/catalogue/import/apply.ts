import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  price,
  product,
  productBarcode,
  productImport,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { ManagementError } from "../../management";
import type { Headers } from "./parse";
import { fieldSet, planImport, type FieldSet } from "./plan";
import { categoryOf, chunks, ensureRefs, loadRefs, supplierOf } from "./refs";
import type { CleanRow, ImportError } from "./validate";

export type ImportInput = {
  fileName: string;
  sha256: string;
  rowsTotal: number;
  rows: CleanRow[];
  errors: ImportError[];
  headers: Headers;
};
const summary = (r: Awaited<ReturnType<typeof importRun>>) => ({
  sha256: r.sha256,
  rowsTotal: r.rowsTotal,
  rowsOk: r.rowsOk,
  rowsFailed: r.rowsFailed,
  created: r.created,
  updated: r.updated,
  unchanged: r.unchanged,
  pricesAdded: r.pricesAdded,
});

/** One transaction, one audit row. The full row report lives in product_import, not in the chain. */
export const importCatalogue = defineCommand({
  name: "catalogue.import",
  run: importRun,
  audit: (_input, result) => summary(result),
  details: (_input, result) => ({
    entity: "product_import",
    entityId: result.id,
    after: summary(result),
  }),
});

async function importRun(tx: ShopperTransaction, context: CommandContext, input: ImportInput) {
  const { orgId } = context;
  // Taken after the org lock defineCommand holds, so a concurrent import's later price is seen.
  const at = new Date();
  const {
    planned,
    errors: conflicts,
    counts,
  } = await planImport(tx, orgId, input.rows, input.headers, at);
  const refs = await loadRefs(tx, orgId);
  await ensureRefs(
    tx,
    orgId,
    planned.map((p) => p.row),
    refs,
  );
  const found = (id: string | null | undefined, what: string) => {
    if (id === undefined) throw new Error(`Import ${what} was not created before use`);
    return id;
  };
  const taxId = (row: CleanRow) => {
    const id = refs.tax.get(row.taxClass);
    if (!id) throw new ManagementError("Unknown tax class", 400);
    return id;
  };
  const fields = (row: CleanRow, use: FieldSet) => ({
    name: row.name,
    ...(use.unit && { baseUnit: row.baseUnit }),
    ...(use.online && { onlineVisible: row.onlineVisible }),
    ...(use.tax && { taxClassId: taxId(row) }),
    ...(use.category && { categoryId: found(categoryOf(refs, row), "category") }),
    ...(use.supplier && { supplierId: found(supplierOf(refs, row), "supplier") }),
  });

  const ids = new Map(planned.filter((p) => p.existingId).map((p) => [p.row.sku, p.existingId!]));
  const fresh = planned.filter((p) => !p.existingId);
  for (const part of chunks(fresh))
    for (const made of await tx
      .insert(product)
      .values(
        part.map((p) => ({
          name: p.row.name,
          baseUnit: p.row.baseUnit,
          onlineVisible: p.row.onlineVisible,
          taxClassId: taxId(p.row),
          categoryId: found(categoryOf(refs, p.row), "category"),
          supplierId: found(supplierOf(refs, p.row), "supplier"),
          orgId,
          sku: p.row.sku,
        })),
      )
      .returning({ id: product.id, sku: product.sku }))
      ids.set(made.sku, made.id);

  // ponytail: changed rows are updated one by one; a bulk UPDATE .. FROM VALUES if re-imports of
  // mostly-changed 20k files prove slow.
  for (const p of planned.filter((p) => p.existingId && p.fieldsChanged))
    await tx
      .update(product)
      .set(fields(p.row, fieldSet(input.headers, false)))
      .where(and(eq(product.orgId, orgId), eq(product.id, p.existingId!)));
  for (const p of planned)
    for (const fix of p.quantityFixes)
      await tx
        .update(productBarcode)
        .set({ quantityThousandths: fix.quantityThousandths })
        .where(and(eq(productBarcode.orgId, orgId), eq(productBarcode.code, fix.code)));

  const codes = planned.flatMap((p) =>
    p.newBarcodes.map((b) => ({
      orgId,
      productId: ids.get(p.row.sku)!,
      code: b.code,
      quantityThousandths: b.quantityThousandths,
    })),
  );
  for (const part of chunks(codes)) await tx.insert(productBarcode).values(part);
  const prices = planned
    .filter((p) => p.priceNeeded)
    .map((p) => ({
      orgId,
      productId: ids.get(p.row.sku)!,
      amount: p.row.amount,
      validFrom: at,
    }));
  for (const part of chunks(prices)) await tx.insert(price).values(part);

  const errors = [...input.errors, ...conflicts].sort((a, b) => a.row - b.row);
  const rowsOk = planned.length;
  const rowsFailed = new Set(errors.map((e) => e.row)).size;
  const [saved] = await tx
    .insert(productImport)
    .values({
      orgId,
      fileName: input.fileName,
      sha256: input.sha256,
      rowsTotal: input.rowsTotal,
      rowsOk,
      rowsFailed,
      report: { errors },
      priceValidFrom: at,
      actorId: context.actorId,
    })
    .returning({ id: productImport.id });
  return {
    id: saved!.id,
    sha256: input.sha256,
    rowsTotal: input.rowsTotal,
    rowsOk,
    rowsFailed,
    ...counts,
    errors,
  };
}
