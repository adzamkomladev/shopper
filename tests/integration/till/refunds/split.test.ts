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

test("a refund of a sale whose customer was merged away credits the winner", async () => {
  const loser = await verifiedCustomer(portal, 2_000_000, { phone: "0271794103" });
  const winner = await verifiedCustomer(portal, 2_000_000, { phone: "0271794104" });
  counter = await startCounter();
  await counter.settle();
  const sold = await customerSale(counter, loser, {
    thousandths: 100_000,
    credit: 800_000,
    cash: 400_000,
  });
  await arrived(counter, sold.saleId);
  expect((await portal.merge(winner, loser)).status).toBe(200);
  const session = await uploader();
  const event = refundEvent(
    world,
    sold.sale as SaleSnapshot,
    [{ line: 0, before: 0, after: 50_000 }],
    {},
    { userId: principal.userId, sessionId: session.sessionId },
  );
  const gross = event.refund.totals.gross;
  const onAccount = {
    ...event,
    v: 2,
    refund: {
      ...event.refund,
      deviceTime: new Date().toISOString(),
      cashRounding: money(0),
      pointsReturned: 0,
      pointsValue: money(0),
      accountCredit: gross,
      total: money(0),
    },
  };
  expect((await postRefund(onAccount, session.proof)).body).toMatchObject({ accepted: {} });
  expect((await entries(winner)).map((e) => [e.kind, e.amount])).toEqual([
    ["transfer", 800_000],
    ["credit_note", -600_000],
  ]);
  expect((await entries(loser)).map((e) => e.kind)).toEqual(["charge", "transfer"]);
});

// v1 tills predate account and points splits, so a v1 refund of an on-account sale is rejected rather than filled:
// its till already paid the whole gross out, and crediting the account on top would pay the customer twice.
test("a refund that pays an on-account sale out in its tender is rejected, v1 included", async () => {
  const customerId = await verifiedCustomer(portal, 2_000_000, { phone: "0271794102" });
  counter = await startCounter();
  await counter.settle();
  const sold = await customerSale(counter, customerId, {
    thousandths: 100_000,
    credit: 800_000,
    cash: 400_000,
  });
  await arrived(counter, sold.saleId);
  const session = await uploader();
  const stated = (patch: { accountCredit: number; pointsValue: number; total: number }, v = 2) => {
    const event = refundEvent(
      world,
      sold.sale as SaleSnapshot,
      [{ line: 0, before: 0, after: 50_000 }],
      {},
      { userId: principal.userId, sessionId: session.sessionId },
    );
    const { refund } = event;
    return {
      ...event,
      v,
      refund: {
        ...refund,
        deviceTime: new Date().toISOString(),
        cashRounding: money(0),
        pointsReturned: 0,
        ...patch,
      },
    };
  };
  const gross = stated({ accountCredit: 0, pointsValue: 0, total: 0 }).refund.totals.gross;
  const cashOut = { accountCredit: 0, pointsValue: 0, total: gross };
  const v1 = stated(cashOut, 1);
  const { accountCredit: _a, pointsReturned: _p, pointsValue: _v, ...legacy } = v1.refund;
  for (const event of [stated(cashOut), { ...v1, refund: legacy }])
    expect((await postRefund(event, session.proof)).body.rejected).toMatchObject({
      code: "INVALID_TOTALS",
    });
  const forged = stated({ accountCredit: gross - 1, pointsValue: 1, total: 0 });
  expect((await postRefund(forged, session.proof)).body.rejected).toMatchObject({
    code: "INVALID_TOTALS",
  });
});
