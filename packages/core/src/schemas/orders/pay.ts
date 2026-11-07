import * as v from "valibot";
import { paymentNetworks } from "@shopper/db-pg";
import { shopPhone } from "../../shop/schemas/signin";

/**
 * How a shopper pays for an order they placed. `key` is the checkout key that reads the order back. A card opens
 * Paystack's page; mobile money names the wallet to prompt, and the amount always comes from the order.
 */
export const payOrderInput = v.pipe(
  v.object({
    key: v.pipe(v.string(), v.uuid(), v.toLowerCase()),
    method: v.picklist(["card", "momo"]),
    network: v.optional(v.picklist(paymentNetworks)),
    phone: v.optional(shopPhone),
  }),
  v.forward(
    v.check(
      (input) =>
        input.method === "card" || (input.network !== undefined && input.phone !== undefined),
      "Choose your network and enter the mobile money number",
    ),
    ["phone"],
  ),
);
export type PayOrderInput = v.InferOutput<typeof payOrderInput>;

/** What starts an order payment's workflow; its instance id is the payment id. */
export const orderPaymentParams = v.object({
  orgId: v.pipe(v.string(), v.uuid(), v.toLowerCase()),
  id: v.pipe(v.string(), v.uuid(), v.toLowerCase()),
});
