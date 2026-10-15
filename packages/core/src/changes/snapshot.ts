import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import {
  branch,
  org,
  price,
  product,
  store,
  storeChange,
  taxClass,
  taxRule,
  type ShopperDatabase,
} from "@shopper/db-pg";
import type { CommandContext } from "@shopper/audit";
import { saveSnapshotAsset } from "@shopper/assets";
import type { Blobs } from "@shopper/ports";
import { listBarcodeMappings } from "../catalogue/mappings/queries";
import { loadBarcodes } from "./barcodes";
import { FEED_VERSION } from "./record";
import { priceUpsert, productUpsert, taxRuleUpsert } from "./project";

export async function buildSnapshot(
  database: ShopperDatabase,
  blobs: Blobs,
  scope: { orgId: string; storeId: string },
  context: CommandContext,
) {
  const snapshot = await database.transaction(
    async (tx) => {
      const [found] = await tx
        .select({ id: store.id })
        .from(store)
        .where(and(eq(store.orgId, scope.orgId), eq(store.id, scope.storeId)));
      if (!found) throw new Error("Store outside tenant scope");
      const [sequence] = await tx
        .select({ cursor: sql<string>`coalesce(max(${storeChange.seq}), 0)::text` })
        .from(storeChange)
        .where(and(eq(storeChange.orgId, scope.orgId), eq(storeChange.storeId, scope.storeId)));
      const [settings] = await tx
        .select({ cashRounding: org.cashRounding })
        .from(org)
        .where(eq(org.id, scope.orgId));
      const products = await tx
        .select({
          id: product.id,
          sku: product.sku,
          name: product.name,
          baseUnit: product.baseUnit,
          archivedAt: product.archivedAt,
          taxClass: taxClass.code,
        })
        .from(product)
        .innerJoin(
          taxClass,
          and(eq(taxClass.orgId, product.orgId), eq(taxClass.id, product.taxClassId)),
        )
        .where(and(eq(product.orgId, scope.orgId), isNull(product.archivedAt)));
      const barcodes = await loadBarcodes(
        tx,
        scope.orgId,
        products.map((row) => row.id),
      );
      const branches = tx
        .select({ id: branch.id })
        .from(branch)
        .where(and(eq(branch.orgId, scope.orgId), eq(branch.storeId, scope.storeId)));
      const prices = await tx
        .select()
        .from(price)
        .where(
          and(
            eq(price.orgId, scope.orgId),
            or(isNull(price.branchId), sql`${price.branchId} in (${branches})`),
            or(isNull(price.validTo), gt(price.validTo, new Date())),
          ),
        );
      const taxes = await tx.select().from(taxRule).where(eq(taxRule.orgId, scope.orgId));
      return {
        v: FEED_VERSION,
        orgId: scope.orgId,
        storeId: scope.storeId,
        cursor: sequence!.cursor,
        reference: {
          products: products.map(
            (row) =>
              productUpsert(scope.orgId, { ...row, barcodes: barcodes.get(row.id)! }).payload,
          ),
          prices: prices.map((row) => priceUpsert(row).payload),
          taxRules: taxes.map((row) => taxRuleUpsert(row).payload),
          barcodeMappings: await listBarcodeMappings(tx, scope.orgId),
          cashRounding: settings!.cashRounding, // the store row read above belongs to this org
        },
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
  const key = `snapshots/${scope.orgId}/${scope.storeId}/v${snapshot.v}/${snapshot.cursor}.json.gz`;
  const existing = await blobs.get(scope.orgId, key);
  if (existing) {
    await saveSnapshotAsset(database, context, { blobs, key, bytes: existing });
    return existing;
  }
  const stream = new Blob([JSON.stringify(snapshot)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  // shortcut: Blobs accepts bytes; stream reads/uploads when catalogue size threatens Worker memory.
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  await saveSnapshotAsset(database, context, { blobs, key, bytes });
  return bytes;
}
