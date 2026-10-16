import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import {
  member,
  role,
  permission,
  rolePermission,
  cashierSession,
  taxClass,
  taxRule,
  product,
  price,
  productBarcode,
  barcodeMapping,
} from "@shopper/db-pg";
import { openTillDatabase } from "@shopper/adapters-box";
import { provisionTillReference } from "@shopper/core/till";
import { money } from "@shopper/money";
import { goldenReferences } from "../../../fixtures/sales/golden/references";
import { databases, hostConfiguration } from "../../till/server";

export const at = new Date("2026-10-15T12:00:00.000Z");

export async function goldenWorld() {
  const { db, context } = databases();
  const host = await hostConfiguration(":memory:", ["http://localhost"]);
  if (!host.session) throw new Error("Golden till requires a cashier session");
  const permissions = await configure(
    db,
    { ...context, actorId: host.session.userId },
    host.session.id,
  );
  const session = {
    ...host.session,
    roleName: "admin",
    permissions,
    issuedAt: "2026-10-15T00:00:00.000Z",
    expiresAt: "2026-10-16T00:00:00.000Z",
  };
  const scope = {
    orgId: host.identity.orgId,
    deviceId: host.identity.deviceId,
    branchId: host.identity.branchId,
    cashierId: session.userId,
  };
  const command = {
    ...context,
    deviceId: scope.deviceId,
    branchId: scope.branchId,
    actorId: scope.cashierId,
    role: session.roleName,
  };
  const config = {
    orgId: scope.orgId,
    deviceId: scope.deviceId,
    branchId: scope.branchId,
    storeId: host.identity.storeId,
    appVersion: context.appVersion,
    receiptCodes: host.receiptCodes,
    now: () => at,
  };
  const local = openTillDatabase(":memory:");
  await provisionTillReference(local, command, goldenReferences);
  return { db, local, config, session, scope, command };
}

const configure = defineCommand({
  name: "golden.test.configure",
  async run(tx, ctx, sessionId: string) {
    if (!ctx.actorId) throw new Error("Golden fixture needs a cashier");
    const [admin] = await tx
      .select()
      .from(role)
      .where(and(eq(role.orgId, ctx.orgId), eq(role.name, "admin")));
    if (!admin) throw new Error("Expected seeded admin role");
    const grants = await tx
      .select({ code: permission.code })
      .from(rolePermission)
      .innerJoin(
        permission,
        and(
          eq(permission.orgId, rolePermission.orgId),
          eq(permission.id, rolePermission.permissionId),
        ),
      )
      .where(and(eq(rolePermission.orgId, ctx.orgId), eq(rolePermission.roleId, admin.id)));
    const permissions = grants.map((p) => p.code);
    await tx
      .update(member)
      .set({ roleId: admin.id })
      .where(and(eq(member.orgId, ctx.orgId), eq(member.userId, ctx.actorId)));
    await tx
      .update(cashierSession)
      .set({
        roleId: admin.id,
        permissions,
        roleName: "admin",
        issuedAt: new Date("2026-10-15T00:00:00.000Z"),
        expiresAt: new Date("2026-10-16T00:00:00.000Z"),
      })
      .where(eq(cashierSession.id, sessionId));
    const classes = await tx.select().from(taxClass).where(eq(taxClass.orgId, ctx.orgId));
    await tx.delete(taxRule).where(eq(taxRule.orgId, ctx.orgId));
    await tx.insert(taxRule).values(goldenReferences.taxRules);
    for (const p of goldenReferences.products) {
      const tax = classes.find((c) => c.code === p.taxClass);
      if (!tax) throw new Error(`Missing golden tax class ${p.taxClass}`);
      await tx.insert(product).values({
        id: p.id,
        orgId: ctx.orgId,
        sku: p.sku,
        name: p.name,
        baseUnit: p.baseUnit,
        taxClassId: tax.id,
      });
      for (const barcode of p.barcodes)
        await tx.insert(productBarcode).values({ orgId: ctx.orgId, productId: p.id, ...barcode });
    }
    await tx.insert(price).values(
      goldenReferences.prices.map((p) => ({
        ...p,
        amount: money(p.amount),
        validFrom: new Date(p.validFrom),
      })),
    );
    await tx.insert(barcodeMapping).values(
      goldenReferences.barcodeMappings.map((m) => ({
        id: m.id,
        orgId: ctx.orgId,
        prefix: m.prefix,
        kind: m.kind,
        productStart: m.product.start,
        productLength: m.product.length,
        valueStart: m.value.start,
        valueLength: m.value.length,
        decimals: m.decimals,
        unit: "unit" in m ? m.unit : null,
      })),
    );
    return permissions;
  },
  audit: () => ({ fixture: "golden trading day" }),
});
