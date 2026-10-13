import { Pool } from "pg";
import { postgresFixture } from "../../../fixtures/postgres";
import { buildDefines } from "../../../../tooling/build/info";
import type { HttpClient } from "../http";

export async function createConnectionServer(state: string) {
  installBuildGlobals();
  const [schema, { drizzle }, { createDeviceService }, adapters, apiPackage, seed, serve, sales] =
    await Promise.all([
      import("@shopper/db-pg"),
      import("drizzle-orm/node-postgres"),
      import("@shopper/auth/devices"),
      import("@shopper/adapters-box"),
      import("@shopper/api"),
      import("../server-data"),
      import("../http"),
      import("../sales"),
    ]);
  const pg = await postgresFixture();
  const pool = new Pool({ connectionString: pg.connectionString });
  const db = drizzle(pool, { schema }) as import("@shopper/db-pg").ShopperDatabase;
  let api: HttpClient | undefined;
  const cache = adapters.boxCache(":memory:");
  try {
    const seeded = await seed.seedServerDatabase(db);
    const context = seed.context;
    const { config: saleConfig, references } = sales;
    const principal = {
      orgId: context.orgId,
      userId: seeded.userId,
      roleId: seeded.roleId,
      roleName: "cashier",
    };
    const devices = createDeviceService(db, cache.cache, seed.appVersion, context.orgId);
    const challenge = await devices.issueEnrollment(principal, { branchId: seeded.branchId });
    const enrolled = await devices.enroll({
      orgId: context.orgId,
      code: challenge.code,
      name: "Register 1",
    });
    await devices.assignPin(principal, { userId: principal.userId, pin: "1357" });
    const session = await devices.login({
      deviceId: enrolled.deviceId,
      deviceToken: enrolled.deviceToken,
      userId: principal.userId,
      pin: "1357",
    });
    const sequencer = adapters.boxSequencer(db);
    let app: { fetch(request: Request): Response | Promise<Response> } = apiPackage.createApi({
      database: db,
      devices,
      sequencer,
    });
    if (state === "incompatible") {
      const [{ Hono }, { createSyncRoutes }] = await Promise.all([
        import("hono"),
        import("@shopper/api/sync"),
      ]);
      const incompatible = new Hono();
      incompatible.route("/", createSyncRoutes({ database: db, devices, sequencer, protocol: 99 }));
      app = incompatible;
    }
    api = await serve.serveHono(app);
    const identity = {
      orgId: context.orgId,
      storeId: saleConfig.storeId,
      branchId: seeded.branchId,
      deviceId: enrolled.deviceId,
      shopName: "Shopper test shop",
      registerName: "Register 1",
    };
    return {
      api,
      identity,
      appVersion: seed.appVersion,
      productId: sales.ids.product,
      deviceToken: enrolled.deviceToken,
      references,
      session: {
        id: session.id,
        orgId: context.orgId,
        deviceId: enrolled.deviceId,
        branchId: seeded.branchId,
        userId: principal.userId,
        roleName: session.roleName,
        issuedAt: session.issuedAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
        permissions: session.permissions,
        proof: session.token,
      },
      async close() {
        const failures: unknown[] = [];
        try {
          await api?.close();
        } catch (error) {
          failures.push(error);
        }
        cache.close();
        try {
          await pool.end();
        } catch (error) {
          failures.push(error);
        }
        try {
          await pg.close();
        } catch (error) {
          failures.push(error);
        }
        if (failures.length) throw new AggregateError(failures, "Connection server cleanup failed");
      },
      async expireSession() {
        await seed.ageSession(db, context, {
          sessionId: session.id,
          issuedAt: new Date("2000-01-01T00:00:00Z"),
          expiresAt: new Date("2000-01-01T01:00:00Z"),
        });
      },
      async revokeDevice() {
        await devices.revoke(principal, { deviceId: enrolled.deviceId });
      },
    };
  } catch (error) {
    cache.close();
    await pool.end();
    await pg.close();
    throw error;
  }
}

function installBuildGlobals() {
  const globals = globalThis as typeof globalThis & Record<string, string | number>;
  for (const [key, value] of Object.entries(buildDefines))
    globals[key] = JSON.parse(value) as string | number;
}
