import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { readFileSync } from "node:fs";
import { inArray, sql } from "drizzle-orm";
import { permission } from "@shopper/db-pg";
import { auth, cookies, baseURL, db } from "../setup";

async function principal(role: string) {
  const found = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get(role)! } }),
  );
  return { ...found!, deviceId: v7() };
}

test("seeded roles may use report.read, stock.read and stock.write on a till device", async () => {
  const [inventory, accountant, cashier] = await Promise.all([
    principal("inventory"),
    principal("accountant"),
    principal("cashier"),
  ]);
  expect(await auth.hasPermission(inventory, "stock.read")).toBe(true);
  expect(await auth.hasPermission(inventory, "stock.write")).toBe(true);
  expect(await auth.hasPermission(accountant, "report.read")).toBe(true);
  expect(await auth.hasPermission(accountant, "stock.read")).toBe(true);
  // Permissions are data: the cashier role holds none of them, so the till grants nothing.
  expect(await auth.hasPermission(cashier, "stock.write")).toBe(false);
  expect(await auth.hasPermission(cashier, "report.read")).toBe(false);
});

test("migration 0019 backfills till_allowed for permission rows that predate it", async () => {
  const codes = ["report.read", "stock.read", "stock.write"];
  const grants = () =>
    db
      .select({ allowed: permission.tillAllowed })
      .from(permission)
      .where(inArray(permission.code, codes));
  await db.update(permission).set({ tillAllowed: false }).where(inArray(permission.code, codes));
  expect((await grants()).some((row) => row.allowed)).toBe(false);
  const file = new URL(
    "../../../../packages/db/pg/migrations/0019_stock_documents.sql",
    import.meta.url,
  );
  const update = readFileSync(file, "utf8")
    .split("--> statement-breakpoint")
    .find((statement) => statement.includes("UPDATE"));
  await db.execute(sql.raw(update!));
  const rows = await grants();
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((row) => row.allowed)).toBe(true);
});
