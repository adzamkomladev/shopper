// The back office's transactions explorer (report.read): sales and unapplied MoMo payments over a date range,
// searchable by receipt number or MoMo reference, filtered by status, tender, branch and cashier, in keyset pages
// with counts per status; the drill-down shows lines, tenders with their payment, refunds, the fiscal document and
// the audit trail. A branch-scoped member sees only their branches, and the CSV holds exactly the matching rows.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq, inArray } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";
import { ids } from "../../fixtures/sales/golden";
import { get, portalMember } from "../../support/api/portal";
import { reportWorld } from "../../support/reports/world";

let w: Awaited<ReturnType<typeof reportWorld>>;
let scoped: string;
let momo: Array<{ saleId: string; reference: string }>;
const pending = v7();
beforeAll(async () => {
  w = await reportWorld();
  momo = await w.world.db
    .select({ saleId: schema.saleTender.saleId, reference: schema.payment.reference })
    .from(schema.saleTender)
    .innerJoin(schema.payment, eq(schema.payment.id, schema.saleTender.paymentId))
    .where(inArray(schema.saleTender.saleId, [w.sales[3]!.id, w.sales[4]!.id]));
  // A MoMo prompt the customer never approved: no sale uses it.
  await w.world.db.insert(schema.payment).values({
    id: pending,
    orgId: ids.org,
    branchId: ids.branch,
    deviceId: w.world.scope.deviceId,
    cashierId: w.world.session.userId,
    reference: pending,
    amount: money(50_000),
    phone: "0241234567",
    network: "mtn",
    status: "pending",
    createdAt: new Date("2026-10-15T13:00:00.000Z"),
  });
  scoped = await portalMember(w.owner, "accountant");
  const userId = (await w.owner.auth.resolvePrincipal(
    new Request("http://localhost", { headers: { cookie: scoped } }),
  ))!.userId;
  const [row] = await w.world.db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(eq(schema.member.userId, userId));
  await w.world.db
    .insert(schema.memberBranch)
    .values({ orgId: ids.org, memberId: row!.id, branchId: w.otherBranch });
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const range = "from=2026-10-14&to=2026-10-15";
const list = async (query = "", cookie = w.owner.cookie) =>
  (await get(w.owner.api, cookie, `/transactions?${range}${query}`)).body;
const idsOf = (body: Record<string, any>) => body.rows.map((row: any) => row.id);

test("counts per status, and filters by status, tender, cashier and search", async () => {
  const all = await list();
  expect(all.counts).toEqual({ all: 8, completed: 6, refunded: 1, pending: 1 });
  expect(all.rows).toHaveLength(8);
  expect(idsOf(await list("&status=refunded"))).toEqual([w.sales[2]!.id]);
  expect(idsOf(await list("&status=pending"))).toEqual([pending]);
  expect((await list("&tender=momo")).rows.map((row: any) => row.id).sort()).toEqual(
    [w.sales[3]!.id, w.sales[4]!.id, pending].sort(),
  );
  expect(idsOf(await list(`&cashierId=${w.second}`))).toEqual([w.copy]);
  const receipt = w.sales[4]!.receiptNumber!;
  expect(idsOf(await list(`&q=${encodeURIComponent(receipt)}`))).toEqual([w.sales[4]!.id]);
  const reference = momo.find((row) => row.saleId === w.sales[3]!.id)!.reference;
  expect(idsOf(await list(`&q=${reference}`))).toEqual([w.sales[3]!.id]);
  // Filters narrow the rows, never the tabs' counts beyond the search.
  expect((await list("&status=refunded")).counts.all).toBe(8);
});

test("keyset pages walk every row once, newest first", async () => {
  const seen: Array<{ id: string; occurredAt: string }> = [];
  let cursor = "";
  for (let page = 0; page < 5; page++) {
    const body = await list(`&limit=3${cursor ? `&cursor=${cursor}` : ""}`);
    seen.push(...body.rows);
    if (!body.next) break;
    expect(body.rows).toHaveLength(3);
    cursor = body.next;
  }
  expect(seen.map((row) => row.id)).toEqual(idsOf(await list()));
  expect(new Set(seen.map((row) => row.id)).size).toBe(8);
  const times = seen.map((row) => row.occurredAt);
  expect(times).toEqual([...times].sort().reverse());
});

test("the drill-down shows lines with tax, tenders with their payment, refunds and the audit trail", async () => {
  const split = (await get(w.owner.api, w.owner.cookie, `/transactions/${w.sales[4]!.id}`)).body;
  expect(split).toMatchObject({ id: w.sales[4]!.id, receiptNumber: w.sales[4]!.receiptNumber });
  expect(split.lines).toHaveLength(1);
  expect(split.lines[0]).toMatchObject({ quantity: 1_000, tax: { vat: 15_000 } });
  expect(split.tenders.map((t: any) => t.kind)).toEqual(["momo", "card", "cash"]);
  expect(split.tenders[0].payment).toMatchObject({ provider: "paystack", status: "confirmed" });
  expect(split.audit.map((row: any) => row.command)).toContain("sale.accept");

  const refunded = (await get(w.owner.api, w.owner.cookie, `/transactions/${w.sales[2]!.id}`)).body;
  expect(refunded.status).toBe("refunded");
  expect(refunded.refunds).toEqual([
    expect.objectContaining({ total: w.refund.total, tenderKind: "card" }),
  ]);
  expect(refunded.audit.map((row: any) => row.command)).toEqual(
    expect.arrayContaining(["sale.accept", "refund.accept"]),
  );
});

test("a scoped member sees only their branch; the CSV holds exactly the matching rows", async () => {
  expect(idsOf(await list("", scoped))).toEqual([w.copy]);
  expect((await get(w.owner.api, scoped, `/transactions/${w.sales[2]!.id}`)).status).toBe(404);
  expect(
    (await get(w.owner.api, scoped, `/transactions?${range}&branchId=${ids.branch}`)).status,
  ).toBe(403);
  const response = await w.owner.api.request(`/transactions/export.csv?${range}&tender=momo`, {
    headers: { cookie: w.owner.cookie },
  });
  expect(response.headers.get("content-type")).toContain("text/csv");
  const lines = (await response.text()).trim().split("\n");
  expect(lines).toHaveLength(1 + 3);
  expect(lines[0]).toContain("Receipt");
  expect(lines.some((line) => line.includes(w.sales[4]!.receiptNumber!))).toBe(true);
});
