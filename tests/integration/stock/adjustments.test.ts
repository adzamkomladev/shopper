import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { auditLog, stockMovement } from "@shopper/db-pg";
import { goldenWorld } from "../../support/sales/golden/setup";
import { products } from "../../fixtures/sales/golden/references";
import { ids } from "../../fixtures/sales/golden";
import { databases } from "../../support/till/server";
import { get, portalMember, portalOwner, type Portal } from "../../support/api/portal";
import { addMovements } from "../../support/stock/seed";
import { send } from "../../support/stock/http";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let owner: Portal;
let clerk: string;
const rice = products.standard.id;

beforeAll(async () => {
  world = await goldenWorld();
  owner = await portalOwner(ids.org, ids.cashier);
  clerk = await portalMember(owner, "inventory");
  await addMovements([{ productId: rice, quantity: 10_000, at: "08:00" }]);
});
afterAll(async () => {
  await world?.local.close();
});

const adjustment = (
  cause: string,
  quantityThousandths: number,
  over: Record<string, unknown> = {},
) => ({
  id: v7(),
  branchId: ids.branch,
  cause,
  lines: [{ productId: rice, quantityThousandths }],
  ...over,
});
const post = (body: unknown, cookie = clerk) =>
  send(owner.api, cookie, "POST", "/stock/adjustments", body);
const onHand = async () =>
  (await get(owner.api, owner.cookie, `/stock/products/${rice}?branchId=${ids.branch}`)).body
    .onHandThousandths;
const movementOf = async (documentId: string) => {
  const [row] = await databases()
    .db.select()
    .from(stockMovement)
    .where(eq(stockMovement.documentId, documentId));
  return row!;
};

test("Wastage removes stock with its cause; found stock adds it", async () => {
  const damaged = adjustment("damaged", 2_000);
  const response = await post(damaged);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject({ id: damaged.id, kind: "adjustment", cause: "damaged" });
  expect(await movementOf(damaged.id)).toMatchObject({
    reason: "adjustment",
    quantityThousandths: -2_000,
  });
  expect(await onHand()).toBe(8_000);

  const found = adjustment("found", 1_000);
  expect((await post(found)).status).toBe(201);
  expect(await movementOf(found.id)).toMatchObject({ quantityThousandths: 1_000 });

  const other = adjustment("other", 500, { direction: "remove" });
  expect((await post(other)).status).toBe(201);
  expect(await movementOf(other.id)).toMatchObject({ quantityThousandths: -500 });
  expect(await onHand()).toBe(8_500);

  const [audit] = await databases()
    .db.select()
    .from(auditLog)
    .where(and(eq(auditLog.command, "stock.adjustment.record"), eq(auditLog.entityId, damaged.id)));
  expect(audit!.payload).toMatchObject({ cause: "damaged", id: damaged.id });
});

test("An adjustment's sign must match its cause", async () => {
  const bad = [
    adjustment("damaged", 1_000, { direction: "add" }),
    adjustment("found", 1_000, { direction: "remove" }),
    adjustment("other", 1_000),
    adjustment("other", 1_000, { direction: "sideways" }),
    adjustment("lost", 1_000),
    adjustment("damaged", 0),
    adjustment("damaged", -1_000),
  ];
  for (const body of bad) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
  const matching = adjustment("expired", 100, { direction: "remove" });
  expect((await post(matching)).status).toBe(201);
  expect(await onHand()).toBe(8_400);
});

test("A replay answers 200 without a second movement; other content under the same id is 409", async () => {
  const body = adjustment("theft", 400);
  expect((await post(body)).status).toBe(201);
  const again = await post(body);
  expect(again.status).toBe(200);
  expect(await onHand()).toBe(8_000);
  expect((await post({ ...body, cause: "damaged" })).status).toBe(409);
  expect((await post({ ...body, id: v7(), branchId: v7() })).status).toBe(400);
});

test("stock.write is data: inventory adjusts, the cashier and the accountant get 403", async () => {
  for (const role of ["cashier", "accountant"])
    expect(
      (await post(adjustment("damaged", 1_000), await portalMember(owner, role))).status,
      role,
    ).toBe(403);
  expect(
    (await owner.api.request("/stock/adjustments", { method: "POST", body: "{}" })).status,
  ).toBe(401);
});
