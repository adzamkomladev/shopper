import { Hono, type Context } from "hono";
import * as v from "valibot";
import { findOrgBySlug } from "@shopper/core/orgs";
import { payoutSubaccount } from "@shopper/core/kyb";
import { momoOtp } from "@shopper/core/payments";
import {
  cancelOwnOrder,
  listPublishedReviews,
  listSlots,
  OrderError,
  orderById,
  placeOrder,
  readOrderView,
  reviewInstanceId,
  reviewTokenOpens,
  saveCheckoutUrl,
  startOrderPayment,
  submitReview,
} from "@shopper/core/orders";
import { quoteCart, storeBranch, StoreError } from "@shopper/core/storefront";
import { tokenOf } from "./session";
import type { ShopOptions } from "../../types";

/**
 * Guest checkout at one shop: what a branch offers and when, the cart priced as the till would, placing an unpaid
 * order that holds its stock, and the order read back with the key the browser kept. The code names the shop; a
 * signed-in shopper's session only links the order to their account.
 */
export function shopOrderRoutes(options: ShopOptions) {
  const app = new Hono();
  app.onError((error, c) => {
    if (error instanceof OrderError)
      return c.json(
        { error: error.message, code: error.code, products: error.products },
        error.status,
      );
    if (error instanceof StoreError) return c.json({ error: error.message }, error.status);
    if (v.isValiError(error)) return c.json({ error: "Check the details and try again" }, 400);
    throw error;
  });
  const shopOf = async (c: Context) => {
    const found = await findOrgBySlug(options.database, c.req.param("code") ?? "");
    if (!found || (options.orgId && found.id !== options.orgId.toLowerCase()))
      throw new StoreError("We could not find that shop");
    return found;
  };
  const body = (c: Context): Promise<Record<string, unknown>> => c.req.json().catch(() => ({}));
  /** The order for a shopper holding its checkout key, or a live review link to it (`r`); else not found. */
  const shopperOrder = async (orgId: string, id: string, proof: { key?: unknown; r?: unknown }) => {
    const order =
      typeof proof.key === "string" && proof.key
        ? await readOrderView(options.database, orgId, id, proof.key)
        : typeof proof.r === "string" &&
            (await reviewTokenOpens(options.linkSecret, proof.r, { orgId, orderId: id }))
          ? await orderById(options.database, orgId, id)
          : undefined;
    if (!order) throw new OrderError("not_found", "We could not find that order");
    return order;
  };

  app.get("/shop/:code/fulfilment", async (c) => {
    const found = await shopOf(c);
    const site = await storeBranch(options.database, found.id, c.req.query("branch"));
    return c.json({ branch: site, ...(await listSlots(options.database, found.id, site.id)) });
  });
  app.post("/shop/:code/cart", async (c) => {
    const found = await shopOf(c);
    return c.json(await quoteCart(options.database, found.id, await body(c), new Date()));
  });
  app.post("/shop/:code/orders", async (c) => {
    const found = await shopOf(c);
    if (!options.orderFlows || !options.stockHolds)
      return c.json({ error: "This shop is not taking online orders yet" }, 503);
    const input = await body(c);
    if (
      options.turnstile &&
      !(await options.turnstile(
        typeof input.turnstile === "string" ? input.turnstile : "",
        options.clientIP,
      ))
    )
      return c.json({ error: "Please confirm you are not a robot and try again" }, 403);
    const token = tokenOf(c);
    const session = token ? await options.access.session(token) : null;
    const flows = options.orderFlows;
    const order = await placeOrder(
      options.database,
      { orgId: found.id, appVersion: options.appVersion },
      input,
      {
        launch: (id, params) => flows.start(id, params),
        accountId: session?.orgId === found.id ? session.accountId : null,
      },
    );
    // After the commit: the hold rows exist, so the coordinator finds them when its alarm fires.
    await options.stockHolds.watch(found.id, order.branch.id, new Date(order.holdExpiresAt));
    return c.json(order, 201);
  });
  app.get("/shop/:code/orders/:id", async (c) => {
    const found = await shopOf(c);
    return c.json(
      await shopperOrder(found.id, c.req.param("id"), {
        key: c.req.query("t"),
        r: c.req.query("r"),
      }),
    );
  });
  // The shopper's own way out of an order they have not paid: their key proves it is theirs.
  app.post("/shop/:code/orders/:id/cancel", async (c) => {
    const found = await shopOf(c);
    const { key } = (await body(c)) as { key?: string };
    const id = c.req.param("id");
    if (!(await readOrderView(options.database, found.id, id, String(key ?? ""))))
      throw new OrderError("not_found", "We could not find that order");
    await cancelOwnOrder(options.database, { orgId: found.id, appVersion: options.appVersion }, id);
    return c.json(await readOrderView(options.database, found.id, id, String(key)));
  });
  // The shopper reviews an order they have received, with their key or the link texted to them; the review's workflow screens and publishes it.
  app.post("/shop/:code/orders/:id/review", async (c) => {
    const found = await shopOf(c);
    const input = await body(c);
    const id = c.req.param("id");
    await shopperOrder(found.id, id, input);
    await submitReview(
      options.database,
      { orgId: found.id, appVersion: options.appVersion },
      { id, rating: input.rating as number, comment: input.comment as string | undefined },
    );
    await options.orderReviews?.send(reviewInstanceId(id), "review_submitted", {});
    return c.json({ reviewed: true }, 201);
  });
  app.get("/shop/:code/reviews", async (c) => {
    const found = await shopOf(c);
    return c.json(await listPublishedReviews(options.database, found.id));
  });
  // The one-time code a mobile money network asked the payer for, with their key: it goes to the attempt's workflow.
  app.post("/shop/:code/orders/:id/pay/code", async (c) => {
    const found = await shopOf(c);
    const input = await body(c);
    const id = c.req.param("id");
    const order = await shopperOrder(found.id, id, { key: input.key });
    const otp = v.parse(momoOtp, { otp: input.otp }).otp;
    if (order.payment?.status !== "otp")
      return c.json({ error: "This payment is not waiting for a code" }, 409);
    await options.orderPayments?.send(order.payment.id, "payment", { type: "otp", otp });
    return c.json(order, 202);
  });
  app.post("/shop/:code/orders/:id/pay", async (c) => {
    const found = await shopOf(c);
    if (!options.orderPayments)
      return c.json({ error: "This shop is not taking payments yet" }, 503);
    const input = await body(c);
    const context = { orgId: found.id, appVersion: options.appVersion };
    const id = c.req.param("id");
    const payment = await startOrderPayment(options.database, context, id, input);
    if (payment.method === "card" && !payment.checkoutUrl) {
      if (!options.paystack)
        return c.json({ error: "Card payments are not set up for this shop" }, 503);
      const opened = await options.paystack
        .initialize({
          reference: payment.id,
          amount: payment.amount,
          email: payment.email ?? `${payment.phone}@pay.shopper.invalid`,
          metadata: { orderId: id },
          subaccount: await payoutSubaccount(options.database, found.id),
          callbackUrl: `${c.req.header("origin") ?? new URL(c.req.url).origin}/${c.req.param("code")}/orders/${id}?t=${input.key}`,
        })
        .catch(() => undefined);
      if (!opened) return c.json({ error: "We could not open the card page. Try again." }, 502);
      await saveCheckoutUrl(options.database, context, { id: payment.id, url: opened.url });
    }
    await options.orderPayments.start(payment.id, { orgId: found.id, id: payment.id });
    return c.json(await readOrderView(options.database, found.id, id, String(input.key)), 202);
  });
  return app;
}
