// The audit screens' API goes through the shared runtime (Worker and box) behind the session: a path it does not
// list falls through to the public API, which has no audit routes and answers 404.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { boxCache } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";
import { baseURL, portalOwner, secret, type Portal } from "../../support/api/portal";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
});
afterAll(async () => world?.local.close());

test("the runtime serves the audit area behind the session, not the public API", async () => {
  const cache = boxCache(":memory:");
  try {
    const options = {
      database: databases().db,
      cache: cache.cache,
      secret,
      baseURL,
      orgId: ids.org,
    };
    for (const path of ["/audit", "/audit/streams", "/audit/export.csv"]) {
      const send = (headers: Record<string, string>) =>
        serveRuntime(new Request(`${baseURL}${path}`, { headers }), options);
      expect((await send({})).status, path).toBe(401);
      expect((await send({ cookie: owner.cookie })).status, path).toBe(200);
    }
  } finally {
    cache.close();
  }
});
