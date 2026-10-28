// A shop whose business verification was approved is paid out through its own Paystack subaccount: every till MoMo
// charge names it. A shop without one charges as before, to Shopper's main account.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { momoFixture } from "../../support/payments/momo";

let f: Awaited<ReturnType<typeof momoFixture>>;
beforeAll(async () => {
  f = await momoFixture();
});
afterAll(async () => f?.close());

async function chargeBody() {
  const reply = await f.call("/payments/momo", "POST", {
    amount: 10_000,
    phone: "0551234987",
    network: "mtn",
  });
  expect(reply.status).toBe(201);
  const { reference } = (await reply.json()) as { reference: string };
  return vi.waitFor(
    () => {
      const sent = f.fake.requests.find(
        (entry) =>
          entry.path === "/charge" && (entry.body as { reference: string }).reference === reference,
      );
      expect(sent).toBeDefined();
      return sent!.body as Record<string, unknown>;
    },
    { timeout: 5000, interval: 20 },
  );
}

test("without an approved verification a charge names no subaccount", async () => {
  expect(await chargeBody()).not.toHaveProperty("subaccount");
});

test("after approval every charge names the shop's subaccount, and still does once it lapses", async () => {
  await f.db.insert(schema.kybCase).values({
    orgId: f.orgId,
    status: "approved",
    version: 1,
    decidedAt: new Date(),
    subaccountCode: "ACCT_shop1",
  });
  expect(await chargeBody()).toMatchObject({ subaccount: "ACCT_shop1" });
  await f.db
    .update(schema.kybCase)
    .set({ status: "expired" })
    .where(eq(schema.kybCase.orgId, f.orgId));
  expect(await chargeBody()).toMatchObject({ subaccount: "ACCT_shop1" });
});
