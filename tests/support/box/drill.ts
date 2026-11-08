import { expect } from "vite-plus/test";
import { localSale } from "@shopper/db-sqlite";
import { eq } from "drizzle-orm";
import { context, databaseConnectionString } from "../till/server";
import { sell } from "../till/host/chaos";
import type { createHostFixture } from "../till/host/fixture";
import { freePort, sealedBox, startSealed } from "./sealed";

type Fixture = Awaited<ReturnType<typeof createHostFixture>>;
type Host = Awaited<ReturnType<Fixture["start"]>>;

/**
 * The sealed box as a store runs it, on the till suite's database: one port for the life of the drill, so a
 * register that loses it finds it again at the same address after a restart.
 */
export async function drillBox(env: Record<string, string> = {}) {
  const sealed = await sealedBox();
  const install = await sealed.install();
  const port = String(await freePort());
  const start = async (overrides: Record<string, string> = {}) =>
    startSealed(install, {
      SHOPPER_AUTH_SECRET: "drill-test-secret-0123456789abcdef",
      SHOPPER_EGRESS: "off",
      SHOPPER_AUTH_URL: `http://127.0.0.1:${port}`,
      SHOPPER_ORG_ID: context.orgId,
      DATABASE_URL: databaseConnectionString(),
      SHOPPER_CACHE_PATH: `${install.home}/cache.sqlite`,
      SHOPPER_BLOBS_PATH: `${install.home}/blobs`,
      ...env,
      ...overrides,
      PORT: port,
    });
  let running = await start();
  return {
    /** Where a register points: the box serves its API under /api. */
    upstream: `${running.url}/api`,
    home: install.home,
    output: () => running.output(),
    kill: () => running.kill(),
    async restart(overrides?: Record<string, string>) {
      running = await start(overrides);
    },
    async close() {
      await running.stop().catch(() => undefined);
      await sealed.close();
    },
  };
}

/** The drill's pass mark: the register rings a sale on its own and gives it a receipt number. */
export async function expectStillSelling(fixture: Fixture, host: Host) {
  const [localId] = await sell(host, fixture.config.references.products[0]!.id);
  const [row] = await fixture.database.read((tx) =>
    tx.select().from(localSale).where(eq(localSale.localId, localId!)),
  );
  expect((row!.payload as { receiptNumber?: string }).receiptNumber).toMatch(/\S/);
  return localId!;
}
