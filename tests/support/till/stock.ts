import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/core";
import { ageSession, appVersion, context } from "./server/data";
import { config, ids } from "./sales";
import { databases, deviceId, deviceToken, devices, principal } from "./server";

const seed = defineCommand({
  name: "stock.test.seed",
  async run(tx, ctx, input: { userId?: string; productId?: string; onHand?: number; at?: Date }) {
    const [inventory] = await tx
      .select()
      .from(schema.role)
      .where(and(eq(schema.role.orgId, ctx.orgId), eq(schema.role.name, "inventory")));
    const [taxClass] = await tx
      .select()
      .from(schema.taxClass)
      .where(and(eq(schema.taxClass.orgId, ctx.orgId), eq(schema.taxClass.code, "standard")));
    if (input.userId) {
      await tx
        .insert(schema.user)
        .values({
          id: input.userId,
          orgId: ctx.orgId,
          name: "Stock",
          email: `${input.userId}@t.test`,
        })
        .onConflictDoNothing();
      await tx
        .insert(schema.member)
        .values({
          orgId: ctx.orgId,
          organizationId: ctx.orgId,
          userId: input.userId,
          roleId: inventory!.id,
          role: "member",
        })
        .onConflictDoNothing();
    }
    if (input.productId)
      await tx.insert(schema.product).values({
        id: input.productId,
        orgId: ctx.orgId,
        sku: input.productId,
        name: "Stock product",
        taxClassId: taxClass!.id,
        baseUnit: "each",
      });
    if (input.productId && input.onHand)
      await tx.insert(schema.stockMovement).values({
        orgId: ctx.orgId,
        branchId: ids.branch,
        productId: input.productId,
        reason: "adjustment",
        quantityThousandths: input.onHand,
        occurredAt: input.at ?? new Date("2025-12-31T20:00:00.000Z"),
      });
    return {};
  },
  audit: () => ({}),
});

export const principalFor = () => ({
  orgId: context.orgId,
  deviceId,
  branchId: ids.branch,
  storeId: config.storeId,
});

/** A till session for a user holding the seeded `inventory` role (stock.write). */
export async function inventorySession() {
  const { db } = databases();
  const userId = v7();
  await seed(db, context, { userId });
  await devices.assignPin(principal, { userId, pin: "2468" });
  const login = await devices.login({ deviceId, deviceToken, userId, pin: "2468" });
  await ageSession(db, context, {
    sessionId: login.id,
    issuedAt: new Date("2025-12-31T16:00:00.000Z"),
    expiresAt: new Date("2026-01-01T08:00:00.000Z"),
  });
  return { userId, sessionId: login.id, proof: login.token };
}

export async function stockProduct(onHand?: number, at?: Date) {
  const productId = v7();
  await seed(databases().db, context, { productId, onHand, at });
  return productId;
}

export const options = { appVersion };
