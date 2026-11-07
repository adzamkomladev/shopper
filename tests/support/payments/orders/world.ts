// Online order payments end to end on the box's engines: a shop with a stocked branch, Paystack and Hubtel fakes,
// the real order and payment workflows, and the shop API a browser calls.
//   const w = await orderPayWorld({ acceptWithinMs?, paymentTimeoutMs? })
//   w.place(over?)                 -> the placed order { id, key, body }
//   w.placeLapsing(ms)             -> an order whose hold runs out in `ms` (placed in the past, workflow started)
//   w.pay(order, over?)            -> the pay route's { status, body }; defaults to card
//   w.paystackEvent(reference, pesewas, event?) -> POSTs a signed Paystack webhook to the shop runtime
//   w.hubtelCallback(reference, success) -> POSTs Hubtel's callback; its status API decides
//   w.row(order)                   -> the order row now;  w.count(table, where) -> rows
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxOnlineOrders, boxOrderPayments, boxOrderReviews } from "@shopper/adapters-box";
import { placeOrder } from "@shopper/core/orders";
import { createHubtel } from "@shopper/core/payments/hubtel";
import { createPaystack } from "@shopper/core/payments/paystack";
import { money, toPesewas } from "@shopper/money";
import { signWebhook, startPaystackFake } from "../../../../tooling/paystack/server";
import { startHubtelFake } from "../../../../tooling/hubtel/server";
import { shopHttp } from "../../shop/http";
import { stockShop } from "../../shop/store";
import { shopWorld } from "../../shop/world";
import { orderReads } from "./reads";

type Options = {
  acceptWithinMs?: number;
  paymentTimeoutMs?: number;
  pickLeadMs?: number;
  collectWithinMs?: number;
  /** The review workflow's timers, in ms: ask after, wait for a review, wait for a moderator. */
  review?: { askAfterMs: number; waitMs: number; moderateWithinMs: number };
};

