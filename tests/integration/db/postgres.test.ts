import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { postgresFixture, testOrg } from "../../fixtures/postgres";
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
beforeAll(async () => {
  fixture = await postgresFixture();
});
afterAll(async () => {
  await fixture?.close();
});
test("PostgreSQL 18 fixture can store a UUIDv7 tenant and rolls back transactions", async () => {
  const { client } = fixture;
  const version = await client.query<{ server_version_num: string }>("SHOW server_version_num");
  expect(Number(version.rows[0].server_version_num)).toBeGreaterThanOrEqual(180000);
  expect(Number(version.rows[0].server_version_num)).toBeLessThan(190000);
  await client.query(
    "CREATE TABLE fixture_org (org_id uuid PRIMARY KEY DEFAULT uuidv7(), name text NOT NULL)",
  );
  const org = testOrg();
  await client.query("INSERT INTO fixture_org (org_id, name) VALUES ($1, $2)", [org.id, org.name]);
  await client.query("BEGIN");
  await client.query("UPDATE fixture_org SET name = $1 WHERE org_id = $2", ["Changed", org.id]);
  await client.query("ROLLBACK");
  const result = await client.query<{ org_id: string; name: string }>("SELECT * FROM fixture_org");
  expect(result.rows).toEqual([{ org_id: org.id, name: org.name }]);
});
