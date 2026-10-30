// Day 26 done-when: no endpoint leaks across orgs. Every route the API mounts is called as shop A's owner
// with shop B's ids in its path, query and body; nothing of B may come back and nothing of B may change.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createApi } from "@shopper/api";
import { digestOf, idsOf, orgTables, referencesTo } from "../../../support/security/rows";
import {
  SENTINEL,
  call,
  db,
  startTenants,
  stopTenants,
  type Tenant,
} from "../../../support/security/tenants";

let a: Tenant;
let b: Tenant;
beforeAll(async () => ({ a, b } = await startTenants()), 120_000);
afterAll(stopTenants);

// Better Auth's own endpoints are scoped by the tenant selector (tested below); calling them as A would sign A out
// or change A's password and leave the rest of the sweep unauthenticated.
const SKIPPED = /^\/api\/auth\//;
const FOREIGN_KEYS = [
  "id",
  "orgId",
  "storeId",
  "branchId",
  "productId",
  "categoryId",
  "supplierId",
  "customerId",
  "userId",
  "roleId",
  "deviceId",
  "shiftId",
  "saleId",
  "approverId",
];

test("every route, called as shop A with shop B's ids, returns nothing of B and changes nothing of B", async () => {
  const tables = await orgTables(db);
  const foreign = await idsOf(db, tables, b.orgId);
  // A thin world proves little: B must own a shop's worth of things.
  expect(foreign.length).toBeGreaterThan(15);
  const before = await digestOf(db, tables, b.orgId);
  const leaks: string[] = [];
  const crashes: string[] = [];
  let reached = 0;
  for (const route of routes()) {
    const attempts = route.path.includes(":") ? foreign : [foreign[1]!];
    for (const id of attempts) {
      const path = route.path.replace(/:[A-Za-z]+(\{[^}]*\})?\??|\*/g, id);
      const query = FOREIGN_KEYS.map((key) => `${key}=${id}`).join("&");
      const write = route.method !== "GET";
      const response = await call(a, write ? path : `${path}?${query}`, {
        method: route.method,
        body: write ? Object.fromEntries(FOREIGN_KEYS.map((key) => [key, id])) : undefined,
      });
      if (![401, 403].includes(response.status)) reached += 1;
      // 503 is a runtime without that optional service (KYC, invitations, a renderer); anything else is a crash.
      if (response.status >= 500 && response.status !== 503)
        crashes.push(`${route.method} ${path} (${response.status})`);
      const text = (await response.text()).toLowerCase();
      // A refusal may quote the id it was given back; serving it, or showing any other id of B's, is a leak.
      const shown =
        foreign.find((value) => value !== id && text.includes(value)) ||
        (response.ok && text.includes(id) && id) ||
        (text.includes(SENTINEL.toLowerCase()) && SENTINEL);
      if (shown) leaks.push(`${route.method} ${route.path} (${response.status}) shows ${shown}`);
    }
  }
  expect(leaks).toEqual([]);
  expect(crashes).toEqual([]);
  // The sweep reached the handlers rather than bouncing off authentication.
  expect(reached).toBeGreaterThan(routes().length);
  expect((await call(a, "/stores")).status).toBe(200);
  expect(await digestOf(db, tables, b.orgId)).toEqual(before);
  expect(await referencesTo(db, tables, a.orgId, foreign)).toEqual([]);
}, 600_000);

test("A's session naming B as the shop is refused everywhere, and B's own lists stay B's", async () => {
  const lists = routes().filter((route) => route.method === "GET" && !route.path.includes(":"));
  expect(lists.length).toBeGreaterThan(20);
  for (const route of lists) {
    const response = await call(a, route.path, { org: b.orgId });
    const text = await response.text();
    expect(text, `${route.path} as A naming B`).not.toContain(SENTINEL);
    // Public routes answer anyone; everything else must not accept A's cookie for B.
    if (response.ok) expect(PUBLIC.test(route.path), `${route.path} answered A for B`).toBe(true);
  }
  // The positive control: B's owner does see B's data, so the absence above means something.
  const own = await call(b, "/products");
  expect(await own.text()).toContain(SENTINEL);
});

const PUBLIC = /^\/($|about|health|version|tax-rules|orgs\/|public\/)/;

/** Every route the API can mount, with each optional family switched on. */
function routes() {
  const stub = {} as never;
  const app = createApi({
    database: db,
    devices: stub,
    sequencer: stub,
    onboarding: stub,
    invitations: stub,
    kyb: stub,
    platform: stub,
    linkSecret: "route-listing-only",
  });
  const seen = new Set<string>();
  return app.routes
    .filter((route) => route.path !== "*" && route.path !== "/*" && !SKIPPED.test(route.path))
    .flatMap((route) =>
      (route.method === "ALL" ? ["GET", "POST"] : [route.method]).map((method) => ({
        method,
        path: route.path,
      })),
    )
    .filter(
      (route) =>
        !seen.has(`${route.method} ${route.path}`) && !!seen.add(`${route.method} ${route.path}`),
    );
}
