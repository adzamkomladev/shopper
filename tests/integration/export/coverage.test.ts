// A new table is in every archive by default. This fails when one cannot be (no `id` to page by), when a name the
// policy mentions has gone, and when a column that looks like a credential is not hidden or excluded on purpose.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { EXCLUDED_TABLES, HIDDEN_COLUMNS } from "@shopper/export";
import { exportFixture } from "../../support/export/org";

type Fixture = Awaited<ReturnType<typeof exportFixture>>;
let f: Fixture;
let columns: { table: string; column: string }[];
beforeAll(async () => {
  f = await exportFixture();
  columns = (
    await f.db.execute<{ table: string; column: string }>(sql`
      select c.table_name as "table", c.column_name as "column"
      from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
      where c.table_schema = 'public' and t.table_type = 'BASE TABLE'`)
  ).rows;
});
afterAll(async () => f?.close());

// Columns that look like credentials but are not: what they hold, and why a copy of the business should keep them.
const NOT_CREDENTIALS = new Set([
  "account.access_token_expires_at", // a timestamp, not the token
  "account.refresh_token_expires_at",
  "user.password_attempts", // a lockout counter and its end time
  "user.password_locked_until",
]);
const credentialLike = /password|secret|token|digest|pin_hash|code_hash/;

test("every exported table has an id to page by, and the policy names only what exists", () => {
  const tables = new Set(columns.map((c) => c.table));
  const withOrg = [...tables].filter((t) =>
    columns.some((c) => c.table === t && c.column === "org_id"),
  );
  for (const table of withOrg.filter((t) => !(t in EXCLUDED_TABLES)))
    expect(
      columns.some((c) => c.table === table && c.column === "id"),
      `${table} has no id`,
    ).toBe(true);
  for (const table of Object.keys(EXCLUDED_TABLES)) expect(tables.has(table), table).toBe(true);
  for (const [table, hidden] of Object.entries(HIDDEN_COLUMNS))
    for (const column of hidden)
      expect(
        columns.some((c) => c.table === table && c.column === column),
        `${table}.${column}`,
      ).toBe(true);
  expect(Object.keys(EXCLUDED_TABLES).filter((t) => t in HIDDEN_COLUMNS)).toEqual([]);
});

test("a column that looks like a credential is hidden, its table excluded, or named as safe", () => {
  const unexplained = columns
    .filter((c) => credentialLike.test(c.column))
    .filter((c) => !(c.table in EXCLUDED_TABLES))
    .filter((c) => !HIDDEN_COLUMNS[c.table]?.includes(c.column))
    .map((c) => `${c.table}.${c.column}`)
    .filter((name) => !NOT_CREDENTIALS.has(name));
  expect(unexplained).toEqual([]);
});
