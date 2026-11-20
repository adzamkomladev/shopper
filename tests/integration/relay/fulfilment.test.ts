// v1.5 Day 51: a relayed order on the box. It joins the in-store customer with its phone (a new one is made from the
// order when the shop has never seen the phone), and the box, not the relay, fiscalises it when it is handed over.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import {
  finishStoreOrder,
  handOverStoreOrder,
  recordPick,
  startPicking,
} from "@shopper/core/orders";
import { inboxWorld } from "../../support/relay/inbox";

let w: Awaited<ReturnType<typeof inboxWorld>>;
const quiet = { send: async () => {} };
beforeAll(async () => {
  w = await inboxWorld();
  await w.stock(w.f.products.oil, 50);
  await w.stock(w.f.products.rice, 50);
}, 180_000);
afterAll(async () => w?.close());

const oil = () => ({ lines: [{ productId: w.f.products.oil, quantityThousandths: 1_000 }] });
const customersWith = (phone: string) =>
  w.box
    .select()
    .from(schema.customer)
    .where(and(eq(schema.customer.orgId, w.orgId), eq(schema.customer.phone, phone)));
const fiscalOf = (db: schema.ShopperDatabase, orderId: string) =>
  db.select().from(schema.fiscalDoc).where(eq(schema.fiscalDoc.orderId, orderId));

test("a relayed order joins the in-store customer with its phone", async () => {
  const [known] = await w.box
    .insert(schema.customer)
    .values({ orgId: w.orgId, name: "Esi Known", phone: "0241112233" })
    .returning();
  const order = await w.f.paid({ ...oil(), phone: "0241112233", name: "Esi Online" });
  await w.run();
  expect((await w.boxOrder(order.id))?.customerId).toBe(known!.id);
  // The shop's record keeps its own name.
  expect((await customersWith("0241112233")).map((row) => row.name)).toEqual(["Esi Known"]);
});

test("an unknown phone becomes one customer, however often its orders arrive", async () => {
  const first = await w.f.paid({ ...oil(), phone: "0247778899", name: "Yaw New" });
  // Its answer is lost: the relay offers the order again on the next run.
  await w
    .run((path) =>
      path === "/relay/orders/events" ? new Response("", { status: 503 }) : undefined,
    )
    .catch(() => undefined);
  await w.run();
  const second = await w.f.paid({ ...oil(), phone: "0247778899", name: "Yaw New" });
  await w.run();
  const made = await customersWith("0247778899");
  expect(made).toHaveLength(1);
  expect(made[0]!.name).toBe("Yaw New");
  expect((await w.boxOrder(first.id))?.customerId).toBe(made[0]!.id);
  expect((await w.boxOrder(second.id))?.customerId).toBe(made[0]!.id);
});

test("the box fiscalises a relayed order when it is handed over; the relay never does", async () => {
  const order = await w.f.paid(oil());
  expect(await fiscalOf(w.f.world.db, order.id)).toEqual([]);
  await w.run();
  await startPicking(w.box, w.ctx, { id: order.id });
  for (const line of (await w.f.lines(order)).filter((row) => row.productId))
    await recordPick(w.box, w.ctx, {
      id: order.id,
      lineId: line.id,
      pickedThousandths: line.quantityThousandths,
    });
  await finishStoreOrder(w.box, w.ctx, quiet, order.id);
  expect(await fiscalOf(w.box, order.id)).toEqual([]);
  await handOverStoreOrder(w.box, w.ctx, quiet, order.id);
  const boxOrder = await w.boxOrder(order.id);
  expect(await fiscalOf(w.box, order.id)).toEqual([
    expect.objectContaining({ invoiceNumber: boxOrder!.receiptNumber, status: "pending" }),
  ]);
  expect(await fiscalOf(w.f.world.db, order.id)).toEqual([]);
});
