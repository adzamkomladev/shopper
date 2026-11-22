import { and, eq, ne, notInArray, or, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { relayImageId } from "@shopper/assets";
import {
  branch,
  branchFulfilment,
  category,
  onlineAvailability,
  org,
  price,
  product,
  store,
  taxClass,
  taxRule,
} from "@shopper/db-pg";
import { money } from "@shopper/money";
import type { Blobs } from "@shopper/ports";
import type { RelayBatch } from "../schemas/relay";

const AVAILABILITY_CHUNK = 5000;

/**
 * A box publishes catalogue rows to its relay org: the only writer the relay lock lets through (it sets
 * `shopper.relay` for this transaction). Rows are upserted by the box's ids, so a retried batch changes nothing, and an
 * id that is another org's row is left alone. Prices are append-only versions, so one already here is kept as is.
 * A product's photo must already be in storage (offered on `/relay/images`). The relay org's chain records each batch.
 */
export const publishRelay = defineCommand({
  name: "relay.publish",
  async run(tx, context, input: { batch: RelayBatch; blobs?: Blobs }) {
    const batch = input.batch;
    const orgId = context.orgId;
    await tx.execute(sql`SELECT set_config('shopper.relay', ${orgId}, true)`);
    // The box's own tax profile, so checkout taxes and the invoice the box fiscalises agree (Day 51).
    for (const row of batch.shop.filter((entry) => entry.id === orgId)) {
      await tx
        .update(org)
        .set({ tin: row.tin, vatRegisteredFrom: row.vatRegisteredFrom, priceMode: row.priceMode })
        .where(eq(org.id, orgId));
      // And its tax rules, the whole set (Day 52): the box deletes only rules not yet in force, which no sale used.
      // A box from before Day 52 sends none; its relay keeps what it has.
      const rules = row.taxRules ?? [];
      if (rules.length)
        await tx.delete(taxRule).where(
          and(
            eq(taxRule.orgId, orgId),
            or(
              notInArray(
                taxRule.id,
                rules.map((rule) => rule.id),
              ),
              // A rule moved off a date another now takes: clear it first, the insert would clash.
              ...rules.map((rule) =>
                and(eq(taxRule.effectiveFrom, rule.effectiveFrom), ne(taxRule.id, rule.id)),
              ),
            ),
          ),
        );
      for (const rule of rules)
        await tx
          .insert(taxRule)
          .values({ orgId, ...rule })
          .onConflictDoUpdate({
            target: taxRule.id,
            set: { ...rule, updatedAt: sql`now()` },
            setWhere: eq(taxRule.orgId, orgId),
          });
    }
    for (const row of batch.stores)
      await tx
        .insert(store)
        .values({ orgId, ...row })
        .onConflictDoUpdate({
          target: store.id,
          set: { name: row.name, updatedAt: sql`now()` },
          setWhere: eq(store.orgId, orgId),
        });
    for (const row of batch.branches)
      await tx
        .insert(branch)
        .values({ orgId, ...row })
        .onConflictDoUpdate({
          target: branch.id,
          set: { name: row.name, updatedAt: sql`now()` },
          setWhere: eq(branch.orgId, orgId),
        });
    for (const row of batch.fulfilment) {
      const fields = { ...row, deliveryFee: money(row.deliveryFee), updatedAt: sql`now()` };
      await tx
        .insert(branchFulfilment)
        .values({ orgId, ...fields })
        .onConflictDoUpdate({
          target: branchFulfilment.id,
          set: fields,
          setWhere: eq(branchFulfilment.orgId, orgId),
        });
    }
    for (const row of batch.categories)
      await tx
        .insert(category)
        .values({ orgId, ...row })
        .onConflictDoUpdate({
          target: category.id,
          set: {
            name: row.name,
            parentId: row.parentId,
            onlineVisible: row.onlineVisible,
            updatedAt: sql`now()`,
          },
          setWhere: eq(category.orgId, orgId),
        });
    const classes = new Map(
      (
        await tx
          .select({ id: taxClass.id, code: taxClass.code })
          .from(taxClass)
          .where(eq(taxClass.orgId, orgId))
      ).map((row) => [row.code, row.id]),
    );
    for (const row of batch.products) {
      const fields = {
        sku: row.sku,
        name: row.name,
        categoryId: row.categoryId,
        taxClassId: classes.get(row.taxClass)!,
        baseUnit: row.baseUnit,
        onlineVisible: row.onlineVisible,
        imageAssetId: row.image ? await relayImageId(tx, input.blobs, orgId, row.image) : null,
      };
      await tx
        .insert(product)
        .values({ orgId, id: row.id, ...fields })
        .onConflictDoUpdate({
          target: product.id,
          set: { ...fields, updatedAt: sql`now()` },
          setWhere: eq(product.orgId, orgId),
        });
    }
    if (batch.prices.length)
      await tx
        .insert(price)
        .values(batch.prices.map((row) => ({ orgId, ...row, amount: money(row.amount) })))
        .onConflictDoNothing({ target: price.id });
    const available = batch.availability.flatMap((row) =>
      row.branches.map((entry) => ({
        orgId,
        branchId: entry.branchId,
        productId: row.id,
        quantityThousandths: entry.available,
      })),
    );
    // Chunked: 500 products × many branches would pass PostgreSQL's 65 535 bound parameters in one insert.
    for (let from = 0; from < available.length; from += AVAILABILITY_CHUNK)
      await tx
        .insert(onlineAvailability)
        .values(available.slice(from, from + AVAILABILITY_CHUNK))
        .onConflictDoUpdate({
          target: [
            onlineAvailability.orgId,
            onlineAvailability.branchId,
            onlineAvailability.productId,
          ],
          set: { quantityThousandths: sql`excluded.quantity_thousandths`, updatedAt: sql`now()` },
        });
    return {
      shop: batch.shop.length,
      stores: batch.stores.length,
      branches: batch.branches.length,
      fulfilment: batch.fulfilment.length,
      categories: batch.categories.length,
      products: batch.products.length,
      prices: batch.prices.length,
      availability: batch.availability.length,
    };
  },
  audit: (_input, output) => output,
});
