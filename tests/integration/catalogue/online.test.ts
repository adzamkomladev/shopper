// v1.5 Day 47: a category hidden online hides its products from the store, and a hidden department hides every
// category under it. Showing it again brings them back; each change is the audited category save. On a box the
// Online Orders switch and every catalogue, store, branch or fulfilment write wake the Publisher; switching on
// forgets what was sent.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { saveCategory } from "@shopper/core/catalogue";
import { createApi, type ApiAuthentication } from "@shopper/api";
import type { WorkflowLauncher } from "@shopper/ports";
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

test("the Online Orders switch and every catalogue write wake the Publisher; switching on starts afresh", async () => {
  const woken: string[] = [];
  const publisher: WorkflowLauncher = {
    start: async (id) => void woken.push(id),
    send: async () => undefined,
  };
  const [owner] = await world.db
    .insert(schema.user)
    .values({ orgId: world.a.orgId, email: "owner@osu.test", name: "Ama Owner" })
    .returning();
  const people = {
    owner: { orgId: world.a.orgId, userId: owner!.id, roleId: v7(), roleName: "owner" },
    cashier: { orgId: world.a.orgId, userId: owner!.id, roleId: v7(), roleName: "cashier" },
  };
  const authentication: ApiAuthentication = {
    resolvePrincipal: async (request) =>
      people[request.headers.get("x-member") as keyof typeof people] ?? null,
    hasPermission: async (principal, code) =>
      principal.roleName === "owner" || code === "product.read",
  };
  const call = (
    api: ReturnType<typeof createApi>,
    member: string,
    method: string,
    path: string,
    body?: unknown,
  ) =>
    api.fetch(
      new Request(`https://box.test${path}`, {
        method,
        headers: { "x-member": member, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  const box = createApi({ database: world.db, authentication, relayPublisher: publisher });
  const cloud = createApi({ database: world.db, authentication });

  const read = await call(box, "cashier", "GET", "/settings/online");
  expect(await read.json()).toEqual({
    box: true,
    onlineOrders: false,
    buffer: 0,
    publishedAt: null,
    error: null,
  });
  expect(
    (await call(box, "cashier", "PUT", "/settings/online", { onlineOrders: true })).status,
  ).toBe(403);
  // In the cloud there is no Publisher, so there is nothing to switch.
  expect((await (await call(cloud, "owner", "GET", "/settings/online")).json()).box).toBe(false);
  expect(
    (await call(cloud, "owner", "PUT", "/settings/online", { onlineOrders: true })).status,
  ).toBe(400);

  // What a previous publish recorded goes stale when the switch goes on: the next publish is a snapshot.
  await world.db.insert(schema.relayPublished).values({
    orgId: world.a.orgId,
    entity: "product",
    entityId: v7(),
    hash: "old",
  });
  const on = await call(box, "owner", "PUT", "/settings/online", { onlineOrders: true });
  expect(on.status).toBe(200);
  expect((await on.json()).onlineOrders).toBe(true);
  expect(woken).toEqual([world.a.orgId]);
  expect(
    await world.db
      .select({ hash: schema.relayPublished.hash })
      .from(schema.relayPublished)
      .where(eq(schema.relayPublished.orgId, world.a.orgId)),
  ).toEqual([{ hash: "" }]);

  // A catalogue write wakes it once it succeeds; a read or a refused write does not.
  expect(
    (await call(box, "owner", "PATCH", `/categories/${drinks}`, { name: "Soft drinks" })).status,
  ).toBe(200);
  expect((await call(box, "owner", "GET", "/categories")).status).toBe(200);
  expect((await call(box, "owner", "PATCH", `/categories/${drinks}`, { name: "" })).status).toBe(
    400,
  );
  expect(woken).toEqual([world.a.orgId, world.a.orgId]);
  // So does a new store and branch, and the branch's pickup, delivery and hours (Day 48).
  const store = await (await call(box, "owner", "POST", "/stores", { name: "Osu" })).json();
  const branch = await (
    await call(box, "owner", "POST", "/branches", { name: "Osu Main", storeId: store.id })
  ).json();
  const hours = { pickup: true, delivery: false, deliveryFee: 0, opens: "08:00", closes: "20:00" };
  const fulfilment = { ...hours, slotMinutes: 60, slotCapacity: 10, leadMinutes: 60 };
  expect(
    (await call(box, "owner", "PUT", `/branches/${branch.id}/fulfilment`, fulfilment)).status,
  ).toBe(200);
  expect(woken).toHaveLength(5);

  const [audit] = await world.db
    .select({ payload: schema.auditLog.payload })
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, world.a.orgId), eq(schema.auditLog.command, "settings.online")),
    );
  expect(audit?.payload).toMatchObject({ onlineOrders: true });

  // Day 49: the units kept back from the online store save on their own, audited, and wake the Publisher.
  const kept = await call(box, "owner", "PUT", "/settings/online", {
    onlineOrders: true,
    buffer: 3,
  });
  expect(await kept.json()).toMatchObject({ onlineOrders: true, buffer: 3 });
  const [row] = await world.db
    .select({ buffer: schema.org.onlineBuffer })
    .from(schema.org)
    .where(eq(schema.org.id, world.a.orgId));
  expect(row?.buffer).toBe(3000);
  expect(woken).toHaveLength(6);
  for (const buffer of [-1, 1.5, 10_001])
    expect(
      (await call(box, "owner", "PUT", "/settings/online", { onlineOrders: true, buffer })).status,
    ).toBe(400);
  const changes = await world.db
    .select({ payload: schema.auditLog.payload })
    .from(schema.auditLog)
    .where(
      and(eq(schema.auditLog.orgId, world.a.orgId), eq(schema.auditLog.command, "settings.online")),
    );
  expect(changes.at(-1)?.payload).toMatchObject({ onlineOrders: true, buffer: 3 });
});
