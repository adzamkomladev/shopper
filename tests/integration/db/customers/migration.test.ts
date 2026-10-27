import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { drizzle } from "drizzle-orm/node-postgres";
import { readFile } from "node:fs/promises";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { postgresFixture } from "../../../fixtures/postgres";

const dir = new URL("../../../../packages/db/pg/migrations/", import.meta.url);
const context = provisioningContext();
const orgId = context.orgId;
const customerCodes = ["customer.manage", "customer.read", "customer.write", "kyc.approve"];
let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let migration: string;
let later: string;
let userId: string;
const q = <T extends Record<string, unknown>>(text: string, values: unknown[] = []) =>
  fixture.client.query<T>(text, values).then((result) => result.rows);

beforeAll(async () => {
  fixture = await postgresFixture();
  const db = drizzle(fixture.client, { schema });
  await migrateDatabase(db);
  migration = (await readFile(new URL("0025_customers.sql", dir), "utf8")).replaceAll(
    "--> statement-breakpoint",
    "",
  );
  later = (
    await Promise.all(
      ["0026_tax.sql", "0027_fiscal.sql", "0030_reports.sql"].map((f) =>
        readFile(new URL(f, dir), "utf8"),
      ),
    )
  )
    .join("\n")
    .replaceAll("--> statement-breakpoint", "");
  await provisionOrg(db, context, { name: "Customer tenant" });
  userId = v7();
  await db.insert(schema.user).values({ id: userId, orgId, email: "c@x.test", name: "Cashier" });
});
afterAll(async () => {
  await fixture?.close();
});

const catalog = () =>
  q<{ k: string; v: string }>(`
    SELECT 'column' AS k, table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '') AS v
      FROM information_schema.columns WHERE table_schema = 'public'
    UNION ALL SELECT 'constraint', conrelid::regclass || '.' || conname || ':' || pg_get_constraintdef(oid)
      FROM pg_constraint WHERE connamespace = 'public'::regnamespace
    UNION ALL SELECT 'index', indexdef FROM pg_indexes WHERE schemaname = 'public'
    UNION ALL SELECT 'trigger', tgrelid::regclass || '.' || tgname FROM pg_trigger WHERE NOT tgisinternal
    ORDER BY 1, 2`);

test("migration 0025 is journalled at idx 25 and replaying it twice changes nothing", async () => {
  const journal = JSON.parse(await readFile(new URL("meta/_journal.json", dir), "utf8"));
  expect(journal.entries.find((e: { idx: number }) => e.idx === 25)).toMatchObject({
    tag: "0025_customers",
  });
  const tables = await q<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  for (const name of [
    "customer",
    "account_hold",
    "credit_entry",
    "loyalty_entry",
    "loyalty_tier",
    "statement_delivery",
    "statement_link",
    "tier_notice",
    "kyc_case",
  ])
    expect(
      tables.map((t) => t.table_name),
      name,
    ).toContain(name);

  const before = await catalog();
  const grants = () => q("SELECT org_id, code, till_allowed FROM permission ORDER BY org_id, code");
  const granted = await grants();
  await fixture.client.query(migration);
  await fixture.client.query(migration);
  // Later migrations widen the feed's entity list again; replaying them restores the schema.
  await fixture.client.query(later);
  expect(await catalog()).toEqual(before);
  expect(await grants()).toEqual(granted);
});

test("the whole model is in place: settings, sale and refund links, holds on tenders, the customer feed entity", async () => {
  const columns = async (table: string) =>
    (
      await q<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [table],
      )
    ).map((c) => c.column_name);
  expect(await columns("org")).toEqual(
    expect.arrayContaining([
      ...["loyalty_enabled", "loyalty_earn_bps", "loyalty_point_value", "loyalty_expiry_days"],
      ...["tier_notice_days", "credit_terms_days", "credit_interest_bps", "statement_schedule"],
      ...["statement_day", "statement_channels", "statement_min_balance", "kyc_id_required"],
      "kyc_id_types",
    ]),
  );
  expect(await columns("sale")).toContain("customer_id");
  expect(await columns("sale_tender")).toContain("hold_id");
  expect(await columns("refund")).toEqual(
    expect.arrayContaining(["account_credit", "points_returned"]),
  );
  expect(await columns("statement_delivery")).toContain("link_id");
  const storeId = v7();
  await fixture.client.query("INSERT INTO store (id, org_id, name) VALUES ($1, $2, 'S')", [
    storeId,
    orgId,
  ]);
  await fixture.client.query(
    `INSERT INTO store_change (org_id, store_id, seq, entity, entity_id, op, v, payload)
     VALUES ($1, $2, 1, 'customer', $3, 'upsert', 1, '{}')`,
    [orgId, storeId, v7()],
  );
});