export async function orderPayWorld(options: Options = {}) {
  const world = await shopWorld();
  const shop = await stockShop(world.db, world.a);
  const oil = await shop.product("Frytol oil 1L", { price: 300_000, stock: [100_000, 100_000] });
  const rice = await shop.product("Loose rice", {
    price: 185_000,
    baseUnit: "kg",
    stock: [100_000, 100_000],
  });
  await world.db.insert(schema.branchFulfilment).values({
    orgId: world.a.orgId,
    branchId: shop.branches[0],
    pickup: true,
    delivery: false,
    opens: "00:00",
    closes: "23:00",
    slotMinutes: 60,
    slotCapacity: 50,
    leadMinutes: 0,
  });
  // A VAT-registered shop: its online orders are VAT invoices, so each one gets a fiscal document.
  await world.db
    .update(schema.org)
    .set({ tin: "C0012345678", vatRegisteredFrom: "2020-01-01" })
    .where(eq(schema.org.id, world.a.orgId));
  const fake = await startPaystackFake();
  const hubtelFake = await startHubtelFake();
  const paystack = createPaystack({ secretKey: fake.secretKey, baseUrl: fake.baseUrl });
  const hubtel = createHubtel({
    clientId: hubtelFake.clientId,
    clientSecret: hubtelFake.clientSecret,
    merchantAccount: hubtelFake.merchantAccount,
    callbackUrl: "https://shopper.test/webhooks/hubtel",
    baseUrl: hubtelFake.baseUrl,
    statusUrl: hubtelFake.baseUrl,
  });
  const deps = {
    withDatabase: <T>(run: (db: schema.ShopperDatabase) => Promise<T>) => run(world.db),
    appVersion: "test",
  };
  const orderFlows = boxOnlineOrders({
    ...deps,
    paystack,
    notifications: () => world.queue,
    acceptWithinMs: options.acceptWithinMs,
    pickLeadMs: options.pickLeadMs,
    collectWithinMs: options.collectWithinMs,
  });
  const orderPayments = boxOrderPayments({
    ...deps,
    paystack,
    hubtel,
    orders: orderFlows,
    timeoutMs: options.paymentTimeoutMs,
    notifications: () => world.queue,
  });
  const orderReviews = boxOrderReviews({
    ...deps,
    notifications: () => world.queue,
    ...options.review,
  });
  const http = shopHttp(world, {
    orderFlows,
    orderReviews,
    orderPayments,
    paystack,
    paystackSecret: fake.secretKey,
    hubtel,
    stockHolds: { watch: async () => undefined },
  });

  const slot = async () => {
    const reply = await http.request(`/shop/${world.a.slug}/fulfilment?branch=${shop.branches[0]}`);
    return ((await reply.json()) as { slots: { start: string }[] }).slots.at(-1)!.start;
  };
  const lines = [
    { productId: oil, quantityThousandths: 2_000 },
    { productId: rice, quantityThousandths: 1_500 },
  ];
  const checkout = async (over: Record<string, unknown> = {}) => ({
    key: crypto.randomUUID(),
    branch: shop.branches[0],
    lines,
    fulfilment: "pickup",
    slot: await slot(),
    name: "Ama Mensah",
    phone: "0241234567",
    ...over,
  });
  const place = async (over: Record<string, unknown> = {}) => {
    const body = await checkout(over);
    const reply = await http.request(`/shop/${world.a.slug}/orders`, { body });
    if (reply.status !== 201) throw new Error(`place ${reply.status}`);
    const order = (await reply.json()) as { id: string; totals: { gross: number } };
    return { id: order.id, key: body.key as string, gross: money(order.totals.gross), body };
  };
  /** Placed 30 minutes ago less `ms`, so the order's hold (and its workflow's wait) ends in `ms`. */
  const placeLapsing = async (ms: number, over: Record<string, unknown> = {}) => {
    const body = await checkout(over);
    const placed = await placeOrder(world.db, { orgId: world.a.orgId, appVersion: "test" }, body, {
      launch: (id, params) => orderFlows.start(id, params),
      now: new Date(Date.now() - 30 * 60_000 + ms),
    });
    return { id: placed.id, key: body.key as string, gross: money(placed.totals.gross), body };
  };
  const pay = async (
    order: { id: string; key: string },
    over: Record<string, unknown> = { method: "card" },
  ) => {
    const reply = await http.request(`/shop/${world.a.slug}/orders/${order.id}/pay`, {
      body: { key: order.key, ...over },
    });
    return { status: reply.status, body: (await reply.json()) as Record<string, any> };
  };
  const view = async (order: { id: string; key: string }) =>
    (await (
      await http.request(`/shop/${world.a.slug}/orders/${order.id}?t=${order.key}`)
    ).json()) as Record<string, any>;
  const paystackEvent = (
    reference: string,
    pesewas: number,
    event: "charge.success" | "charge.failed" = "charge.success",
    signed = fake.secretKey,
  ) => {
    const raw = JSON.stringify({
      event,
      data: {
        reference,
        status: event === "charge.success" ? "success" : "failed",
        amount: pesewas,
        gateway_response: event === "charge.success" ? "Approved" : "Declined",
      },
    });
    return http.request("/webhooks/paystack", {
      raw,
      origin: null,
      headers: { "x-paystack-signature": signWebhook(signed, raw) },
    });
  };
  const hubtelCallback = (reference: string, success: boolean) =>
    http.request("/webhooks/hubtel", {
      body: hubtelFake.callback(reference, success),
      origin: null,
    });
  const reads = orderReads(world.db);
  return {
    world,
    shop,
    http,
    fake,
    hubtelFake,
    paystack,
    hubtel,
    deps,
    orderFlows,
    orderReviews,
    orderPayments,
    products: { oil, rice },
    place,
    placeLapsing,
    pay,
    view,
    paystackEvent,
    hubtelCallback,
    ...reads,
    pesewas: (gross: number) => toPesewas(money(gross)),
    async close() {
      http.close();
      await fake.stop();
      await hubtelFake.stop();
      await world.close();
    },
  };
}
