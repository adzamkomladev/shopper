// Day 32 cart: the online cart is priced and taxed by the till's own quote (`quoteFrom`), from the same PostgreSQL
// rows a till receives in its snapshot, so the same basket costs the same online and at the till.
//   quoteCart(db, orgId, { branch?, lines, fulfilment? }, now) -> { branch, lines, delivery, totals, count }
// A line that cannot be bought (no price, not enough stock, hidden) is flagged and left out of the totals.
import { gunzipSync } from "node:zlib";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { boxBlobs } from "@shopper/adapters-box";
import { buildSnapshot } from "@shopper/core/changes";
import { quoteCart } from "@shopper/core/storefront";
import { provisionTillReference, quoteLine } from "@shopper/core/till";
import { branchFulfilment, org } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { stockShop } from "../../support/shop/store";
import { shopWorld } from "../../support/shop/world";
import { withTill, context as tillContext } from "../../support/till/basket";

let world: Awaited<ReturnType<typeof shopWorld>>;
let shop: Awaited<ReturnType<typeof stockShop>>;
let directory: string;
const made: Record<string, string> = {};
const now = new Date("2026-11-05T10:00:00.000Z");

beforeAll(async () => {
  world = await shopWorld();
  shop = await stockShop(world.db, world.a);
  made.oil = await shop.product("Frytol oil 1L", { price: 300_000, otherPrice: 280_000 });
  made.rice = await shop.product("Loose rice", { price: 185_000, baseUnit: "kg" });
  made.water = await shop.product("Voltic water 1.5L", {
    price: 65_000,
    taxClass: "exempt",
    stock: [24_000, 24_000],
  });
  made.unpriced = await shop.product("Loose kenkey", { price: null });
  made.scarce = await shop.product("Last tin of Milo", { stock: [1_000, 0] });
  made.hidden = await shop.product("Staff only biscuits", { visible: false });
  directory = await mkdtemp(join(tmpdir(), "shopper-cart-"));
}, 120_000);
afterAll(async () => {
  await world?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

const basket = [
  { productId: () => made.oil!, quantityThousandths: 2_000 },
  { productId: () => made.rice!, quantityThousandths: 1_250 },
  { productId: () => made.water!, quantityThousandths: 6_000 },
];

/** The till's quote for the same basket: the store's snapshot provisioned into a till, then `quoteLine` per line. */
async function tillQuote(branchId: string) {
  // A fresh blob store each time: a snapshot is cached by its feed cursor, and a settings change alone keeps it.
  const { blobs } = await boxBlobs(await mkdtemp(join(directory, "blobs-")), {
    baseUrl: "https://shopper.test/blobs",
    secret: new Uint8Array(32).fill(7),
  });
  const bytes = await buildSnapshot(
    world.db,
    blobs,
    { orgId: world.a.orgId, storeId: shop.storeId },
    world.a.context,
  );
  const snapshot = JSON.parse(gunzipSync(bytes).toString()) as {
    reference: Record<string, any>;
  };
  const reference = snapshot.reference;
  return withTill(async (till) => {
    await provisionTillReference(
      till,
      { ...tillContext, orgId: world.a.orgId },
      {
        products: reference.products,
        prices: reference.prices,
        taxRules: reference.taxRules,
        cashRounding: reference.settings.cashRounding,
        settings: {
          priceMode: reference.settings.priceMode,
          vatRegisteredFrom: reference.settings.vatRegisteredFrom,
          tin: reference.settings.tin,
        },
      },
    );
    return Promise.all(
      basket.map((line) =>
        quoteLine(till, {
          orgId: world.a.orgId,
          branchId,
          productId: line.productId(),
          quantityThousandths: line.quantityThousandths,
          at: now,
        }),
      ),
    );
  });
}

const cart = (branchId: string, over: Record<string, unknown> = {}) =>
  quoteCart(
    world.db,
    world.a.orgId,
    {
      branch: branchId,
      lines: basket.map((line) => ({
        productId: line.productId(),
        quantityThousandths: line.quantityThousandths,
      })),
      ...over,
    },
    now,
  );

for (const mode of ["inclusive", "exclusive"] as const)
  test(`the cart total equals the till total for the same basket (${mode} prices)`, async () => {
    await world.db.update(org).set({ priceMode: mode }).where(eq(org.id, world.a.orgId));
    // The other branch has its own oil price: both sides must take it.
    for (const branchId of shop.branches) {
      const till = await tillQuote(branchId);
      const online = await cart(branchId);
      expect(online.lines.map((line) => line.problem)).toEqual([null, null, null]);
      for (const [index, line] of online.lines.entries()) {
        expect(line.priceId).toBe(till[index]!.priceId);
        expect(line.tax).toEqual(till[index]!.tax);
      }
      const gross = till.reduce((sum, line) => sum + line.tax.gross, 0);
      expect(online.totals.gross).toBe(gross);
      expect(online.totals.vat).toBe(till.reduce((sum, line) => sum + line.tax.vat, 0));
      expect(online.count).toBe(3);
    }
    // The branch price really is in play, so the comparison above covered it.
    const [main, other] = await Promise.all(shop.branches.map((id) => cart(id)));
    expect(main.lines[0]!.tax?.unitPrice).toBe(300_000);
    expect(other.lines[0]!.tax?.unitPrice).toBe(280_000);
  });

test("a line the shop cannot sell is flagged and left out of the totals", async () => {
  await world.db.update(org).set({ priceMode: "inclusive" }).where(eq(org.id, world.a.orgId));
  const quoted = await quoteCart(
    world.db,
    world.a.orgId,
    {
      branch: shop.branches[0],
      lines: [
        { productId: made.oil, quantityThousandths: 1_000 },
        { productId: made.unpriced, quantityThousandths: 1_000 },
        { productId: made.scarce, quantityThousandths: 2_000 },
        { productId: made.hidden, quantityThousandths: 1_000 },
        { productId: crypto.randomUUID(), quantityThousandths: 1_000 },
      ],
    },
    now,
  );
  expect(quoted.lines.map((line) => line.problem)).toEqual([
    null,
    "unavailable",
    "short",
    "unavailable",
    "unavailable",
  ]);
  // The short line still says how much there is, so the cart can offer it.
  expect(quoted.lines[2]).toMatchObject({ name: "Last tin of Milo", availableThousandths: 1_000 });
  expect(quoted.totals.gross).toBe(300_000);
  expect(quoted.count).toBe(1);
});

test("delivery adds the branch's flat fee as a standard-rated line, taxed only while registered", async () => {
  await world.db.insert(branchFulfilment).values({
    orgId: world.a.orgId,
    branchId: shop.branches[0],
    delivery: true,
    deliveryFee: money(150_000),
  });
  const pickup = await cart(shop.branches[0]);
  expect(pickup.delivery).toBeNull();
  const delivered = await cart(shop.branches[0], { fulfilment: "delivery" });
  expect(delivered.delivery).toMatchObject({ gross: 150_000 });
  expect(delivered.delivery!.vat).toBeGreaterThan(0);
  expect(delivered.totals.gross).toBe(pickup.totals.gross + 150_000);
  await world.db.update(org).set({ vatRegisteredFrom: null }).where(eq(org.id, world.a.orgId));
  const unregistered = await cart(shop.branches[0], { fulfilment: "delivery" });
  expect(unregistered.delivery).toMatchObject({ gross: 150_000, vat: 0, nhil: 0 });
  // A branch that does not deliver gets no fee line, whatever the cart asks.
  const other = await cart(shop.branches[1], { fulfilment: "delivery" });
  expect(other.delivery).toBeNull();
  await world.db
    .update(org)
    .set({ vatRegisteredFrom: "2000-01-01" })
    .where(eq(org.id, world.a.orgId));
});
