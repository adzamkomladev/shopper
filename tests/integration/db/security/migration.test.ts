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
      new URL("../../../../packages/db/pg/migrations/0034_security.sql", import.meta.url),
      "utf8",
    )
  ).replaceAll("--> statement-breakpoint", "");
});
afterAll(async () => {
  await fixture?.close();
});

// Permissions are data: a shop that renamed or trimmed its roles gets unlock where it already lets someone set
// PINs, never by what a role is called.
test("shops from before Day 26 grant unlock to the owner and to whoever assigns PINs, once", async () => {
  const [legacy] = await q<{ id: string }>(
    "INSERT INTO org (name, slug) VALUES ('Legacy', 'legacy-unlock') RETURNING id",
  );
  const org = legacy!.id;
  const role = async (name: string, owner = false) =>
    (
      await q<{ id: string }>(
        "INSERT INTO role (org_id, name, protected_owner) VALUES ($1, $2, $3) RETURNING id",
        [org, name, owner],
      )
    )[0]!.id;
  await role("owner", true);
  const manager = await role("floor manager");
  await role("admin");
  await role("cashier");
  const [pin] = await q<{ id: string }>(
    "INSERT INTO permission (org_id, code) VALUES ($1, 'cashier.pin.assign') RETURNING id",
    [org],
  );
  await fixture.client.query(
    "INSERT INTO role_permission (org_id, role_id, permission_id) VALUES ($1, $2, $3)",
    [org, manager, pin!.id],
  );
  await fixture.client.query(migration);
  await fixture.client.query(migration);
  const granted = await q<{ name: string }>(
    `SELECT r.name FROM role_permission rp
       JOIN role r ON r.id = rp.role_id AND r.org_id = rp.org_id
       JOIN permission p ON p.id = rp.permission_id AND p.org_id = rp.org_id
      WHERE rp.org_id = $1 AND p.code = 'staff.unlock' ORDER BY r.name`,
    [org],
  );
  expect(granted.map((row) => row.name)).toEqual(["floor manager", "owner"]);
  expect(
    await q("SELECT till_allowed FROM permission WHERE org_id = $1 AND code = 'staff.unlock'", [
      org,
    ]),
  ).toEqual([{ till_allowed: true }]);
});
