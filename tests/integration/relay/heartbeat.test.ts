// v1.5 Day 49: the box beats every minute. When the relay has not heard from it for 5 minutes inside a branch's
// opening hours, that branch's online ordering pauses: the store still prices the cart, but no order is taken until
// the box is back. Out of hours a silent box (switched off for the night) pauses nothing.
import { beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { boxRelayPublisher } from "@shopper/adapters-box";
import { listSlots, OrderError, placeOrder } from "@shopper/core/orders";
import { relayHeartbeat } from "@shopper/core/relay";
import { quoteCart } from "@shopper/core/storefront";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { emptyDatabase } from "../../support/migration/archive";
import { context, db } from "../auth/setup";
import { enrol, relayCloud, relayRow, type Box } from "./support";

let cloud: Awaited<ReturnType<typeof relayCloud>>;
let shop: Box;
const branch = v7();
const milo = v7();
// 10:00 Accra (UTC) on a trading day; the branch takes orders 08:00–20:00.
const morning = new Date("2026-11-26T10:00:00Z");
const minutes = (count: number, from = morning) => new Date(from.getTime() + count * 60_000);

beforeAll(async () => {
  cloud = await relayCloud();
  shop = await cloud.box();
  await enrol(shop);
  const store = v7();
  const batch = {
    stores: [{ id: store, name: "Osu Mart" }],
    branches: [{ id: branch, storeId: store, name: "Osu" }],
    fulfilment: [
      {
        id: v7(),
        branchId: branch,
        pickup: true,
        delivery: false,
        deliveryFee: 0,
        opens: "08:00",
        closes: "20:00",
        slotMinutes: 60,
        slotCapacity: 10,
        leadMinutes: 30,
      },
    ],
    products: [
      {
        id: milo,
        sku: "MILO",
        name: "Milo",
        categoryId: null,
        taxClass: "standard",
        baseUnit: "each",
        onlineVisible: true,
      },
    ],
    prices: [
      {
        id: v7(),
        productId: milo,
        branchId: null,
        amount: 45_000,
        validFrom: "2026-01-01T00:00:00.000Z",
        validTo: null,
      },
    ],
    availability: [{ id: milo, branches: [{ branchId: branch, available: 20_000 }] }],
  };
  const published = await cloud.send(shop, "/relay/publish", {
    method: "POST",
    body: JSON.stringify(batch),
  });
  expect(published.status).toBe(200);
});

const org = () => shop.licence.org;
const lines = [{ productId: milo, quantityThousandths: 1000 }];
const order = (now: Date) =>
  placeOrder(
    db,
    { orgId: org(), appVersion: context.appVersion },
    {
      key: v7(),
      branch,
      lines,
      fulfilment: "pickup",
      slot: minutes(120, now)
        .toISOString()
        .replace(/:\d\d:\d\d\.\d+Z$/, ":00:00.000Z"),
      name: "Ama Mensah",
      phone: "0244111222",
    },
    { launch: async () => {}, now },
  );
const seen = (at: Date | null) =>
  db.update(schema.relayBox).set({ lastSeenAt: at }).where(eq(schema.relayBox.orgId, org()));

test("box silent 5 min in opening hours → branch paused; heartbeat returns → resumes", async () => {
  await seen(minutes(-6));
  expect((await listSlots(db, org(), branch, morning)).paused).toBe(true);
  const refused = await order(morning).catch((error: unknown) => error);
  expect(refused).toBeInstanceOf(OrderError);
  expect((refused as OrderError).code).toBe("paused");
  // The cart is the shopper's: still priced in full while paused, so it is there when ordering resumes.
  const quote = await quoteCart(db, org(), { branch, lines }, morning);
  expect(quote.lines.map((line) => line.problem ?? null)).toEqual([null]);

  await relayHeartbeat(db, (await relayRow(shop))!, minutes(-1));
  expect((await listSlots(db, org(), branch, morning)).paused).toBe(false);
  const placed = await order(morning);
  expect(placed.status).toBe("placed");
  // Four minutes of silence is not five.
  expect((await listSlots(db, org(), branch, minutes(4, minutes(-1)))).paused).toBe(false);
});

test("a box never heard from pauses its branches; out of hours nothing pauses; a cloud shop never does", async () => {
  await seen(null);
  expect((await listSlots(db, org(), branch, morning)).paused).toBe(true);
  // 22:00: the branch is closed and the box may be off for the night.
  expect((await listSlots(db, org(), branch, minutes(12 * 60))).paused).toBe(false);
  // A cloud shop's branch, open at 10:00, with no box at all.
  const cloudShop = provisioningContext(v7());
  await provisionOrg(db, cloudShop, {
    name: "Labadi Mart",
    slug: `labadi-${Date.now().toString(36)}`,
  });
  const [cloudStore] = await db
    .insert(schema.store)
    .values({ orgId: cloudShop.orgId, name: "Labadi" })
    .returning();
  const [cloudBranch] = await db
    .insert(schema.branch)
    .values({ orgId: cloudShop.orgId, storeId: cloudStore!.id, name: "Labadi" })
    .returning();
  await db.insert(schema.branchFulfilment).values({
    orgId: cloudShop.orgId,
    branchId: cloudBranch!.id,
    pickup: true,
    opens: "08:00",
    closes: "20:00",
  });
  expect((await listSlots(db, cloudShop.orgId, cloudBranch!.id, morning)).paused).toBe(false);
});

test("each minute's run beats only after what is due reached the relay", async () => {
  const box = await emptyDatabase();
  const ctx = provisioningContext(org());
  await provisionOrg(box.db, ctx, { name: "Osu Mart", slug: `beat-${Date.now().toString(36)}` });
  const sent: string[] = [];
  let refuse: string | undefined;
  const publisher = boxRelayPublisher({
    withDatabase: (run) => run(box.db),
    appVersion: ctx.appVersion,
    send: async (path, init) => {
      sent.push(path);
      if (path === refuse) return Response.json({ error: "Support has ended" }, { status: 402 });
      return cloud.send(shop, path, init);
    },
  });
  await seen(null);
  // The minute's tick (`relaunch`) runs the Publisher, which beats once what is due is on the relay.
  await publisher.relaunch();
  await publisher.idle();
  // Online Orders off: the box says nothing.
  expect(sent).toEqual([]);
  await box.db.update(schema.org).set({ onlineOrders: true }).where(eq(schema.org.id, org()));
  await box.db.insert(schema.store).values({ orgId: org(), name: "Osu" });
  // Back from an outage with changes: they go up first, then the heartbeat.
  await publisher.relaunch();
  await publisher.idle();
  expect(sent).toEqual(["/relay/publish", "/relay/heartbeat"]);
  expect((await relayRow(shop))?.lastSeenAt).not.toBeNull();
  // A publish that does not go through sends no heartbeat, so the relay pauses rather than sell on stale stock.
  await seen(null);
  refuse = "/relay/publish";
  await box.db.insert(schema.store).values({ orgId: org(), name: "Spintex" });
  sent.length = 0;
  await publisher.relaunch();
  await publisher.idle();
  expect(sent).toEqual(["/relay/publish"]);
  expect((await relayRow(shop))?.lastSeenAt).toBeNull();
  // Nothing left to send, the heartbeat itself is refused: the reason is kept for the settings page and the run ends.
  refuse = "/relay/heartbeat";
  sent.length = 0;
  await publisher.relaunch();
  await publisher.idle();
  expect(sent).toEqual(["/relay/publish", "/relay/heartbeat"]);
  const [after] = await box.db
    .select({ error: schema.org.relayError })
    .from(schema.org)
    .where(eq(schema.org.id, org()));
  expect(after?.error).toBe("Support has ended");
  await box.close();
}, 180_000);
