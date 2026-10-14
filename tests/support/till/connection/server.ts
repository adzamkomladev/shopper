import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { postgresFixture } from "../../../fixtures/postgres";
import { buildDefines } from "../../../../tooling/build/info";
import type { HttpClient } from "../http";

export async function createConnectionServer(state: string) {
  installBuildGlobals();
  const [
    schema,
    { drizzle },
    { createDeviceService },
    adapters,
    apiPackage,
    syncPackage,
    seed,
    serve,
    sales,
    { WebSocketServer },
  ] = await Promise.all([
    import("@shopper/db-pg"),
    import("drizzle-orm/node-postgres"),
    import("@shopper/auth/devices"),
    import("@shopper/adapters-box"),
    import("@shopper/api"),
    import("@shopper/api/sync"),
    import("../server/data"),
    import("../http"),
    import("../sales"),
    import("ws"),
  ]);
  const pg = await postgresFixture();
  const pool = new Pool({ connectionString: pg.connectionString });
  const db = drizzle(pool, { schema }) as import("@shopper/db-pg").ShopperDatabase;
  let api: HttpClient | undefined;
  let sockets: InstanceType<typeof WebSocketServer> | undefined;
  const blobDirectory = await mkdtemp(join(tmpdir(), "shopper-connection-blobs-"));
  const { blobs } = await adapters.boxBlobs(blobDirectory, {
    baseUrl: "http://127.0.0.1",
    secret: new Uint8Array(32).fill(7),
  });
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
    const realtime = adapters.boxRealtime();
    const apiApp = apiPackage.createApi({
      database: db,
      devices,
      sequencer,
      blobs,
      realtime,
    });
    sockets = new WebSocketServer({ noServer: true, perMessageDeflate: false });
    const upgrades = new Map<
      string,
      {
        incoming: import("node:http").IncomingMessage;
        socket: import("node:stream").Duplex;
        head: Buffer;
      }
    >();
    const sync = syncPackage.createSyncRoutes({
      database: db,
      devices,
      sequencer,
      blobs,
      ...(state === "incompatible" ? { protocol: 99 } : {}),
      live: async (request, principal, cursor) => {
        const key = new URL(request.url).pathname + new URL(request.url).search;
        const upgrade = upgrades.get(key);
        if (!upgrade) return new Response(null, { status: 500 });
        upgrades.delete(key);
        sockets!.handleUpgrade(upgrade.incoming, upgrade.socket, upgrade.head, (socket) => {
          void realtime
            .subscribe(
              principal.orgId,
              principal.storeId,
              principal.deviceId,
              cursor,
              async (message) => socket.send(JSON.stringify(message)),
            )
            .then((subscription) => socket.once("close", () => void subscription.close()));
        });
        return new Response(null, { status: 204 });
      },
    });
    const app = {
      fetch(request: Request) {
        return new URL(request.url).pathname.startsWith("/sync/")
          ? sync.fetch(request)
          : apiApp.fetch(request);
      },
    };
    api = await serve.serveHono(app, (incoming, socket, head) => {
      const key = incoming.url ?? "/";
      upgrades.set(key, { incoming, socket, head });
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers))
        if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
      void Promise.resolve(sync.request(key, { headers }))
        .then((response) => {
          if (response.status === 204) return;
          socket.write(
            `HTTP/1.1 ${response.status} ${response.statusText}\r\nConnection: close\r\n\r\n`,
          );
          socket.destroy();
        })
        .catch(() => socket.destroy());
    });
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
      receiptCodes: enrolled.receiptCodes,
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
        for (const socket of sockets?.clients ?? []) socket.terminate();
        if (sockets) await new Promise<void>((resolve) => sockets!.close(() => resolve()));
        try {
          await api?.close();
        } catch (error) {
          failures.push(error);
        }
        cache.close();
        await rm(blobDirectory, { recursive: true, force: true });
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
    for (const socket of sockets?.clients ?? []) socket.terminate();
    if (sockets) await new Promise<void>((resolve) => sockets!.close(() => resolve()));
    await api?.close();
    cache.close();
    await rm(blobDirectory, { recursive: true, force: true });
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
