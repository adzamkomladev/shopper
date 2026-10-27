// Production webhooks reach the API through the shared runtime: paying an invoice there must also wake its billing
// period's workflow, so dunning stops at the settled step instead of waiting out its deadlines.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { boxCache } from "@shopper/adapters-box";
import { serveRuntime } from "@shopper/api/runtime";
import { billingId } from "@shopper/core/billing";
import * as schema from "@shopper/db-pg";
import { money, toPesewas } from "@shopper/money";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ids } from "../../support/till/sales";
import { baseURL, secret } from "../../support/api/portal";
import { signWebhook } from "../../../tooling/paystack/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
}, 300_000);
afterAll(async () => world?.local.close());

test("an invoice paid through the runtime's webhook sends invoice.paid to its period's workflow", async () => {
  const periodStart = "2026-01-01";
  const id = v7();
  const amount = money(550 * 10_000);
  await world.db.insert(schema.invoice).values({
    id,
    orgId: ids.org,
    reference: id,
    periodStart,
    periodEnd: "2026-02-01",
    stores: 1,
    terminals: 1,
    amount,
  });
  const sent: [string, string][] = [];
  const cache = boxCache(":memory:");
  const paystackSecret = "sk_test_runtime_billing";
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      reference: id,
      status: "success",
      amount: toPesewas(amount),
      metadata: { invoiceId: id },
    },
  });
  try {
    const reply = await serveRuntime(
      new Request(`${baseURL}/webhooks/paystack`, {
        method: "POST",
        headers: { "x-paystack-signature": signWebhook(paystackSecret, body) },
        body,
      }),
      {
        database: world.db,
        cache: cache.cache,
        secret,
        baseURL,
        orgId: ids.org,
        paystackSecret,
        billing: {
          start: async () => {},
          send: async (instance, type) => void sent.push([instance, type]),
        },
      },
    );
    expect(reply.status).toBe(200);
  } finally {
    cache.close();
  }
  expect(sent).toEqual([[billingId(ids.org, periodStart), "invoice.paid"]]);
});
