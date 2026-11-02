// Day 31 storefront: the public store reads only `catalogue_public` (visible online, not archived), prices each
// product as the till would at the same moment and lists it only where the selected branch has it in stock.
//   GET /shop/:code/store                  -> { name, branches, categories }
//   GET /shop/:code/products?branch&category&q&page -> a page of products available at the branch
//   GET /shop/:code/products/:id?branch    -> the product, with `available` false where it cannot be bought
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { priceAt } from "@shopper/core/catalogue";
import { shopHttp } from "../../support/shop/http";
import { stockShop } from "../../support/shop/store";
import { shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let http: ReturnType<typeof shopHttp>;
let shop: Awaited<ReturnType<typeof stockShop>>;
const made: Record<string, string> = {};

beforeAll(async () => {
  world = await shopWorld();
  http = shopHttp(world);
  shop = await stockShop(world.db, world.a);
  made.rice = await shop.product("Jasmine rice 5kg", { stock: [10_000, 0] });
  made.oil = await shop.product("Frytol oil 1L", {
    price: 300_000,
    otherPrice: 280_000,
    futurePrice: 350_000,
  });
  made.hidden = await shop.product("Staff only biscuits", { visible: false });
  made.archived = await shop.product("Old tin tomatoes", { archived: true });
  made.unpriced = await shop.product("Loose kenkey", { price: null });
  for (let index = 0; index < 23; index += 1)
    await shop.product(`Milo sachet ${String(index).padStart(2, "0")}`, { categoryId: null });
  const other = await stockShop(world.db, world.b);
  made.foreign = await other.product("Kumasi shito");
}, 120_000);
afterAll(async () => {
  http?.close();
  await world?.close();
});

const read = async (path: string) => {
  const response = await http.request(path);
  return {
    status: response.status,
    body: (await response.json()) as Record<string, any>,
    response,
  };
};
const names = (body: Record<string, any>) => body.products.map((row: any) => row.name as string);
const store = (query = "") => read(`/shop/${world.a.slug}/products${query}`);

test("a product out of stock at the selected branch is hidden there and listed where it is in stock", async () => {
  const main = await store(`?branch=${shop.branches[0]}&q=rice`);
  expect(main.status).toBe(200);
  expect(main.body.branch).toEqual({ id: shop.branches[0], name: "Osu" });
  expect(names(main.body)).toEqual(["Jasmine rice 5kg"]);
  expect(names((await store(`?branch=${shop.branches[1]}&q=rice`)).body)).toEqual([]);
  const page = await read(`/shop/${world.a.slug}/products/${made.rice}?branch=${shop.branches[1]}`);
  expect(page.status).toBe(200);
  expect(page.body.product).toMatchObject({ name: "Jasmine rice 5kg", available: false });
  // Without a branch the store shows the first one.
  expect(names((await store("?q=rice")).body)).toEqual(["Jasmine rice 5kg"]);
});

test("the price shown is the till's price at the same moment: branch price first, nothing early", async () => {
  for (const [index, expected] of [
    [0, 300_000],
    [1, 280_000],
  ] as const) {
    const branchId = shop.branches[index];
    const { body } = await read(`/shop/${world.a.slug}/products/${made.oil}?branch=${branchId}`);
    const till = await priceAt(world.db, {
      orgId: world.a.orgId,
      productId: made.oil!,
      branchId,
      at: new Date(),
    });
    expect(body.product.price).toBe(expected);
    expect(body.product.price).toBe(till!.amount);
    const listed = (await store(`?branch=${branchId}&q=frytol`)).body.products[0];
    expect(listed.price).toBe(till!.amount);
  }
  // In stock but never priced: the till could not sell it, so neither does the store.
  expect(names((await store("?q=kenkey")).body)).toEqual([]);
  const unpriced = await read(`/shop/${world.a.slug}/products/${made.unpriced}`);
  expect(unpriced.body.product).toMatchObject({ price: null, available: false });
});

test("hidden and archived products are never listed or readable", async () => {
  const all = [...names((await store("?page=1")).body), ...names((await store("?page=2")).body)];
  expect(all).not.toContain("Staff only biscuits");
  expect(all).not.toContain("Old tin tomatoes");
  for (const id of [made.hidden, made.archived])
    expect((await read(`/shop/${world.a.slug}/products/${id}`)).status).toBe(404);
});

test("search, category and paging narrow the same list", async () => {
  const first = await store();
  expect(first.body).toMatchObject({ page: 1, pages: 2, total: 25 });
  expect(first.body.products).toHaveLength(24);
  expect((await store("?page=2")).body.products).toHaveLength(1);
  expect(names((await store("?q=MILO SACHET 0")).body)).toHaveLength(10);
  expect(names((await store(`?category=${shop.category}`)).body).sort()).toEqual(
    ["Frytol oil 1L", "Jasmine rice 5kg"].sort(),
  );
  expect(names((await store("?q=%25")).body)).toEqual([]);
  const info = await read(`/shop/${world.a.slug}/store`);
  expect(info.body).toMatchObject({
    name: `${world.a.slug} Mart`,
    branches: [
      { id: shop.branches[0], name: "Osu" },
      { id: shop.branches[1], name: "Kaneshie" },
    ],
    categories: [{ id: shop.category, name: "Groceries" }],
  });
  expect(info.response.headers.get("cache-control")).toBe("public, max-age=60");
});

test("unknown shops, branches and other shops' products are a plain 404", async () => {
  expect((await read("/shop/no-such-shop/products")).status).toBe(404);
  expect((await store(`?branch=${crypto.randomUUID()}`)).status).toBe(404);
  expect((await read(`/shop/${world.a.slug}/products/${made.foreign}`)).status).toBe(404);
  expect((await read(`/shop/${world.a.slug}/products/not-a-uuid`)).status).toBe(404);
  expect(names((await store("?q=shito")).body)).toEqual([]);
});
