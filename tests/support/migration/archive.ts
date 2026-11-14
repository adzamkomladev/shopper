import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { boxBlobs } from "@shopper/adapters-box";
import { buildInfo } from "@shopper/config";
import { generateKey } from "@shopper/core/licence";
import * as schema from "@shopper/db-pg";
import { buildManifest, dumpOrg } from "@shopper/export";
import { migrateDatabase } from "../../../tooling/database/migrate";
import { postgresFixture } from "../../fixtures/postgres";
import { exportFixture } from "../export/org";

type Fixture = Awaited<ReturnType<typeof exportFixture>>;

async function diskBlobs() {
  const dir = await mkdtemp(join(tmpdir(), "shopper-move-"));
  const { blobs } = await boxBlobs(dir, {
    baseUrl: "http://127.0.0.1",
    secret: new Uint8Array(32).fill(4),
  });
  return { blobs, remove: () => rm(dir, { recursive: true, force: true }) };
}

/**
 * The export fixture's org (after `seed` adds to it), dumped and described as the box would seal it: `read` returns
 * an archive file's bytes by path, as the cloud reads the files a box uploaded.
 */
export async function movedArchive(
  seed?: (f: Fixture, blobs: Awaited<ReturnType<typeof diskBlobs>>["blobs"]) => Promise<void>,
) {
  const f = await exportFixture();
  const storage = await diskBlobs();
  await seed?.(f, storage.blobs);
  const dump = await dumpOrg(f.db, {
    orgId: f.ctx.orgId,
    blobs: storage.blobs,
    prefix: "exports/move",
    // Three rows a part, so a table crosses parts and the order between parts matters.
    pageRows: 3,
  });
  const key = await generateKey();
  const [business] = await f.db.select().from(schema.org).where(eq(schema.org.id, f.ctx.orgId));
  const manifest = buildManifest(
    {
      productVersion: f.ctx.appVersion,
      schemaVersion: buildInfo.schemaVersion,
      createdAt: new Date().toISOString(),
      publicKey: key.publicKey,
      org: { id: business!.id, name: business!.name, slug: business!.slug },
    },
    dump.files,
  );
  const keys = new Map(dump.files.map((file) => [file.path, file.key]));
  return {
    f,
    blobs: storage.blobs,
    manifest,
    key,
    files: dump.files,
    context: { orgId: f.ctx.orgId, appVersion: f.ctx.appVersion },
    read: async (path: string) => {
      const found = keys.get(path);
      return (found && (await storage.blobs.get(f.ctx.orgId, found))) || undefined;
    },
    close: async () => {
      await f.close();
      await storage.remove();
    },
  };
}

/** A migrated database with no org in it, and blobs of its own: the cloud a box moves into. */
export async function emptyDatabase() {
  const fixture = await postgresFixture();
  const pool = new Pool({ connectionString: fixture.connectionString });
  const db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const storage = await diskBlobs();
  return {
    db,
    blobs: storage.blobs,
    connectionString: fixture.connectionString,
    close: async () => {
      await pool.end();
      await fixture.close();
      await storage.remove();
    },
  };
}
