import * as v from "valibot";
import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { price, product } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { affectedStores, priceUpsert, recordChanges } from "../../changes";
import { managementJson, ManagementError } from "../../management";
import { priceAtQuery, priceInput } from "../../schemas/catalogue/inputs";
import type { Queryable } from "../../types";
import { recordId } from "../records";

type Price = typeof price.$inferSelect;
export const priceView = (row: Price) => ({
  id: row.id,
  branchId: row.branchId,
  amount: row.amount,
  validFrom: row.validFrom.toISOString(),
  validTo: row.validTo?.toISOString() ?? null,
  reason: row.reason,
});

/** Appends a price version. The reason arrives as `context.reason`; versions are never edited. */
export const setPrice = defineCommand({
  name: "price.set",
  async run(tx, context, input: { productId: string; data: unknown }) {
    const productId = recordId(input.productId);
    const data = v.parse(priceInput, input.data);
    const [found] = await tx
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.orgId, context.orgId), eq(product.id, productId)));
    if (!found) throw new ManagementError("Record not found");
    const before = await priceAt(tx, {
      orgId: context.orgId,
      productId,
      branchId: data.branchId,
      at: data.validFrom,
    });
    const [row] = await tx
      .insert(price)
      .values({
        orgId: context.orgId,
        productId,
        branchId: data.branchId,
        amount: money(data.amount),
        validFrom: data.validFrom ?? new Date(),
        reason: context.reason,
      })
      .returning();
    await recordChanges(
      tx,
      context.orgId,
      [priceUpsert(row!)],
      await affectedStores(tx, context.orgId, row!.branchId),
    );
    return managementJson({
      productId,
      before: before && priceView(before),
      after: priceView(row!),
    });
  },
  audit: (input, result) => ({ productId: result.productId, priceId: result.after.id }),
  // Filed under the product, with the version it replaced, so the product's history answers who changed its price.
  details: (_input, result) => ({
    entity: "product",
    entityId: result.productId,
    before: result.before,
    after: { productId: result.productId, ...result.after },
  }),
});

/** The version in force at `at`: a branch override beats the org price, then the latest start wins. */
export async function priceAt(
  db: Queryable,
  args: { orgId: string; productId: string; branchId?: string; at?: Date },
) {
  const at = args.at ?? new Date();
  const [row] = await db
    .select()
    .from(price)
    .where(
      and(
        eq(price.orgId, args.orgId),
        eq(price.productId, args.productId),
        args.branchId
          ? or(eq(price.branchId, args.branchId), isNull(price.branchId))
          : isNull(price.branchId),
        lte(price.validFrom, at),
        or(isNull(price.validTo), gt(price.validTo, at)),
      ),
    )
    .orderBy(sql`(${price.branchId} IS NOT NULL) DESC`, desc(price.validFrom), desc(price.id))
    .limit(1);
  return row ?? null;
}

export async function readPriceAt(db: Queryable, orgId: string, rawQuery: unknown) {
  const { productId, branchId, at } = v.parse(priceAtQuery, rawQuery);
  const row = await priceAt(db, { orgId, productId, branchId, at });
  return row && priceView(row);
}
