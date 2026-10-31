// The admin app and a shop's KYB form reach the API through the shared runtime (Worker and box), not createApi: a
// path the runtime does not list falls through to the public API and answers 404. The platform org lookup is public,
// so the admin sign-in can name the org before anyone has a session.
import { afterAll, expect, test } from "vite-plus/test";
import { boxCache, boxRateLimiter } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { baseURL, secret } from "../auth/setup";
import { blobs, context, cookies, db, platformContext, queue, staff } from "./support";

const rateLimiter = boxRateLimiter();

const cache = boxCache(":memory:");
afterAll(() => cache.close());

const send = (path: string, headers: Record<string, string> = {}) =>
  serveRuntime(new Request(`${baseURL}${path}`, { headers }), {
    database: db,
    cache: cache.cache,
    rateLimiter,
    secret,
    baseURL,
    blobs,
    notifications: queue,
    kyb: { banks: async () => [] },
    platform: { orgSlug: "shopper" },
  });

test("the platform org answers without a session or a shop", async () => {
  const response = await send("/platform/org");
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: platformContext.orgId, slug: "shopper" });
});

test("the platform routes run behind the staff session", async () => {
  const platformOrg = { "X-Shopper-Org": platformContext.orgId };
  expect((await send("/platform/kyb", platformOrg)).status).toBe(401);
  const signedIn = { ...platformOrg, cookie: staff.get("reviewer")! };
  expect((await send("/platform/kyb?status=in_review", signedIn)).status).toBe(200);
  expect((await send("/platform/tenants", signedIn)).status).toBe(200);
});

test("a shop's KYB form runs behind its session", async () => {
  const shop = { "X-Shopper-Org": context.orgId };
  expect((await send("/kyb", shop)).status).toBe(401);
  expect((await send("/kyb", { ...shop, cookie: cookies.get("superadmin")! })).status).toBe(200);
});
