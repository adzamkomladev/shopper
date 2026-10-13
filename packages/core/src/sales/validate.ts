import { and, desc, eq, isNull, lte } from "drizzle-orm";
import { canonicalJson, type CommandContext } from "@shopper/audit";
import {
  branch,
  cashierSession,
  device,
  deviceCredential,
  member,
  product,
  price,
  taxClass,
  taxRule,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { add, money } from "@shopper/money";
import { snapshotLine } from "@shopper/tax";
import type { SaleSnapshot } from "../schemas/till/sale";
import { SaleError } from "./error";

export interface UploadPrincipal {
  orgId: string;
  deviceId: string;
  branchId: string;
  storeId: string;
}

export async function validateAuthority(
  tx: ShopperTransaction,
  ctx: CommandContext,
  principal: UploadPrincipal,
  snapshot: SaleSnapshot,
  proofHash: string,
) {
  if (
    snapshot.orgId !== principal.orgId ||
    snapshot.deviceId !== principal.deviceId ||
    snapshot.branchId !== principal.branchId ||
    snapshot.storeId !== principal.storeId ||
    snapshot.id !== snapshot.localId
  )
    throw new SaleError("SCOPE", "Sale is outside the enrolled device scope");
  const [registered] = await tx
    .select()
    .from(deviceCredential)
    .innerJoin(
      device,
      and(eq(device.orgId, deviceCredential.orgId), eq(device.id, deviceCredential.deviceId)),
    )
    .innerJoin(branch, and(eq(branch.orgId, device.orgId), eq(branch.id, device.branchId)))
    .where(
      and(
        eq(deviceCredential.orgId, ctx.orgId),
        eq(deviceCredential.deviceId, principal.deviceId),
        eq(device.branchId, principal.branchId),
        eq(branch.storeId, principal.storeId),
        isNull(deviceCredential.revokedAt),
      ),
    );
  const [session] = await tx
    .select()
    .from(cashierSession)
    .where(
      and(
        eq(cashierSession.orgId, ctx.orgId),
        eq(cashierSession.id, snapshot.sessionId),
        eq(cashierSession.deviceId, principal.deviceId),
        eq(cashierSession.branchId, principal.branchId),
        eq(cashierSession.userId, snapshot.cashierId),
        eq(cashierSession.tokenHash, proofHash),
        isNull(cashierSession.revokedAt),
      ),
    );
  const [membership] = await tx
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.orgId, ctx.orgId), eq(member.userId, snapshot.cashierId)));
  const time = new Date(snapshot.deviceTime);
  if (
    !registered ||
    !session ||
    !membership ||
    !session.permissions.includes("sale.create") ||
    time < session.issuedAt ||
    time >= session.expiresAt
  )
    throw new SaleError("INVALID_SESSION", "Sale lacks valid historical cashier authority");
  ctx.role = session.roleName;
}

export async function validateReferences(
  tx: ShopperTransaction,
  orgId: string,
  snapshot: SaleSnapshot,
) {
  const time = new Date(snapshot.deviceTime);
  const on = time.toISOString().slice(0, 10); // Accra uses UTC year-round.
  const [rule] = await tx
    .select()
    .from(taxRule)
    .where(and(eq(taxRule.orgId, orgId), lte(taxRule.effectiveFrom, on)))
    .orderBy(desc(taxRule.effectiveFrom))
    .limit(1);
  if (!rule) throw new SaleError("INVALID_REFERENCE", "No dated tax rule for this sale");
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
  for (const line of snapshot.lines) {
    if (lineIds.has(line.id)) throw new SaleError("INVALID_EVENT", "Duplicate sale line identity");
    lineIds.add(line.id);
    const [reference] = await tx
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
    if (
      !reference ||
      (reference.price.branchId !== null && reference.price.branchId !== snapshot.branchId) ||
      reference.price.validFrom > time ||
      (reference.price.validTo && reference.price.validTo <= time) ||
      line.tax.unitPrice !== reference.price.amount ||
      line.tax.discount !== 0 ||
      line.tax.priceMode !== "inclusive" ||
      line.tax.taxClass !== reference.taxClass.code ||
      line.tax.on !== on ||
      canonicalJson(line.tax.rule) !== canonicalJson(capturedRule)
    )
      throw new SaleError("INVALID_REFERENCE", "Captured price or dated tax reference is invalid");
    const expected = snapshotLine({ ...line.tax, rule: capturedRule });
    if (canonicalJson(expected) !== canonicalJson(line.tax))
      throw new SaleError("INVALID_TOTALS", "Sale line arithmetic is invalid");
    for (const key of Object.keys(totals) as (keyof typeof totals)[])
      totals[key] = add(totals[key], line.tax[key]);
  }
  if (canonicalJson(totals) !== canonicalJson(snapshot.totals))
    throw new SaleError("INVALID_TOTALS", "Sale totals do not match its lines");
}
