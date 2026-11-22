// v1.5 Day 52: tax parity. The relay prices an on-prem shop's online checkout from what its box published; the box
// re-prices the order on acceptance from its own rows. Both run `quoteCart`, so for any basket the two must agree to
// the pesewa: every line's price, base, VAT, NHIL, GETFund and COVID levy, the delivery line and the total. 200 seeded
// random baskets, then 50 more after the box changes its own tax rule and price mode.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createProduct, setPrice } from "@shopper/core/catalogue";
import { publishPending } from "@shopper/core/relay";
import { quoteCart } from "@shopper/core/storefront";
import { money } from "@shopper/money";
import { ghana2026 } from "@shopper/tax";
import { provisionOrg, provisioningContext } from "../../../tooling/database/seed";
import { emptyDatabase } from "../../support/migration/archive";
import { db as relayDb } from "../auth/setup";
import { enrol, relayCloud } from "./support";

let box: Awaited<ReturnType<typeof emptyDatabase>>;
let publish: () => Promise<unknown>;
let orgId: string;
const branches: string[] = [];
const products: { id: string; baseUnit: "each" | "kg" }[] = [];

// A seeded generator (mulberry32): the same 250 baskets every run, so a failure can be replayed.
const random = ((seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
})(52);
const between = (low: number, high: number) => low + Math.floor(random() * (high - low + 1));

beforeAll(async () => {
  const cloud = await relayCloud();
  const shop = await cloud.box();
  await enrol(shop);
  box = await emptyDatabase();
  const ctx = provisioningContext(shop.licence.org);
  orgId = ctx.orgId;
  await provisionOrg(box.db, ctx, { name: "Osu Mart", slug: `parity-${Date.now().toString(36)}` });
  await box.db
    .update(schema.org)
    .set({ onlineOrders: true, tin: "P0012345678", vatRegisteredFrom: "2020-01-01" })
    .where(eq(schema.org.id, orgId));
  const store = v7();
  await box.db.insert(schema.store).values({ id: store, orgId, name: "Osu" });
  for (const name of ["Osu Main", "Osu Annex"]) {
    const id = v7();
    await box.db.insert(schema.branch).values({ id, orgId, storeId: store, name });
    await box.db.insert(schema.branchFulfilment).values({
      orgId,
      branchId: id,
      pickup: true,
      delivery: true,
      deliveryFee: money(between(1, 40) * 1_250),
      opens: "00:00",
      closes: "23:59",
      slotMinutes: 60,
      slotCapacity: 50,
      leadMinutes: 0,
    });
    branches.push(id);
  }
  const classes = ["standard", "zero-rated", "exempt"] as const;
  for (let index = 0; index < 24; index += 1) {
    const baseUnit = index % 4 === 0 ? "kg" : "each";
    const { id } = await createProduct(box.db, ctx, {
      sku: `P-${index}`,
      name: `Product ${index}`,
      baseUnit,
      taxClass: classes[index % 3]!,
      onlineVisible: true,
    });
    // Odd amounts on purpose: levies on them round, and the two sides must round alike.
    await setPrice(box.db, ctx, { productId: id, data: { amount: between(1, 60_000) * 7 + 3 } });
    if (index % 3 === 1)
      await setPrice(box.db, ctx, {
        productId: id,
        data: { amount: between(1, 60_000) * 11 + 1, branchId: branches[1] },
      });
    for (const branchId of branches)
      await box.db.insert(schema.stockMovement).values({
        orgId,
        branchId,
        productId: id,
        reason: "adjustment",
        quantityThousandths: 1_000_000_000,
        occurredAt: new Date(Date.now() - 60_000),
      });
    products.push({ id, baseUnit });
  }
  publish = () =>
    publishPending(box.db, ctx, { send: (path, init) => cloud.send(shop, path, init) });
  await publish();
}, 180_000);
afterAll(async () => box?.close());

/** One random basket: a branch, pickup or delivery, and 1–6 distinct lines (weighed lines in grams, others in units). */
function basket() {
  const picked = [...products].sort(() => random() - 0.5).slice(0, between(1, 6));
  return {
    branch: branches[between(0, 1)]!,
    fulfilment: random() < 0.5 ? ("pickup" as const) : ("delivery" as const),
    lines: picked.map((product) => ({
      productId: product.id,
      quantityThousandths: product.baseUnit === "kg" ? between(1, 5_000) : between(1, 9) * 1_000,
    })),
  };
}

/** What the shopper is charged: everything but the stock figure (the relay's is the box's, floored to a step). */
const charged = (quote: Awaited<ReturnType<typeof quoteCart>>) => ({
  lines: quote.lines.map((line) => ({
    productId: line.productId,
    quantityThousandths: line.quantityThousandths,
    priceId: line.priceId,
    tax: line.tax,
    problem: line.problem,
  })),
  delivery: quote.delivery,
  totals: quote.totals,
  count: quote.count,
});

const agree = async (count: number) => {
  const now = new Date();
  for (let index = 0; index < count; index += 1) {
    const cart = basket();
    const online = charged(await quoteCart(relayDb, orgId, cart, now));
    expect(online.count, `basket ${index} priced every line`).toBe(cart.lines.length);
    expect(online, `basket ${index}`).toEqual(charged(await quoteCart(box.db, orgId, cart, now)));
  }
};

test("tax parity: the cloud's total equals the box's for 200 random baskets", async () => {
  await agree(200);
});

test("tax parity holds after the box changes its tax rule and price mode", async () => {
  // A new rate from yesterday (as a tax pack applies it), and prices that now exclude tax.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await box.db.insert(schema.taxRule).values({
    orgId,
    ...ghana2026,
    effectiveFrom: yesterday,
    vatBps: 2_000,
    covidBps: 100,
  });
  await box.db.update(schema.org).set({ priceMode: "exclusive" }).where(eq(schema.org.id, orgId));
  await publish();
  await agree(50);
});
