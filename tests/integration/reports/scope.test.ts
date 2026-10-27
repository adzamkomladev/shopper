// Who may read reports, and what: `report.read` holders only; a member scoped to branches sees those branches in
// every report and is refused another branch by id; ranges are bounded and checked.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { member, memberBranch } from "@shopper/db-pg";
import { ids } from "../../fixtures/sales/golden";
import { boxCache } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { baseURL, get, portalMember, secret } from "../../support/api/portal";
import { copied, figure, reportWorld } from "../../support/reports/world";

let w: Awaited<ReturnType<typeof reportWorld>>;
let scoped: string;
beforeAll(async () => {
  w = await reportWorld();
  scoped = await portalMember(w.owner, "accountant");
  const userId = (await w.owner.auth.resolvePrincipal(
    new Request("http://localhost", { headers: { cookie: scoped } }),
  ))!.userId;
  const [row] = await w.world.db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, userId));
  await w.world.db
    .insert(memberBranch)
    .values({ orgId: ids.org, memberId: row!.id, branchId: w.otherBranch });
}, 300_000);
afterAll(async () => {
  await w?.world.local.close();
});

const range = "from=2026-10-14&to=2026-10-15";
const as = (cookie: string | null, path: string) => get(w.owner.api, cookie, path);

test("a member scoped to the other branch sees only that branch, in every report", async () => {
  const sales = await as(scoped, `/reports/sales?${range}&by=branch`);
  expect(sales.status).toBe(200);
  expect(sales.body.rows.map((row: any) => row.key)).toEqual([w.otherBranch]);
  expect(sales.body.total.gross).toBe(figure(copied.index, 0));

  const branches = await as(scoped, `/reports/branches?${range}`);
  expect(branches.body.rows.map((row: any) => row.branchId)).toEqual([w.otherBranch]);
  const dashboard = await as(scoped, "/reports/dashboard?day=2026-10-15");
  expect(dashboard.body.kpis.transactions.value).toBe(1);
  const products = await as(scoped, `/reports/products?${range}`);
  expect(products.body.rows.map((row: any) => row.quantity)).toEqual([1_000]);
  const dead = await as(scoped, "/reports/stock/dead?days=30&on=2026-12-20");
  expect(dead.body.rows.every((row: any) => row.branchId === w.otherBranch)).toBe(true);

  // The owner sees both.
  const all = await as(w.owner.cookie, `/reports/sales?${range}&by=branch`);
  expect(all.body.rows).toHaveLength(2);
});

test("a scoped member asking for a branch outside their scope is refused", async () => {
  for (const path of [
    `/reports/sales?${range}&branchId=${ids.branch}`,
    `/reports/products?${range}&branchId=${ids.branch}`,
    `/reports/branches?${range}&branchId=${ids.branch}`,
    `/reports/dashboard?branchId=${ids.branch}`,
    `/reports/stock/dead?branchId=${ids.branch}`,
  ])
    expect((await as(scoped, path)).status, path).toBe(403);
  expect((await as(scoped, `/reports/sales?${range}&branchId=${w.otherBranch}`)).status).toBe(200);
});

test("roles without report.read and anonymous callers are refused", async () => {
  for (const role of ["cashier", "inventory"]) {
    const cookie = await portalMember(w.owner, role);
    expect((await as(cookie, `/reports/sales?${range}`)).status, role).toBe(403);
    expect((await as(cookie, "/reports/dashboard")).status, role).toBe(403);
  }
  expect((await as(null, `/reports/sales?${range}`)).status).toBe(401);
});

test("bad queries are 400s: reversed or over-long ranges, unknown groupings, malformed ids", async () => {
  for (const query of [
    "from=2026-10-15&to=2026-10-14",
    "from=2025-10-14&to=2026-10-15",
    `${range}&by=week`,
    `${range}&branchId=nope`,
    "from=2026-13-01&to=2026-13-02",
    "from=2026-02-30&to=2026-02-30",
    "",
  ])
    expect((await as(w.owner.cookie, `/reports/sales?${query}`)).status, query).toBe(400);
  // A year and a day is the most one report reads.
  expect((await as(w.owner.cookie, "/reports/sales?from=2025-10-15&to=2026-10-15")).status).toBe(
    200,
  );
  expect((await as(w.owner.cookie, "/reports/dashboard?day=yesterday")).status).toBe(400);
  expect((await as(w.owner.cookie, "/reports/dashboard?day=2026-02-29")).status).toBe(400);
  expect((await as(w.owner.cookie, "/reports/stock/dead?on=2026-04-31")).status).toBe(400);
});

test("the shared runtime (Worker and box) serves /reports behind the session, not the public API", async () => {
  const cache = boxCache(":memory:");
  try {
    const options = { database: w.world.db, cache: cache.cache, secret, baseURL, orgId: ids.org };
    const send = (path: string, headers: Record<string, string>) =>
      serveRuntime(new Request(`${baseURL}${path}`, { headers }), options);
    expect((await send(`/reports/sales?${range}`, {})).status).toBe(401);
    const signedIn = await send(`/reports/sales?${range}`, { cookie: w.owner.cookie! });
    expect(signedIn.status).toBe(200);
    expect((await signedIn.json()).total.transactions).toBe(7);
    const csv = await send(`/reports/journal/export.csv?${range}`, { cookie: w.owner.cookie! });
    expect(csv.headers.get("content-type")).toContain("text/csv");
  } finally {
    cache.close();
  }
});

test("the branch picker offers a reader the branches they may report on", async () => {
  const mine = await as(scoped, "/reports/scope");
  expect(mine.status).toBe(200);
  expect(mine.body.branches.map((branch: any) => branch.id)).toEqual([w.otherBranch]);
  const all = await as(w.owner.cookie, "/reports/scope");
  expect(all.body.branches.map((branch: any) => branch.id).sort()).toEqual(
    [ids.branch, w.otherBranch].sort(),
  );
});
