import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import type { WorkflowLauncher } from "@shopper/ports";
import { createApi } from "@shopper/api";
import { createAuth, seedAuthRoles } from "@shopper/auth";
import { createDeviceService } from "@shopper/auth/devices";
import { boxCache, boxMomoPayment, boxRealtime } from "@shopper/adapters-box";
import { createPaystack } from "@shopper/core/payments/paystack";
import { sha256 } from "@shopper/utils";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { startPaystackFake, signWebhook } from "../../../tooling/paystack/server";
import { postgresFixture } from "../../fixtures/postgres";

export async function momoFixture() {
  const fixture = await postgresFixture();
  const pool = new Pool({ connectionString: fixture.connectionString });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const context = provisioningContext();
  const orgId = context.orgId;
  await provisionOrg(db, context, { name: "MoMo tenant" });
  await seedAuthRoles(db, context, undefined);
  const ids = { store: v7(), branch: v7(), device: v7(), user: v7() };
  const deviceToken = "a".repeat(64),
    token = "b".repeat(64);
  const tokenHash = await sha256(token),
    deviceHash = await sha256(deviceToken);
  const [role] = await db
    .select()
    .from(schema.role)
    .where(and(eq(schema.role.orgId, orgId), eq(schema.role.name, "cashier")));
  const session = {
    id: v7(),
    token,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    permissions: ["sale.create", "payment.momo"],
    roleName: "cashier",
  };
  await defineCommand({
    name: "test.momo.provision",
    async run(tx) {
      await tx.insert(schema.store).values({ id: ids.store, orgId, name: "Store" });
      await tx
        .insert(schema.branch)
        .values({ id: ids.branch, orgId, storeId: ids.store, name: "Branch", code: "BR1" });
      await tx
        .insert(schema.device)
        .values({ id: ids.device, orgId, branchId: ids.branch, name: "Till", code: "T1" });
      await tx
        .insert(schema.user)
        .values({ id: ids.user, orgId, email: "cashier@example.com", name: "Cashier" });
      await tx
        .insert(schema.member)
        .values({ orgId, organizationId: orgId, userId: ids.user, roleId: role!.id });
      await tx
        .insert(schema.deviceCredential)
        .values({ orgId, deviceId: ids.device, tokenHash: deviceHash });
      await tx.insert(schema.cashierSession).values({
        id: session.id,
        orgId,
        deviceId: ids.device,
        branchId: ids.branch,
        userId: ids.user,
        roleId: role!.id,
        tokenHash,
        permissions: session.permissions,
        roleName: session.roleName,
        issuedAt: new Date(session.issuedAt),
        expiresAt: new Date(session.expiresAt),
      });
      return ids;
    },
    audit: () => ids,
  })(db, context, undefined);
  const fake = await startPaystackFake();
  fake.behave("0551234987", "success");
  fake.behave("0551234986", "send_otp");
  fake.behave("0241234567", "pending");
  fake.behave("0551234984", "error");
  const realtime = boxRealtime();
  const cache = boxCache(":memory:");
  const deps = {
    withDatabase: <T>(run: (db: schema.ShopperDatabase) => Promise<T>) => run(db),
    realtime,
    paystack: createPaystack({ secretKey: fake.secretKey, baseUrl: fake.baseUrl }),
    appVersion: "test",
    timeoutMs: 3000,
  };
  const launcher = boxMomoPayment(deps);
  const authentication = createAuth({
    database: db,
    orgId,
    secret: "integration-secret-at-least-thirty-two-chars",
    baseURL: "http://localhost",
  });
  const withLauncher = (momoPayment: WorkflowLauncher) =>
    createApi({
      database: db,
      devices: createDeviceService(db, cache.cache, "test"),
      authentication,
      momoPayment,
      paystackSecret: fake.secretKey,
      realtime,
    });
  const api = withLauncher(launcher);
  const headers = {
    authorization: `Bearer ${token}`,
    "x-shopper-device-token": deviceToken,
    "content-type": "application/json",
  };
  const call = (path: string, method = "GET", body?: unknown) =>
    api.request(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    fixture,
    db,
    ids,
    orgId,
    api,
    withLauncher,
    fake,
    realtime,
    deps,
    launcher,
    call,
    headers,
    deviceToken,
    token,
    session,
    async webhook(reference: string, event = "charge.success", amount = 100) {
      const body = JSON.stringify({
        event,
        data: { reference, status: event === "charge.success" ? "success" : "failed", amount },
      });
      return api.request("/webhooks/paystack", {
        method: "POST",
        headers: { "x-paystack-signature": signWebhook(fake.secretKey, body) },
        body,
      });
    },
    async close() {
      cache.close();
      await fake.stop();
      await pool.end();
      await fixture.close();
    },
  };
}
