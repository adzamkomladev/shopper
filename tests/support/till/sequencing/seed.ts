import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { money } from "@shopper/money";
import { goldenSale } from "../../../fixtures/sales/golden";
import type { PendingSaleSnapshot } from "./event";

export function seedPendingSale(
  db: import("@shopper/db-pg").ShopperDatabase,
  context: CommandContext,
  sale: PendingSaleSnapshot,
) {
  return seed(db, context, sale);
}

const seed = defineCommand({
  name: "conformance.sale.accepted-fixture",
  async run(tx, context, sale: PendingSaleSnapshot) {
    const [standard] = await tx
      .select()
      .from(schema.taxClass)
      .where(and(eq(schema.taxClass.orgId, context.orgId), eq(schema.taxClass.code, "standard")));
    const [cashierRole] = await tx
      .select()
      .from(schema.role)
      .where(and(eq(schema.role.orgId, context.orgId), eq(schema.role.name, "cashier")));
    if (!standard || !cashierRole || !sale.line)
      throw new Error("Expected provisioned sale reference data");
    await tx.insert(schema.branch).values({
      id: sale.branchId,
      orgId: context.orgId,
      storeId: sale.storeId,
      name: "Conformance branch",
    });
    await tx.insert(schema.store).values({
      id: sale.otherStoreId,
      orgId: context.orgId,
      name: "Other conformance store",
    });
    await tx.insert(schema.user).values({
      id: sale.cashierId,
      orgId: context.orgId,
      name: "Conformance cashier",
      email: `${sale.cashierId}@conformance.invalid`,
    });
    await tx.insert(schema.member).values({
      orgId: context.orgId,
      organizationId: context.orgId,
      userId: sale.cashierId,
      roleId: cashierRole.id,
      role: "member",
    });
    await tx.insert(schema.device).values({
      id: sale.deviceId,
      orgId: context.orgId,
      branchId: sale.branchId,
      name: "Conformance till",
    });
    await tx.insert(schema.device).values({
      id: sale.otherDeviceId,
      orgId: context.orgId,
      branchId: sale.branchId,
      name: "Other conformance till",
    });
    await tx.insert(schema.cashierSession).values({
      id: sale.sessionId,
      orgId: context.orgId,
      deviceId: sale.deviceId,
      branchId: sale.branchId,
      userId: sale.cashierId,
      roleId: cashierRole.id,
      tokenHash: sale.localId,
      issuedAt: new Date(sale.deviceTime),
      expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });
    await tx.insert(schema.taxRule).values({
      id: sale.taxRuleId,
      orgId: context.orgId,
      effectiveFrom: "2025-01-01",
      vatBps: 1_500,
      nhilBps: 250,
      getfundBps: 250,
      covidBps: 0,
      source: "conformance fixture",
    });
    await tx.insert(schema.product).values({
      id: sale.productId,
      orgId: context.orgId,
      sku: sale.localId,
      name: "Conformance product",
      taxClassId: standard.id,
      baseUnit: "each",
    });
    await tx.insert(schema.price).values({
      id: sale.priceId,
      orgId: context.orgId,
      productId: sale.productId,
      branchId: sale.branchId,
      amount: money(goldenSale.unitPrice),
      validFrom: new Date("2025-01-01T00:00:00.000Z"),
    });
    await tx.insert(schema.sale).values({
      id: sale.localId,
      orgId: context.orgId,
      deviceId: sale.deviceId,
      localId: sale.localId,
      storeId: sale.storeId,
      branchId: sale.branchId,
      cashierId: sale.cashierId,
      sessionId: sale.sessionId,
      appVersion: sale.appVersion,
      deviceTime: new Date(sale.deviceTime),
      acceptedAt: new Date(),
      payload: sale.payload,
      contentHash: sale.contentHash,
      storeSequence: null,
    });
    await tx.insert(schema.saleLine).values({
      id: sale.lineId,
      orgId: context.orgId,
      saleId: sale.localId,
      productId: sale.productId,
      priceId: sale.priceId,
      taxRuleId: sale.taxRuleId,
      payload: sale.line,
    });
    return { localId: sale.localId };
  },
  audit: (_input, output) => ({ localId: output.localId }),
});
