// Two shops on a fresh database for the shop-account suites, with a queue that keeps what commands send.
//   shopWorld()           -> { db, a, b, sent, queue, clock, close }; `a`/`b` are { orgId, slug, context }
//   world.sent            -> every envelope the commands queued, oldest first
//   world.clock.at(iso)   -> moves the injected clock
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import type { Envelope, Queue } from "@shopper/ports";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { postgresFixture } from "../../fixtures/postgres";

export const linkSecret = "shop account link secret that is at least thirty two chars";

export async function shopWorld() {
  const fixture = await postgresFixture();
  const pool = new Pool({ connectionString: fixture.connectionString });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const shop = async (slug: string) => {
    const context = provisioningContext();
    await provisionOrg(db, context, { name: `${slug} Mart`, slug });
    return { orgId: context.orgId, slug, context };
  };
  const sent: Envelope[] = [];
  const queue: Queue = { send: async (envelope) => void sent.push(envelope) } as Queue;
  let now = new Date("2026-11-03T09:00:00.000Z");
  return {
    db,
    a: await shop(`accra-${Date.now().toString(36)}`),
    b: await shop(`kumasi-${Date.now().toString(36)}`),
    sent,
    queue,
    clock: {
      now: () => now,
      at: (iso: string) => void (now = new Date(iso)),
      add: (ms: number) => void (now = new Date(now.getTime() + ms)),
    },
    close: async () => {
      await pool.end();
      await fixture.close();
    },
  };
}
