import { readFile, readdir } from "node:fs/promises";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { postgresFixture } from "../../../fixtures/postgres";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
const migrations = new URL("../../../../packages/db/pg/migrations/", import.meta.url);
beforeAll(async () => {
  fixture = await postgresFixture();
  const files = (await readdir(migrations))
    .filter((file) => /^000[0-7]_.*\.sql$/.test(file))
    .sort();
  for (const file of files)
    await fixture.client.query(await readFile(new URL(file, migrations), "utf8"));
});
afterAll(async () => {
  await fixture?.close();
});

test("owner migration backfills marker and read grants idempotently without restoring other grants", async () => {
  const db = fixture.client;
  const {
    rows: [org],
  } = await db.query<{ id: string }>(
    "INSERT INTO org (name, slug) VALUES ('Legacy', 'legacy') RETURNING id",
  );
  await db.query(
    "INSERT INTO role (org_id, name) VALUES ($1, 'superadmin'), ($1, 'admin'), ($1, 'cashier')",
    [org.id],
  );
  await db.query("INSERT INTO permission (org_id, code) VALUES ($1, 'product.read')", [org.id]);
  await db.query(
    "INSERT INTO \"user\" (org_id, name, email) VALUES ($1, 'Owner', 'owner@legacy.test')",
    [org.id],
  );
  await db.query(`INSERT INTO member (org_id, organization_id, user_id, role_id, role)
    SELECT r.org_id, r.org_id, u.id, r.id, 'member' FROM role r
    JOIN "user" u ON u.org_id = r.org_id WHERE r.name = 'superadmin'`);
  const migration = await readFile(new URL("0008_owner_roles.sql", migrations), "utf8");
  await db.query(migration);
  await db.query(migration);
  const roles = await db.query<{ name: string; protected_owner: boolean }>(
    "SELECT name, protected_owner FROM role ORDER BY name",
  );
  expect(roles.rows).toEqual([
    { name: "admin", protected_owner: false },
    { name: "cashier", protected_owner: false },
    { name: "superadmin", protected_owner: true },
  ]);
  expect((await db.query("SELECT role FROM member")).rows).toEqual([{ role: "owner" }]);
  const grants = await db.query<{
    name: string;
    code: string;
  }>(`SELECT r.name, p.code FROM role_permission rp
    JOIN role r ON r.id = rp.role_id AND r.org_id = rp.org_id
    JOIN permission p ON p.id = rp.permission_id AND p.org_id = rp.org_id ORDER BY r.name, p.code`);
  expect(grants.rows).toEqual(
    ["admin", "superadmin"].flatMap((name) =>
      ["device.read", "role.read", "user.read"].map((code) => ({ name, code })),
    ),
  );
});
