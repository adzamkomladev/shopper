import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createProduct, setPrice } from "@shopper/core/catalogue";
import { boxBlobs, boxSequencer } from "@shopper/adapters-box";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { localSale, outbox } from "@shopper/db-sqlite";
import { momoFixture } from "../../payments/momo";
import { serveHono } from "../http";
import { insertOpenShift } from "../shifts";
import { startTillHost } from "./process";
import { startHostUpstream } from "./upstream";
import { waitForStatus } from "./chaos";
import { provisioningContext } from "../../../../tooling/database/seed";

/**
 * A spawned till host enrolled in the MoMo tenant (Paystack fake, signed webhooks), behind a fault
 * proxy, with one 1 GHS product in its references and an open shift.
 */
export async function momoRegister() {
  const momo = await momoFixture();
  const directory = await mkdtemp(join(tmpdir(), "shopper-chaos-momo-"));
  const storage = await boxBlobs(join(directory, "blobs"), {
    baseUrl: "http://127.0.0.1",
    secret: new Uint8Array(32).fill(7),
  });
  const server = await serveHono(
    momo.withLauncher(momo.launcher, momo.realtime, {
      sequencer: boxSequencer(momo.db),
      blobs: storage.blobs,
    }),
  );
  const upstream = await startHostUpstream(server);
  const sqlitePath = join(directory, "till.sqlite");
  const database = openTillDatabase(sqlitePath);
  const scope = {
    orgId: momo.orgId,
    deviceId: momo.ids.device,
    branchId: momo.ids.branch,
    storeId: momo.ids.store,
  };
  await insertOpenShift(database, {
    ...scope,
    openedBy: momo.ids.user,
    openedSessionId: momo.session.id,
  });
  // The register bootstraps this product, its price and the org's tax rules from the server snapshot.
  const owner = { ...provisioningContext(momo.orgId), reason: "Chaos MoMo basket" };
  const product = await createProduct(momo.db, owner, {
    sku: "MOMO",
    name: "MoMo basket",
    baseUnit: "each",
    taxClass: "standard",
  });
  await setPrice(momo.db, owner, {
    productId: product.id,
    data: { branchId: momo.ids.branch, amount: 10_000, validFrom: "2026-01-01T00:00:00.000Z" },
  });
  const config = {
    sqlitePath,
    identity: { ...scope, shopName: "MoMo tenant", registerName: "Till" },
    upstream: upstream.url,
    deviceToken: momo.deviceToken,
    session: {
      id: momo.session.id,
      orgId: scope.orgId,
      deviceId: scope.deviceId,
      branchId: scope.branchId,
      userId: momo.ids.user,
      proof: momo.token,
      roleName: momo.session.roleName,
      issuedAt: momo.session.issuedAt,
      expiresAt: momo.session.expiresAt,
      permissions: momo.session.permissions,
    },
    origins: ["http://localhost"],
    port: 0,
  };
  let host: Awaited<ReturnType<typeof startTillHost>> | undefined;
  return {
    momo,
    upstream,
    config,
    productId: product.id,
    async start() {
      host = await startTillHost(config);
      const started = host;
      await waitForStatus(
        started,
        (status) => status.cursor !== null && status.cursor === status.head,
      );
      return started;
    },
    queued: () => database.read((tx) => tx.select().from(outbox)),
    localSales: () => database.read((tx) => tx.select().from(localSale)),
    async close() {
      try {
        await host?.stop();
      } finally {
        await database.close();
        await upstream.close();
        await server.close();
        await momo.close();
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
