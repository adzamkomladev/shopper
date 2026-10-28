import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { postgresFixture } from "../../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let migration: string;
const q = <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
  fixture.client.query<T>(text, values).then((result) => result.rows);

beforeAll(async () => {
  fixture = await postgresFixture();
  await migrateDatabase(drizzle(fixture.client, { schema }));
  migration = (
    await readFile(
      new URL("../../../../packages/db/pg/migrations/0033_onboarding.sql", import.meta.url),
      "utf8",
    )
  ).replaceAll("--> statement-breakpoint", "");
});
afterAll(async () => {
  await fixture?.close();
});

// Role seeding grants new permissions only to shops created after it, so a shop from before Day 25 needs the
// migration to let its owner submit business verification.
test("shops from before Day 25 let their owner, superadmin and admin submit KYB, once", async () => {
  const [legacy] = await q<{ id: string }>(
    "INSERT INTO org (name, slug) VALUES ('Legacy', 'legacy-kyb') RETURNING id",
  );
  await fixture.client.query(
    "INSERT INTO role (org_id, name, protected_owner) VALUES ($1, 'owner', true)",
    [legacy!.id],
  );
  for (const name of ["superadmin", "admin", "cashier"])
    await fixture.client.query("INSERT INTO role (org_id, name) VALUES ($1, $2)", [
      legacy!.id,
      name,
    ]);
  await fixture.client.query(migration);
  await fixture.client.query(migration);
  const granted = await q<{ name: string }>(
    `SELECT r.name FROM role_permission rp
       JOIN role r ON r.id = rp.role_id AND r.org_id = rp.org_id
       JOIN permission p ON p.id = rp.permission_id AND p.org_id = rp.org_id
      WHERE rp.org_id = $1 AND p.code = 'org.kyb.submit' ORDER BY r.name`,
    [legacy!.id],
  );
  expect(granted.map((row) => row.name)).toEqual(["admin", "owner", "superadmin"]);
  expect(
    await q("SELECT till_allowed FROM permission WHERE org_id = $1 AND code = 'org.kyb.submit'", [
      legacy!.id,
    ]),
  ).toEqual([{ till_allowed: false }]);
});