test("no table keeps a balance: the ledgers are the only source of what is owed and held", async () => {
  const rows = await q<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name <> 'statement_min_balance' AND (column_name ~* 'balance'
       OR (table_name = 'customer' AND column_name ~* '(points|owed|credit_used|available)'))`,
  );
  expect(rows).toEqual([]);
});

async function insertCustomer(over: Record<string, unknown> = {}) {
  const row = {
    id: v7(),
    org_id: orgId,
    name: "Ama Mensah",
    phone: "0241234567",
    kind: "individual",
    business_name: null,
    tin: null,
    credit_limit: 0,
    kyc_verified_at: null,
    archived_at: null,
    merged_into_id: null,
    ...over,
  };
  const keys = Object.keys(row);
  await fixture.client.query(
    `INSERT INTO customer (${keys.join(", ")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(", ")})`,
    Object.values(row),
  );
  return row.id;
}

test("customer checks: business needs a name, TIN format, limit sign and KYC, merged means archived", async () => {
  const at = new Date();
  await insertCustomer({ kind: "business", business_name: "Kofi Traders", tin: "C0012345678" });
  await insertCustomer({ tin: "GHA-123456789-1", credit_limit: 500_000, kyc_verified_at: at });
  const winner = await insertCustomer();
  await insertCustomer({ archived_at: at, merged_into_id: winner });
  for (const bad of [
    { kind: "business" },
    { kind: "business", business_name: "" },
    { kind: "company" },
    { tin: "c0012345678" },
    { tin: "C001234567" },
    { credit_limit: -1 },
    { credit_limit: 10_000 },
    { merged_into_id: winner },
  ])
    await expect(insertCustomer(bad), JSON.stringify(bad)).rejects.toThrow();
});

test("credit_entry and loyalty_entry reject UPDATE and DELETE", async () => {
  const customerId = await insertCustomer();
  await fixture.client.query(
    `INSERT INTO credit_entry (org_id, customer_id, kind, amount, actor_id, occurred_at)
     VALUES ($1, $2, 'charge', 50000, $3, now())`,
    [orgId, customerId, userId],
  );
  await fixture.client.query(
    `INSERT INTO loyalty_entry (org_id, customer_id, reason, points, actor_id, occurred_at)
     VALUES ($1, $2, 'earn', 12, $3, now())`,
    [orgId, customerId, userId],
  );
  for (const [table, column] of [
    ["credit_entry", "amount"],
    ["loyalty_entry", "points"],
  ] as const) {
    await expect(fixture.client.query(`UPDATE ${table} SET ${column} = 1`), table).rejects.toThrow(
      /append-only/,
    );
    await expect(fixture.client.query(`DELETE FROM ${table}`), table).rejects.toThrow(
      /append-only/,
    );
  }
  const [row] = await q<{ amount: string; points: string }>(
    `SELECT (SELECT sum(amount) FROM credit_entry WHERE customer_id = $1) AS amount,
            (SELECT sum(points) FROM loyalty_entry WHERE customer_id = $1) AS points`,
    [customerId],
  );
  expect(row).toEqual({ amount: "50000", points: "12" });
  await expect(
    fixture.client.query(
      `INSERT INTO loyalty_entry (org_id, customer_id, reason, points, actor_id, occurred_at)
       VALUES ($1, $2, 'earn', 0, $3, now())`,
      [orgId, customerId, userId],
    ),
  ).rejects.toThrow();
});

test("existing orgs get the four permissions, granted by role name, once", async () => {
  const [legacy] = await q<{ id: string }>(
    "INSERT INTO org (name, slug) VALUES ('Legacy', 'legacy-customers') RETURNING id",
  );
  const roles = ["superadmin", "admin", "accountant", "cashier", "inventory"];
  for (const name of roles)
    await fixture.client.query("INSERT INTO role (org_id, name) VALUES ($1, $2)", [
      legacy!.id,
      name,
    ]);
  await fixture.client.query(migration);
  await fixture.client.query(migration);
  const granted = await q<{ name: string; code: string }>(
    `SELECT r.name, p.code FROM role_permission rp
       JOIN role r ON r.id = rp.role_id AND r.org_id = rp.org_id
       JOIN permission p ON p.id = rp.permission_id AND p.org_id = rp.org_id
      WHERE rp.org_id = $1 AND p.code = ANY($2) ORDER BY r.name, p.code`,
    [legacy!.id, customerCodes],
  );
  const by = (name: string) => granted.filter((g) => g.name === name).map((g) => g.code);
  expect(by("superadmin")).toEqual(customerCodes);
  expect(by("admin")).toEqual(customerCodes);
  expect(by("accountant")).toEqual(["customer.manage", "customer.read"]);
  expect(by("cashier")).toEqual(["customer.read", "customer.write"]);
  expect(by("inventory")).toEqual([]);
  const rows = await q<{ code: string; till_allowed: boolean }>(
    "SELECT code, till_allowed FROM permission WHERE org_id = $1 AND code = ANY($2) ORDER BY code",
    [legacy!.id, customerCodes],
  );
  expect(rows).toEqual([
    { code: "customer.manage", till_allowed: false },
    { code: "customer.read", till_allowed: true },
    { code: "customer.write", till_allowed: true },
    { code: "kyc.approve", till_allowed: false },
  ]);
});
