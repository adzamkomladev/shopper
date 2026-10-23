// The server side of drawer payments: POST /sync/accounts/payments {requestId, proof, payment:{v:1,
// type:"account.payment", payment:{...}}} answers {requestId, accepted:{id,...}} or {requestId, rejected:{code,message}}.
// It is idempotent by the payment id, needs sale.create on a live cashier session of this register, writes one
// `customer.payment` audit row, and keeps the till's shift id on the ledger entry with no foreign key (the Z arrives
// when the shift closes, long after the money was taken). Cash taken is never lost: a payment for a customer merged
// away lands on the winner, one for an archived customer still lowers their balance.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { sessionOf } from "../../../support/customers/credit";
import { entries } from "../../../support/customers/ledger";
import { addCustomer, folds } from "../../../support/customers/seed";
import { paymentAudit, paymentEvent, postPayment } from "../../../support/customers/payment";
import { uploader } from "../../../support/customers/till";
import { edit, postShift, shiftEvent } from "../../../support/sales/shifts";
import { memberWithPin } from "../../../support/sync/members";
import { ids } from "../../../support/till/sales";
import { databases } from "../../../support/till/server";
import { sql } from "drizzle-orm";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => world?.local.close());

const owed = (phone: string) => addCustomer({ phone });

test("a payment is applied once: a replay changes nothing, other content under its id is CONFLICT", async () => {
  const customerId = await owed("0271770001");
  const body = paymentEvent(await uploader(), v7(), { customerId, amount: 20_000 });
  const first = await postPayment(body);
  expect(first).toMatchObject({ status: 200, body: { accepted: { id: body.payment.payment.id } } });
  expect(await postPayment({ ...body, requestId: v7() })).toMatchObject({
    status: 200,
    body: { accepted: { id: body.payment.payment.id } },
  });
  expect(await entries(customerId)).toMatchObject([
    { kind: "payment", amount: -20_000, method: "cash" },
  ]);
  expect(await paymentAudit(customerId)).toHaveLength(1);

  const other = paymentEvent(await uploader(), v7(), {
    customerId,
    amount: 30_000,
    id: body.payment.payment.id,
  });
  expect((await postPayment(other)).body).toMatchObject({ rejected: { code: "CONFLICT" } });
  expect((await folds(customerId)).balance).toBe(-20_000);
});

test("a payment that cannot stand is rejected for good and writes nothing", async () => {
  const customerId = await owed("0271770002");
  const session = await uploader();
  const refused = async (body: unknown, code: string) => {
    expect((await postPayment(body)).body).toMatchObject({ rejected: { code } });
    expect(await entries(customerId)).toEqual([]);
  };
  await refused(paymentEvent(session, v7(), { customerId: v7() }), "NOT_FOUND");
  await refused(paymentEvent(session, v7(), { customerId, method: "momo" }), "INVALID_EVENT");
  await refused(paymentEvent(session, v7(), { customerId, amount: 0 }), "INVALID_EVENT");
  await refused(paymentEvent(session, v7(), { customerId, orgId: ids.otherOrg }), "SCOPE");
  const keeper = await sessionOf(await memberWithPin("Stock Keeper", "inventory", "4455"), "4455");
  await refused(paymentEvent(keeper, v7(), { customerId }), "PERMISSION_DENIED");
  await refused(
    { ...paymentEvent(session, v7(), { customerId }), proof: "wrong" },
    "INVALID_SESSION",
  );
  expect(await paymentAudit(customerId)).toEqual([]);
});

test("MoMo is recorded with its method and reference; the till's shift id is kept before the Z arrives", async () => {
  const customerId = await owed("0271770003");
  const session = await uploader();
  const unknown = v7();
  const momo = { customerId, method: "momo", reference: "MM-77", amount: 15_000 };
  expect((await postPayment(paymentEvent(session, unknown, momo))).body.accepted).toBeDefined();
  const [early] = await entries(customerId);
  expect(early).toMatchObject({ kind: "payment", method: "momo", amount: -15_000 });
  const { rows: before } = await databases().db.execute(
    sql`SELECT shift_id FROM credit_entry WHERE org_id = ${ids.org} AND customer_id = ${customerId}`,
  );
  expect(before[0]!.shift_id).toBe(unknown);
  expect((await paymentAudit(customerId))[0]!.payload).toMatchObject({
    method: "momo",
    reference: "MM-77",
    shiftId: unknown,
  });

  // The Z of a closed shift reaches the server; a payment into that shift is now linked to it.
  const closed = shiftEvent(world);
  expect((await postShift(closed, world.session.proof)).body.accepted).toBeDefined();
  const shiftId = closed.shift.report.shiftId;
  const later = paymentEvent(session, shiftId, { customerId, amount: 5_000 });
  expect((await postPayment(later)).body.accepted).toBeDefined();
  const { rows } = await databases().db.execute(
    sql`SELECT shift_id FROM credit_entry WHERE org_id = ${ids.org} AND id = ${later.payment.payment.id}`,
  );
  expect(rows[0]!.shift_id).toBe(shiftId);
});

test("a payment for a merged-away customer lands on the winner; an archived customer's is still accepted", async () => {
  const winner = await owed("0271770004");
  const loser = await owed("0271770005");
  const archived = await owed("0271770006");
  await databases().db.execute(sql`
    UPDATE customer SET merged_into_id = ${winner}, archived_at = now()
    WHERE org_id = ${ids.org} AND id = ${loser}`);
  await databases().db.execute(
    sql`UPDATE customer SET archived_at = now() WHERE org_id = ${ids.org} AND id = ${archived}`,
  );
  const session = await uploader();
  const toLoser = paymentEvent(session, v7(), { customerId: loser, amount: 7_000 });
  expect((await postPayment(toLoser)).body).toMatchObject({
    accepted: { id: toLoser.payment.payment.id, customerId: winner },
  });
  expect(await entries(loser)).toEqual([]);
  expect((await folds(winner)).balance).toBe(-7_000);
  const toArchived = paymentEvent(session, v7(), { customerId: archived, amount: 3_000 });
  expect((await postPayment(toArchived)).body.accepted).toBeDefined();
  expect((await folds(archived)).balance).toBe(-3_000);
});

test("a Z with account lines must still add up: cash payments belong in the expected cash", async () => {
  const good = shiftEvent(world);
  const withPayments = edit(good, (z) => {
    z.account = {
      sales: 0,
      payments: { cash: 30_000, momo: 0 },
      refunds: 0,
      points: 0,
      pointsValue: 0,
    };
  });
  // The lines claim 30 000 of cash payments the expected cash does not include.
  expect((await postShift(withPayments, world.session.proof)).body.rejected).toMatchObject({
    code: "SHIFT_MISMATCH",
  });
});
