// Two registers refund halves of one on-account sale while offline: each sees nothing credited yet, so each credits
// its whole GH₵60 to the account. GH₵120 was paid GH₵80 on account + GH₵40 cash. Both uploads are accepted; the
// first credits GH₵60, the second is clamped to the GH₵20 left and its GH₵40 excess is recorded for review.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { sql } from "drizzle-orm";
import type { SaleSnapshot } from "@shopper/core/schemas";
import { money, sub } from "@shopper/money";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { postRefund, refundEvent } from "../../../support/sales/refunds";
import { portalOwner } from "../../../support/api/portal";
import { customerApi } from "../../../support/customers/http";
import { startCounter, uploader } from "../../../support/customers/till";
import { arrived } from "../../../support/customers/account";
import { verifiedCustomer } from "../../../support/customers/credit";
import { entries } from "../../../support/customers/ledger";
import { customerSale } from "../../../support/customers/loyalty";
import { ids } from "../../../support/till/sales";
import { databases, principal } from "../../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
let portal: ReturnType<typeof customerApi>;
let counter: Awaited<ReturnType<typeof startCounter>> | undefined;
beforeAll(async () => {
  world = await goldenWorld();
  const owner = await portalOwner(ids.org, ids.cashier);
  portal = customerApi(owner, owner.cookie);
});
afterAll(async () => world?.local.close());
afterEach(async () => {
  await counter?.close();
  counter = undefined;
});

test("two registers refunding one account sale offline are both accepted and never over-credit", async () => {
  const customerId = await verifiedCustomer(portal, 2_000_000, { phone: "0271794101" });
  counter = await startCounter();
  await counter.settle();
  const sold = await customerSale(counter, customerId, {
    thousandths: 100_000,
    credit: 800_000,
    cash: 400_000,
  });
  await arrived(counter, sold.saleId);
  const session = await uploader();
  const offline = (before: number) => {
    const event = refundEvent(
      world,
      sold.sale as SaleSnapshot,
      [{ line: 0, before, after: before + 50_000 }],
      {},
      { userId: principal.userId, sessionId: session.sessionId },
    );
    const gross = event.refund.totals.gross;
    return {
      ...event,
      v: 2,
      refund: {
        ...event.refund,
        pointsReturned: 0,
        pointsValue: money(0),
        deviceTime: new Date().toISOString(),
        accountCredit: gross,
        total: sub(gross, gross),
        cashRounding: money(0),
      },
    };
  };
  const first = offline(0);
  const second = offline(50_000);
  expect((await postRefund(first, session.proof)).body).toMatchObject({ accepted: {} });
  expect((await postRefund(second, session.proof)).body).toMatchObject({ accepted: {} });

  const { rows } = await databases().db.execute<Record<string, any>>(sql`
    SELECT id, account_credit::int AS account_credit, total::int AS total FROM refund
    WHERE org_id = ${ids.org} AND original_sale_id = ${sold.saleId} ORDER BY occurred_at, id`);
  expect(rows).toEqual([
    { id: first.refund.id, account_credit: 600_000, total: 0 },
    { id: second.refund.id, account_credit: 200_000, total: 0 },
  ]);
  expect((await entries(customerId)).map((e) => [e.kind, e.amount])).toEqual([
    ["charge", 800_000],
    ["credit_note", -600_000],
    ["credit_note", -200_000],
  ]);
  const { rows: audits } = await databases().db.execute<{ excess: unknown }>(sql`
    SELECT payload->'excess' AS excess FROM audit_log
    WHERE org_id = ${ids.org} AND command = 'refund.accept' AND entity_id = ${second.refund.id}`);
  expect(audits).toEqual([{ excess: { account: 400_000, points: 0 } }]);
});
