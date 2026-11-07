// Day 34: the tables fulfilment rests on refuse what the business never allows, however the command above is written.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";
import { migrateDatabase } from "../../../../tooling/database/migrate";
import { provisionOrg, provisioningContext } from "../../../../tooling/database/seed";
import { postgresFixture } from "../../../fixtures/postgres";
import { holdWorld } from "../../../support/orders/holds";

let fixture: Awaited<ReturnType<typeof postgresFixture>>;
let pool: Pool;
let db: schema.ShopperDatabase;
let orgId: string;
let orderId: string;
let lineId: string;
let productId: string;
beforeAll(async () => {
  fixture = await postgresFixture();
  pool = new Pool({ connectionString: fixture.connectionString });
  db = drizzle(pool, { schema });
  await migrateDatabase(db);
  const context = provisioningContext();
  await provisionOrg(db, context, { name: "Fulfil schema" });
  orgId = context.orgId;
  const world = await holdWorld(db, orgId);
  orderId = (await world.seed(db, world.branchId, 60_000)).orderId;
  const [held] = await db.select().from(schema.stockHold);
  productId = held!.productId;
  const [line] = await db
    .insert(schema.onlineOrderLine)
    .values({
      orgId,
      orderId,
      position: 0,
      kind: "product",
      productId,
      priceId: (
        await db
          .insert(schema.price)
          .values({ orgId, productId, amount: money(10_000), validFrom: new Date(0) })
          .returning()
      )[0]!.id,
      quantityThousandths: 2_000,
      gross: money(20_000),
      payload: {},
    })
    .returning();
  lineId = line!.id;
}, 120_000);
afterAll(async () => {
  await pool?.end();
  await fixture?.close();
});

const rejects = (run: () => Promise<unknown>, constraint: string) =>
  expect(run()).rejects.toMatchObject({ cause: { constraint } });

test("a line has one pick, and a substitute needs everything a substitute is", async () => {
  const pick = { orgId, orderId, lineId, outcome: "picked" as const, pickedThousandths: 2_000 };
  await db.insert(schema.onlineOrderPick).values(pick);
  await rejects(() => db.insert(schema.onlineOrderPick).values(pick), "online_order_pick_line");
  const other = { ...pick, lineId: crypto.randomUUID() };
  await rejects(
    () => db.insert(schema.onlineOrderPick).values({ ...other, outcome: "substituted" }),
    "online_order_pick_substitute",
  );
});

test("an adjustment adds up: what is charged now plus what is refunded is what was charged before", async () => {
  const sum = { orgId, orderId, beforeGross: money(30_000), afterGross: money(20_000) };
  await rejects(
    () => db.insert(schema.onlineOrderAdjustment).values({ ...sum, refundAmount: money(5_000) }),
    "online_order_adjustment_sum",
  );
  await db.insert(schema.onlineOrderAdjustment).values({ ...sum, refundAmount: money(10_000) });
  await rejects(
    () => db.insert(schema.onlineOrderAdjustment).values({ ...sum, refundAmount: money(10_000) }),
    "online_order_adjustment_order",
  );
});

test("a review is one to five stars, one per order, and published only with a publish time", async () => {
  const review = { orgId, orderId, branchId: crypto.randomUUID(), authorName: "Ama", rating: 5 };
  await rejects(
    () => db.insert(schema.orderReview).values({ ...review, rating: 6 }),
    "order_review_rating",
  );
  await rejects(
    () => db.insert(schema.orderReview).values({ ...review, status: "published" }),
    "order_review_published",
  );
  await db.insert(schema.orderReview).values(review);
  await rejects(() => db.insert(schema.orderReview).values(review), "order_review_order");
});

test("an order reaches each status once", async () => {
  const event = { orgId, orderId, status: "accepted" as const };
  await db.insert(schema.onlineOrderEvent).values(event);
  await rejects(
    () => db.insert(schema.onlineOrderEvent).values(event),
    "online_order_event_status",
  );
});
