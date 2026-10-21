import { afterAll, afterEach, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { category, product } from "@shopper/db-pg";
import { ids } from "../../fixtures/sales/golden";
import { goldenWorld } from "../../support/sales/golden/setup";
import { databases } from "../../support/till/server";
import { api } from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";
import { inventorySession, stockProduct } from "../../support/till/stock";
import { addDocument, addSupplier } from "../../support/stock/seed";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { send } from "../../support/stock/http";

// Till-window times: the till session in these helpers is valid on 31 Dec 2025 only.
const t = (time: string) => new Date(`2025-12-31T${time}:00.000Z`);
let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let clerk: string;
let cashier: string;
let milk: string;
let beans: string;
let soap: string;
let aisle: string;
const url = (path = "") => `/stock/takes${path}`;
const start = (body: Record<string, unknown> = {}, cookie = clerk) =>
  send(owner.api, cookie, "POST", url(), {
    id: v7(),
    branchId: ids.branch,
    scope: "full",
    ...body,
  });
const count = (id: string, lines: unknown[], cookie = clerk) =>
  send(owner.api, cookie, "PUT", url(`/${id}/counts`), { lines });
const post = (id: string, cookie = clerk) => send(owner.api, cookie, "POST", url(`/${id}/post`));
const cancel = (id: string) => send(owner.api, clerk, "POST", url(`/${id}/cancel`));
const read = (id: string) => get(owner.api, clerk, url(`/${id}`));

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  clerk = await portalMember(owner, "inventory");
  cashier = await portalMember(owner, "cashier");
  milk = await stockProduct(4_000, t("20:00"));
  beans = await stockProduct(1_000, t("20:00"));
  soap = await stockProduct(500, t("20:00"));
  aisle = v7();
  const { db } = databases();
  await db.insert(category).values({ id: aisle, orgId: ids.org, name: "Take aisle" });
  await db.update(product).set({ categoryId: aisle }).where(eq(product.id, beans));
  await db.update(product).set({ categoryId: aisle }).where(eq(product.id, soap));
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(t("20:30"));
});
afterEach(() => vi.setSystemTime(t("20:30")));
afterAll(async () => {
  vi.useRealTimers();
  await world?.local.close();
});

test("A full take lists every active product and refuses to post until all are counted", async () => {
  const started = await start();
  expect(started.status).toBe(201);
  const id = started.body.id;
  const active = await get(owner.api, clerk, `/stock?branchId=${ids.branch}&limit=200`);
  expect(started.body.lines.map((line: any) => line.productId).sort()).toEqual(
    active.body.items.map((item: any) => item.productId).sort(),
  );
  expect(started.body).toMatchObject({
    status: "open",
    scope: "full",
    uncounted: started.body.lines.length,
  });
  expect((await start()).status).toBe(409);
  const refused = await post(id);
  expect(refused.status).toBe(409);
  expect(refused.body.error).toMatch(/^\d+ products? not counted yet$/);
  await count(id, [{ productId: milk, countedThousandths: 4_000 }]);
  expect((await post(id)).status).toBe(409);
  expect((await cancel(id)).body.status).toBe("cancelled");
});

test("A category take lists only that category's products", async () => {
  const started = await start({ scope: "category", categoryId: aisle });
  expect(started.status).toBe(201);
  expect(started.body.lines.map((line: any) => line.productId).sort()).toEqual(
    [beans, soap].sort(),
  );
  expect((await start({ scope: "category", categoryId: v7() })).status).toBe(400);
  expect((await start({ scope: "category" })).status).toBe(400);
  expect((await start({ scope: "full", categoryId: aisle })).status).toBe(400);
  await cancel(started.body.id);
});

test("Counting needs a product on the sheet and an open take", async () => {
  const started = await start({ scope: "category", categoryId: aisle });
  const id = started.body.id;
  expect((await count(id, [{ productId: milk, countedThousandths: 1 }])).status).toBe(400);
  expect((await count(id, [])).status).toBe(400);
  expect((await count(id, [{ productId: beans, countedThousandths: -1 }])).status).toBe(400);
  expect(
    (
      await count(id, [
        { productId: beans, countedThousandths: 1 },
        { productId: beans, countedThousandths: 2 },
      ])
    ).status,
  ).toBe(400);
  await cancel(id);
  expect((await count(id, [{ productId: beans, countedThousandths: 1 }])).status).toBe(409);
  expect((await post(id)).status).toBe(409);
  expect((await cancel(id)).status).toBe(409);
  expect((await read(v7())).status).toBe(404);
});

