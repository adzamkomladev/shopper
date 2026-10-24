// The dated rule editor: GET /tax/rules lists every rule (tax.read); POST, PATCH and DELETE need tax.write (super
// admin). A rule only ever starts after today in Accra and can be changed or removed only until it starts, so a
// rate change never reaches a sale already made. Every change is audited and sent to each store's feed.
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { ghanaDate } from "@shopper/core/till";
import { api, context, cookies, db, request } from "../../auth/setup";

const call = async (who: string, path: string, method = "GET", body?: unknown) => {
  const response = await request(api, cookies.get(who)!, path, method, body);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};
const day = (offset: number) => ghanaDate(new Date(Date.now() + offset * 86_400_000));
const rule = (over: Record<string, unknown> = {}) => ({
  effectiveFrom: day(1),
  vatBps: 1_250,
  nhilBps: 250,
  getfundBps: 250,
  covidBps: 0,
  source: "Budget 2027, VAT cut to 12.5%",
  ...over,
});
const audits = async (command: string) =>
  (await db.select().from(schema.auditLog).where(eq(schema.auditLog.orgId, context.orgId))).filter(
    (row) => row.command === command,
  ).length;

test("everyone with tax.read sees the rules, newest first; only tax.write changes them", async () => {
  const list = await call("accountant", "/tax/rules");
  expect(list.status).toBe(200);
  expect(list.body.rules).toEqual([
    expect.objectContaining({ effectiveFrom: "2026-01-01", vatBps: 1_500, nhilBps: 250 }),
  ]);
  expect((await call("cashier", "/tax/rules")).status).toBe(403);
  for (const who of ["admin", "accountant", "cashier"])
    expect((await call(who, "/tax/rules", "POST", rule())).status, who).toBe(403);
});

test("a rule must start after today in Accra, with whole basis points and a source", async () => {
  for (const body of [
    rule({ effectiveFrom: day(0) }),
    rule({ effectiveFrom: day(-30) }),
    rule({ effectiveFrom: "2027-02-30" }),
    rule({ vatBps: 10_001 }),
    rule({ vatBps: 12.5 }),
    rule({ source: " " }),
    { effectiveFrom: day(1) },
  ])
    expect(
      (await call("superadmin", "/tax/rules", "POST", body)).status,
      JSON.stringify(body),
    ).toBe(400);
  expect((await call("accountant", "/tax/rules")).body.rules).toHaveLength(1);
});

test("a scheduled rule is created, edited and removed with an audit row each, and reaches every store", async () => {
  const store = await call("superadmin", "/stores", "POST", { name: "Rules store" });
  const storeId = store.body.id as string;
  const counts = [
    await audits("tax.rule.create"),
    await audits("tax.rule.update"),
    await audits("tax.rule.delete"),
  ];

  const created = await call("superadmin", "/tax/rules", "POST", rule());
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({ ...rule(), orgId: context.orgId });
  const id = created.body.id as string;
  expect((await call("superadmin", "/tax/rules", "POST", rule())).status).toBe(409);

  const edited = await call("superadmin", `/tax/rules/${id}`, "PATCH", rule({ vatBps: 1_300 }));
  expect(edited.status).toBe(200);
  expect(edited.body).toMatchObject({ id, vatBps: 1_300 });

  expect((await call("superadmin", `/tax/rules/${id}`, "DELETE")).status).toBe(204);
  expect((await call("accountant", "/tax/rules")).body.rules).toHaveLength(1);
  expect([
    await audits("tax.rule.create"),
    await audits("tax.rule.update"),
    await audits("tax.rule.delete"),
  ]).toEqual(counts.map((count) => count + 1));

  const feed = await db
    .select()
    .from(schema.storeChange)
    .where(and(eq(schema.storeChange.storeId, storeId), eq(schema.storeChange.entityId, id)));
  expect(feed.map((row) => [row.entity, row.op, row.v])).toEqual([
    ["tax-rule", "upsert", 5],
    ["tax-rule", "upsert", 5],
    ["tax-rule", "delete", 5],
  ]);
  expect(feed[1]!.payload).toMatchObject({ id, vatBps: 1_300, effectiveFrom: day(1) });
});

test("a rule in force can be neither edited nor removed, and a missing rule is 404", async () => {
  const current = (await call("accountant", "/tax/rules")).body.rules[0];
  expect((await call("superadmin", `/tax/rules/${current.id}`, "PATCH", rule())).status).toBe(409);
  expect((await call("superadmin", `/tax/rules/${current.id}`, "DELETE")).status).toBe(409);
  const missing = "019a0000-0000-7000-8000-0000000000ff";
  expect((await call("superadmin", `/tax/rules/${missing}`, "DELETE")).status).toBe(404);
  // A scheduled rule cannot be moved to today either.
  const created = await call("superadmin", "/tax/rules", "POST", rule({ effectiveFrom: day(2) }));
  expect(
    (
      await call(
        "superadmin",
        `/tax/rules/${created.body.id}`,
        "PATCH",
        rule({ effectiveFrom: day(0) }),
      )
    ).status,
  ).toBe(400);
});
