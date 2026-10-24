import type { UploadPrincipal } from "./types";
export type { UploadPrincipal } from "./types";
import { and, desc, eq, lte } from "drizzle-orm";
import { canonicalJson, type CommandContext } from "@shopper/audit";
import { org, product, price, taxClass, taxRule, type ShopperTransaction } from "@shopper/db-pg";
import { add, money } from "@shopper/money";
import { expectedLine } from "./labels";
import { hasGrant, overrideAuthority, sessionAuthority } from "./authority";
import type { SaleSnapshot } from "../schemas/till/sale";
import { SaleError } from "./error";

export async function validateAuthority(
  tx: ShopperTransaction,
  ctx: CommandContext,
  principal: UploadPrincipal,
  snapshot: SaleSnapshot,
  proofHash: string,
  occurredAt = new Date(new Date(snapshot.deviceTime).valueOf() - snapshot.clockOffsetMs),
) {
  if (
    snapshot.orgId !== principal.orgId ||
    snapshot.deviceId !== principal.deviceId ||
    snapshot.branchId !== principal.branchId ||
    snapshot.storeId !== principal.storeId ||
    snapshot.id !== snapshot.localId
  )
    throw new SaleError("SCOPE", "Sale is outside the enrolled device scope");
  const time = occurredAt;
  const session = await sessionAuthority(
    tx,
    ctx,
    principal,
    snapshot,
    proofHash,
    time,
    "sale.create",
  );
  if (
    snapshot.lines.some((line) => line.discount > 0) &&
    !(
      session.permissions.includes("sale.discount") &&
      (await hasGrant(tx, ctx.orgId, snapshot.cashierId, "sale.discount"))
    )
  )
    throw new SaleError("INVALID_SESSION", "Sale discount lacks cashier permission");
  await overrideAuthority(tx, ctx, session, snapshot);
  ctx.role = session.roleName;
}

export async function validateReferences(
  tx: ShopperTransaction,
  orgId: string,
  snapshot: SaleSnapshot,
  occurredAt = new Date(new Date(snapshot.deviceTime).valueOf() - snapshot.clockOffsetMs),
) {
  const time = occurredAt;
  const on = time.toISOString().slice(0, 10); // Accra uses UTC year-round.
  const [rule] = await tx
    .select()
    .from(taxRule)
    .where(and(eq(taxRule.orgId, orgId), lte(taxRule.effectiveFrom, on)))
    .orderBy(desc(taxRule.effectiveFrom))
    .limit(1);
  if (!rule) throw new SaleError("INVALID_REFERENCE", "No dated tax rule for this sale");
  const [seller] = await tx
    .select({ vatRegisteredFrom: org.vatRegisteredFrom })
    .from(org)
    .where(eq(org.id, orgId));
  const registered = seller!.vatRegisteredFrom !== null && seller!.vatRegisteredFrom <= on;
  const capturedRule = {
    id: rule.id,
    effectiveFrom: rule.effectiveFrom,
    vatBps: rule.vatBps,
    nhilBps: rule.nhilBps,
    getfundBps: rule.getfundBps,
    covidBps: rule.covidBps,
  };
  const totals = {
    base: money(0),
    vat: money(0),
    nhil: money(0),
    getfund: money(0),
    covid: money(0),
    gross: money(0),
    roundingAdjustment: money(0),
  };
  const lineIds = new Set<string>();
  const references = new Map<
    string,
    {
      product: typeof product.$inferSelect;
      price: typeof price.$inferSelect;
      taxClass: typeof taxClass.$inferSelect;
    }
  >();
  for (const line of snapshot.lines) {
    if (lineIds.has(line.id)) throw new SaleError("INVALID_EVENT", "Duplicate sale line identity");
    lineIds.add(line.id);
    const referenceKey = `${line.priceId}:${line.productId}:${line.tax.taxClass}`;
    let reference = references.get(referenceKey);
    if (!reference) {
      [reference] = await tx
        .select({ product, price, taxClass })
        .from(price)
        .innerJoin(product, and(eq(product.orgId, price.orgId), eq(product.id, price.productId)))
        .innerJoin(
          taxClass,
          and(eq(taxClass.orgId, product.orgId), eq(taxClass.code, line.tax.taxClass)),
        )
        .where(
          and(eq(price.orgId, orgId), eq(price.id, line.priceId), eq(product.id, line.productId)),
        );
      if (reference) references.set(referenceKey, reference);
    }
    if (
      !reference ||
      (reference.price.branchId !== null && reference.price.branchId !== snapshot.branchId) ||
      reference.price.validFrom > time ||
      (reference.price.validTo && reference.price.validTo <= time) ||
      !unitPriceMatches(line, reference.price.amount) ||
      line.tax.discount !== line.discount ||
      line.tax.registered !== registered ||
      // Either price mode is accepted (a till may quote before a mode change reaches it); a price label is the
      // customer's gross, so it is always inclusive.
      (line.label?.kind === "price" && line.tax.priceMode !== "inclusive") ||
      line.tax.taxClass !== reference.taxClass.code ||
      line.tax.on !== on ||
      canonicalJson(line.tax.rule) !== canonicalJson(capturedRule)
    )
      throw new SaleError("INVALID_REFERENCE", "Captured price or dated tax reference is invalid");
    const expected = await expectedLine(tx, orgId, line, snapshot.branchId, time);
    if (canonicalJson(expected) !== canonicalJson(line.tax))
      throw new SaleError("INVALID_TOTALS", "Sale line arithmetic is invalid");
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] = add(totals[key], line.tax[key]);
  }
  if (canonicalJson(totals) !== canonicalJson(snapshot.totals))
    throw new SaleError("INVALID_TOTALS", "Sale totals do not match its lines");
}

/** The captured unit price is the price row, or an override of exactly that row's price to a different one. */
function unitPriceMatches(line: SaleSnapshot["lines"][number], listed: number) {
  if (!line.override) return line.tax.unitPrice === listed;
  return (
    line.override.listPrice === listed &&
    line.tax.unitPrice !== listed &&
    line.label?.kind !== "price"
  );
}
