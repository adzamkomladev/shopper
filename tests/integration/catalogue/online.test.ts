// v1.5 Day 47: a category hidden online hides its products from the store, and a hidden department hides every
// category under it. Showing it again brings them back; each change is the audited category save.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { saveCategory } from "@shopper/core/catalogue";
import { shopHttp } from "../../support/shop/http";
import { stockShop } from "../../support/shop/store";
import { shopWorld } from "../../support/shop/world";

let world: Awaited<ReturnType<typeof shopWorld>>;
let http: ReturnType<typeof shopHttp>;
let shop: Awaited<ReturnType<typeof stockShop>>;
let drinks: string;

beforeAll(async () => {
  world = await shopWorld();
  http = shopHttp(world);
  // "Groceries" is the department; "Drinks" is a category under it.
  shop = await stockShop(world.db, world.a);
  drinks = v7();
  await world.db
    .insert(schema.category)
    .values({ id: drinks, orgId: world.a.orgId, name: "Drinks", parentId: shop.category });
  await shop.product("Jasmine rice 5kg");
  await shop.product("Malta Guinness", { categoryId: drinks });
  await shop.product("Loose kenkey", { categoryId: null });
}, 120_000);
afterAll(async () => {
  http?.close();
  await world?.close();
});

const listed = async () => {
  const response = await http.request(`/shop/${world.a.slug}/products?branch=${shop.branches[0]}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { products: { name: string }[] };
  return body.products.map((row) => row.name).sort();
};
const show = (id: string, onlineVisible: boolean) =>
  saveCategory(world.db, world.a.context, { id, data: { onlineVisible } });

test("a hidden category hides its products, a hidden department hides its categories' too", async () => {
  expect(await listed()).toEqual(["Jasmine rice 5kg", "Loose kenkey", "Malta Guinness"]);

  await show(drinks, false);
  expect(await listed()).toEqual(["Jasmine rice 5kg", "Loose kenkey"]);
  await show(drinks, true);

  await show(shop.category, false);
  expect(await listed()).toEqual(["Loose kenkey"]);
  await show(shop.category, true);
  expect(await listed()).toEqual(["Jasmine rice 5kg", "Loose kenkey", "Malta Guinness"]);

  const audit = await world.db
    .select({ after: schema.auditLog.after })
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, world.a.orgId), eq(schema.auditLog.command, "category.save")),
    );
  expect(audit.map((row) => (row.after as { onlineVisible: boolean }).onlineVisible)).toEqual([
    false,
    true,
    false,
    true,
  ]);
});
