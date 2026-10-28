import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/core";
import { seedAuthRoles } from "@shopper/auth";
import { buildInfo } from "@shopper/config";
import { money } from "@shopper/money";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { ids, config as saleConfig, references } from "../sales";

export const appVersion = buildInfo.version;
export const syncProtocol = buildInfo.syncProtocol;
export const context = provisioningContext(ids.org);

const seed = defineCommand({
  name: "sync.test.seed",
  async run(tx, ctx) {
    const [store] = await tx
      .insert(schema.store)
      .values({ id: saleConfig.storeId, orgId: ctx.orgId, name: "Sync store" })
      .returning();
    if (!store) throw new Error("Expected seeded store");
    const [branch] = await tx
      .insert(schema.branch)
      .values({ id: ids.branch, orgId: ctx.orgId, storeId: store.id, name: "Main" })
      .returning();
    const [user] = await tx
      .insert(schema.user)
      .values({
        id: ids.cashier,
        orgId: ctx.orgId,
        name: "Cashier",
        email: "sync-cashier@test.invalid",
      })
      .returning();
    const [role] = await tx
      .select()
      .from(schema.role)
      .where(and(eq(schema.role.orgId, ctx.orgId), eq(schema.role.name, "cashier")));
    const [standardTaxClass] = await tx
      .select()
      .from(schema.taxClass)
      .where(and(eq(schema.taxClass.orgId, ctx.orgId), eq(schema.taxClass.code, "standard")));
    if (!branch || !user || !role || !standardTaxClass)
      throw new Error("Expected seeded cashier data");
    await tx.insert(schema.member).values({
      orgId: ctx.orgId,
      organizationId: ctx.orgId,
      userId: user.id,
      roleId: role.id,
      role: "member",
    });
    await tx.delete(schema.taxRule).where(eq(schema.taxRule.orgId, ctx.orgId));
    await tx.insert(schema.taxRule).values(references.taxRules);
    await tx.insert(schema.product).values({
      id: ids.product,
      orgId: ctx.orgId,
      sku: "MILK-001",
      name: "Fresh milk",
      taxClassId: standardTaxClass.id,
      baseUnit: "each",
    });
    await tx.insert(schema.price).values({
      id: ids.branchPrice,
      orgId: ctx.orgId,
      productId: ids.product,
      branchId: branch.id,
      amount: money(12_000),
      validFrom: new Date("2025-06-01T00:00:00Z"),
    });
    return { storeId: store.id, branchId: branch.id, userId: user.id, roleId: role.id };
  },
  audit: (_input, output) => output,
});

export const ageSession = defineCommand({
  name: "sync.test.age-session",
  async run(tx, _ctx, input: { sessionId: string; issuedAt: Date; expiresAt: Date }) {
    await tx
      .update(schema.cashierSession)
      .set({ issuedAt: input.issuedAt, expiresAt: input.expiresAt })
      .where(eq(schema.cashierSession.id, input.sessionId));
    return {};
  },
  audit: () => ({}),
});

const seedForeignProduct = defineCommand({
  name: "sync.test.foreign-product",
  async run(tx, ctx) {
    const [standardTaxClass] = await tx
      .select()
      .from(schema.taxClass)
      .where(and(eq(schema.taxClass.orgId, ctx.orgId), eq(schema.taxClass.code, "standard")));
    if (!standardTaxClass) throw new Error("Expected provisioned standard tax class");
    await tx.insert(schema.product).values({
      id: ids.otherProduct,
      orgId: ctx.orgId,
      sku: "OTHER-001",
      name: "Other tenant product",
      taxClassId: standardTaxClass.id,
      baseUnit: "each",
    });
    return {};
  },
  audit: () => ({}),
});

export async function seedServerDatabase(db: import("@shopper/db-pg").ShopperDatabase) {
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Sync integration", slug: "sync-shop" });
  const other = provisioningContext(ids.otherOrg);
  await provisionOrg(db, other, { name: "Other sync tenant" });
  await seedAuthRoles(db, context, undefined);
  const primary = await seed(db, context, undefined);
  await seedForeignProduct(db, other, undefined);
  return primary;
}
