import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "@shopper/db-pg/migrate";
import { buildInfo } from "@shopper/config";
import { recordUpgrade } from "@shopper/core/provisioning";
import type { Pack } from "./types";

/**
 * Brings the shop's database to this binary: pending migrations run (forward only), then every shop whose last
 * `shopper_meta` row names another product version gets an `upgrade` row. The migrations are in the pack, so the
 * sealed binary needs no folder beside it.
 */
export async function migrateBox(databaseUrl: string, pack: Pack) {
  const folder = await mkdtemp(join(tmpdir(), "shopper-migrations-"));
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const name of pack.names.filter((each) => each.startsWith("migrations/"))) {
      const target = join(folder, name.slice("migrations/".length));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, Buffer.from(await pack.file(name)!.arrayBuffer()));
    }
    const db = drizzle(client, { schema });
    // Two boxes cannot share a database, but a restart racing its predecessor's last seconds can.
    await db.execute(sql`SELECT pg_advisory_lock(hashtextextended('shopper.box.migrate', 0))`);
    await migrateDatabase(db, folder);
    for (const org of await db.select({ id: schema.org.id }).from(schema.org)) {
      const [latest] = await db
        .select({ version: schema.shopperMeta.productVersion })
        .from(schema.shopperMeta)
        .where(eq(schema.shopperMeta.orgId, org.id))
        .orderBy(desc(schema.shopperMeta.createdAt))
        .limit(1);
      if (latest?.version === buildInfo.version) continue;
      await db.transaction((tx) =>
        recordUpgrade(
          tx,
          { orgId: org.id, appVersion: buildInfo.version },
          {
            schemaVersion: buildInfo.schemaVersion,
            syncProtocol: buildInfo.syncProtocol,
            archiveFormat: buildInfo.archiveFormat,
          },
        ),
      );
    }
  } finally {
    await client.end();
    await rm(folder, { recursive: true, force: true });
  }
}
