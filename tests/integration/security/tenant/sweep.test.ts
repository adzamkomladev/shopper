// Day 26 done-when: no endpoint leaks across orgs. Every route the API mounts is called as shop A's owner
// with shop B's ids in its path, query and body; nothing of B may come back and nothing of B may change.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { createApi } from "@shopper/api";
import { BODIES, ELSEWHERE, PARAMS, PRE_SHOP } from "../../../support/security/bodies";
import { digestOf, heldBy, idsOf, orgTables, referencesTo } from "../../../support/security/rows";
import { SENTINEL, call, db, startTenants, stopTenants } from "../../../support/security/tenants";

type Tenants = Awaited<ReturnType<typeof startTenants>>;
let a: Tenants["a"];
let b: Tenants["b"];
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
// Rows of A's that may hold an id they were given. A register asks approval for a refund of a sale it names; the
// sale may not have synced yet, so the request keeps the id as written, and the refund itself is checked in A's
// shop when it arrives (the sweep's own refund of B's sale is refused).
const REFERENCES_KEPT = ["public.approval_request"];
// A till's own calls: sync uploads, MoMo, and asking the back office for an approval.
const FROM_TILL = /^(POST|GET) \/(sync|payments)(\/|$)|^POST \/approvals$/;
// The input never reached the handler: the request proves nothing about the shop check behind it.
// A till upload answers 200 with the event refused as malformed: that, too, never reached the shop check.
const UNCHECKED =
  /^\{"error":"(Invalid request data|Malformed [a-z ]+|Invalid payment data)"|"code":"INVALID_(EVENT|DOCUMENT)"/;

test("every route, called as shop A with shop B's ids, returns nothing of B and changes nothing of B", async () => {
  const tables = await orgTables(db);
  const foreign = await idsOf(db, tables, b.orgId);
  // A thin world proves little: B must own a shop's worth of things.
  expect(foreign.length).toBeGreaterThan(15);
  const before = await digestOf(db, tables, b.orgId);
  const leaks: string[] = [];
  const crashes: string[] = [];
  const checked = new Set<string>();
  let reached = 0;
  for (const route of routes()) {
    const key = `${route.method} ${route.path}`;
    const attempts = route.path.includes(":") ? foreign : [foreign[1]!];
    for (const id of attempts) {
      const path = route.path.replace(
        /:([A-Za-z]+)(\{[^}]*\})?\??|\*/g,
        (_match, name?: string) => (name && PARAMS[name]) || id,
      );
      const query = FOREIGN_KEYS.map((field) => `${field}=${id}`).join("&");
      const write = route.method !== "GET";
      const response = await call(a, write ? path : `${path}?${query}`, {
        method: route.method,
        body: write
          ? (BODIES[key]?.(id, a.till) ??
            Object.fromEntries(FOREIGN_KEYS.map((field) => [field, id])))
          : undefined,
        till: FROM_TILL.test(key) ? a.till : undefined,
      });
      if (![401, 403].includes(response.status)) reached += 1;
      // 503 is a runtime without that optional service (Hubtel, settlements); anything else is a crash.
      if (response.status >= 500 && response.status !== 503)
        crashes.push(`${route.method} ${path} (${response.status})`);
      const raw = await response.text();
      if (!UNCHECKED.test(raw)) checked.add(key);
      const text = raw.toLowerCase();
      const at = `${key} (${response.status})`;
      // A write may quote back an id it was given; a read that serves it, or any other id of B's, is a leak.
      const other = foreign.find((value) => value !== id && text.includes(value));
      if (other) leaks.push(`${at} shows ${other}`);
      if (!write && response.ok && text.includes(id)) leaks.push(`${at} serves ${id}`);
      if (text.includes(SENTINEL.toLowerCase())) leaks.push(`${at} shows ${SENTINEL}`);
    }
  }
  expect(leaks).toEqual([]);
  expect(crashes).toEqual([]);
  // Every write got past its input validation with B's ids, or names the suite that proves it instead.
  const unchecked = routes()
    .map((route) => `${route.method} ${route.path}`)
    .filter((key) => !key.startsWith("GET ") && !checked.has(key));
  expect(unchecked.sort()).toEqual([...Object.keys(ELSEWHERE), ...PRE_SHOP].sort());
  for (const proof of Object.values(ELSEWHERE))
    expect(readFileSync(proof.file, "utf8"), proof.file).toContain(proof.test);
  // The sweep reached the handlers rather than bouncing off authentication.
  expect(reached).toBeGreaterThan(routes().length);
  expect((await call(a, "/stores")).status).toBe(200);
  expect(await digestOf(db, tables, b.orgId)).toEqual(before);
  // Every id A created is its own: none of B's ids became a row of A's, and none of A's rows points at B.
  expect([...(await heldBy(db, tables, a.orgId, foreign))]).toEqual([]);
  expect(await referencesTo(db, tables, a.orgId, foreign)).toEqual(REFERENCES_KEPT);
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
