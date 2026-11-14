// Day 42: the cloud takes the commit but its answer never reaches the box. The box cannot tell whether the cloud has
// the shop, so it must stay read-only: reopening it would let new sales land where the cloud will never see them.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { boxAndCloud } from "../../support/migration/move";

let h: Awaited<ReturnType<typeof boxAndCloud>>;

beforeAll(async () => {
  h = await boxAndCloud(async (url, init, send) => {
    const response = await send(url, init);
    if (url.endsWith("/commit")) throw new Error("The connection was reset");
    return response;
  });
  await h.start();
  await h.settle();
}, 300_000);
afterAll(async () => h?.close());

test("a commit whose answer was lost keeps the box read-only and says why", async () => {
  const [move] = await h.f.db.select().from(schema.cloudMove);
  expect(move).toMatchObject({ status: "importing", error: expect.stringContaining("cloud") });
  const customer = await h.box.request("/customers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: v7(), name: "Ama Mensah" }),
  });
  expect(customer.status).toBe(423);
  // The cloud did take the shop: a reopened box would have split it in two.
  const [imported] = await h.b.db.select().from(schema.archiveImport);
  expect(imported!.status).toBe("ready");
});
