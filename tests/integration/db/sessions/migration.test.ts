// 0042 gives every existing org its session key, so the first dump after the upgrade can verify that day's grants.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { postgresFixture } from "../../../fixtures/postgres";

const context = provisioningContext();
let fixture: Awaited<ReturnType<typeof postgresFixture>>;

beforeAll(async () => {
  fixture = await postgresFixture();
  const db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  await provisionOrg(db, context, { name: "Session key tenant" });
}, 120_000);
afterAll(() => fixture?.close());

test("the migration gives an existing org one session key, and a rerun keeps it", async () => {
  const migration = (
    await readFile(
      new URL("../../../../packages/db/pg/migrations/0042_session_key.sql", import.meta.url),
      "utf8",
    )
  ).replaceAll("--> statement-breakpoint", "");
  const keys = async () =>
    (
      await fixture.client.query<{ key: string }>("SELECT key FROM session_key WHERE org_id = $1", [
        context.orgId,
      ])
    ).rows;
  await fixture.client.query(migration);
  const [first] = await keys();
  expect(first?.key).toMatch(/^[0-9a-f]{64}$/);
  await fixture.client.query(migration);
  expect(await keys()).toEqual([first]);
});
