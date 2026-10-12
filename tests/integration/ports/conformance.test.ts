import { afterAll, beforeAll, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { v7 } from "uuid";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { defineCommand } from "@shopper/audit";
import { boxCache, boxBlobs, boxRealtime, boxSequencer, boxWorkflow } from "@shopper/adapters-box";
import { portConformance, realtimeConformance } from "@shopper/conformance";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: import("@shopper/db-pg").ShopperDatabase;
let dir: string;
const closeCaches: (() => void)[] = [];
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  dir = await mkdtemp(join(tmpdir(), "shopper-conformance-"));
});
afterAll(async () => {
  for (const close of closeCaches) close();
  await pool?.end();
  await fixture?.close();
  if (dir) await rm(dir, { recursive: true, force: true });
});
const createStore = defineCommand({
  name: "conformance.store",
  async run(tx, ctx) {
    const [row] = await tx
      .insert(schema.store)
      .values({ orgId: ctx.orgId, name: "Conformance" })
      .returning();
    return row!.id;
  },
  audit: (_input, id) => ({ storeId: id }),
});
portConformance("box development adapters", test, async () => {
  const ctx = provisioningContext(),
    other = provisioningContext();
  await provisionOrg(db, ctx, { name: "Box conformance" });
  await provisionOrg(db, other, { name: "Other org" });
  const storeId = await createStore(db, ctx, undefined);
  let time = Date.now();
  const now = () => time;
  const path = join(dir, `${ctx.orgId}.sqlite`);
  const local = boxCache(path, now);
  closeCaches.push(local.close);
  const storage = await boxBlobs(join(dir, ctx.orgId), {
    baseUrl: "https://shopper.test/blobs",
    secret: crypto.getRandomValues(new Uint8Array(32)),
    now,
  });
  return {
    orgId: ctx.orgId,
    otherOrgId: other.orgId,
    storeId,
    cache: local.cache,
    blobs: storage.blobs,
    sequencer: boxSequencer(db),
    workflow: boxWorkflow,
    readSigned: storage.readSigned,
    advanceClock: (ms) => {
      time += ms;
    },
    async reopen() {
      const reopened = boxCache(path, now);
      closeCaches.push(reopened.close);
      return { cache: reopened.cache, sequencer: boxSequencer(db) };
    },
    async sequenceRecord() {
      const [row] = await db.select().from(schema.store).where(eq(schema.store.id, storeId));
      return row!.lastSeq;
    },
  };
});
realtimeConformance("box broadcaster", test, async () => ({
  orgId: v7(),
  otherOrgId: v7(),
  storeId: v7(),
  realtime: boxRealtime(),
}));