test("A recount replaces the count, its time and its counter", async () => {
  const id = (await start({ scope: "category", categoryId: aisle })).body.id;
  vi.setSystemTime(t("20:40"));
  await count(
    id,
    [{ productId: beans, countedThousandths: 900 }],
    await portalMember(owner, "inventory"),
  );
  const first = (await read(id)).body.lines.find((line: any) => line.productId === beans);
  expect(first).toMatchObject({ countedThousandths: 900, countedAt: t("20:40").toISOString() });
  vi.setSystemTime(t("20:50"));
  await count(id, [{ productId: beans, countedThousandths: 950 }], owner.cookie);
  const second = (await read(id)).body.lines.find((line: any) => line.productId === beans);
  expect(second).toMatchObject({
    countedThousandths: 950,
    countedAt: t("20:50").toISOString(),
    countedBy: owner.principal.userId,
  });
  expect(second.countedBy).not.toBe(first.countedBy);
  await cancel(id);
});

test("A newer till count supersedes a take line until it is recounted", async () => {
  const id = (await start({ scope: "category", categoryId: aisle })).body.id;
  vi.setSystemTime(t("20:45"));
  await count(id, [
    { productId: beans, countedThousandths: 800 },
    { productId: soap, countedThousandths: 500 },
  ]);
  vi.setSystemTime(t("23:00")); // the server dates a till count at the earlier of now and its countedAt
  const session = await inventorySession();
  const till = await api.request("/sync/stock", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({
      requestId: v7(),
      proof: session.proof,
      document: {
        v: 1,
        kind: "count",
        id: v7(),
        actorId: session.userId,
        sessionId: session.sessionId,
        lines: [{ productId: beans, countedThousandths: 700 }],
        countedAt: t("21:00").toISOString(),
      },
    }),
  });
  expect((await till.json()).accepted).toBeDefined();
  const superseded = await post(id);
  expect(superseded.status).toBe(409);
  expect(superseded.body.error).toMatch(/newer count/);
  vi.setSystemTime(t("21:10"));
  await count(id, [{ productId: beans, countedThousandths: 650 }]);
  const posted = await post(id);
  expect(posted.status).toBe(200);
  expect(posted.body.lines.find((line: any) => line.productId === beans)).toMatchObject({
    expectedThousandths: 700,
    varianceThousandths: -50,
  });
});

test("Reads need stock.read and writes stock.write", async () => {
  const id = (await start({ scope: "category", categoryId: aisle })).body.id;
  expect((await get(owner.api, cashier, url())).status).toBe(403);
  expect((await get(owner.api, null, url())).status).toBe(401);
  expect((await start({}, cashier)).status).toBe(403);
  expect((await count(id, [{ productId: beans, countedThousandths: 1 }], cashier)).status).toBe(
    403,
  );
  const list = await get(owner.api, clerk, url("?status=open"));
  expect(list.body.items.map((take: any) => take.id)).toContain(id);
  await cancel(id);
  const foreign = await portalOwner(ids.otherOrg);
  expect((await get(foreign.api, foreign.cookie, url(`/${id}`))).status).toBe(404);
});

test("A product whose last receipt cost nothing is valued at 0, not left unvalued", async () => {
  const free = await stockProduct(1_000, t("20:00"));
  const zero = v7();
  const { db } = databases();
  await db.insert(category).values({ id: zero, orgId: ids.org, name: "Free aisle" });
  await db.update(product).set({ categoryId: zero }).where(eq(product.id, free));
  await addDocument({
    kind: "receipt",
    supplierId: await addSupplier("Free Samples"),
    at: "08:00",
    lines: [{ productId: free, quantity: 1_000, unitCost: 0 }],
  });
  const id = (await start({ scope: "category", categoryId: zero })).body.id;
  vi.setSystemTime(t("20:45"));
  await count(id, [{ productId: free, countedThousandths: 900 }]);
  const line = (await read(id)).body.lines[0];
  expect(line).toMatchObject({ varianceThousandths: -100, unitCost: 0 });
  expect(line.varianceValue).toBe(0);
  await cancel(id);
});
