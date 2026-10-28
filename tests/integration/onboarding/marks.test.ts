// The real commands mark onboarding: the first accepted sale through the till upload route stamps trading once, and
// the first product made in the back office stamps the catalogue, each waking the workflow after it commits.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { createApi } from "@shopper/api";
import * as schema from "@shopper/db-pg";
import { ids } from "../../fixtures/sales/golden";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { portalOwner, protectOwner, type Portal } from "../../support/api/portal";
import { notifications, sentMessages } from "../../support/stock/queue";
import { devices } from "../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  await protectOwner(ids.org, owner);
  await world.db.insert(schema.onboarding).values({ orgId: ids.org });
}, 300_000);
afterAll(async () => {
  await world?.local.close();
});

const row = async () =>
  (await world.db.select().from(schema.onboarding).where(eq(schema.onboarding.orgId, ids.org)))[0]!;
const events = async (mark: string) =>
  (await sentMessages()).filter(
    (message) =>
      message.orgId === ids.org &&
      message.type === "onboarding.event" &&
      (message.payload as { mark: string }).mark === mark,
  );

test("the first accepted sale stamps trading; the rest of the day sends no second event", async () => {
  expect((await row()).status).toBe("setup");
  const [first, ...rest] = tradingDay;
  await runGolden(world, first!);
  const stamped = await row();
  expect(stamped.status).toBe("trading");
  const firstSaleAt = stamped.firstSaleAt!;
  expect(firstSaleAt).toBeInstanceOf(Date);
  for (const scenario of rest.slice(0, 3)) await runGolden(world, scenario);
  expect((await row()).firstSaleAt).toEqual(firstSaleAt);
  expect(await events("first_sale")).toHaveLength(1);
});

test("the first product made through the API stamps the catalogue once", async () => {
  const api = createApi({ database: world.db, devices, authentication: owner.auth, notifications });
  const create = (sku: string) =>
    api.request("/products", {
      method: "POST",
      headers: { cookie: owner.cookie, "content-type": "application/json" },
      body: JSON.stringify({
        sku,
        name: `Onboarding ${sku}`,
        baseUnit: "each",
        taxClass: "standard",
      }),
    });
  expect((await create("ONB-1")).status).toBe(201);
  const stamped = (await row()).catalogueAt;
  expect(stamped).toBeInstanceOf(Date);
  expect((await create("ONB-2")).status).toBe(201);
  expect((await row()).catalogueAt).toEqual(stamped);
  expect(await events("catalogue")).toHaveLength(1);
});
