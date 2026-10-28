// An approval lapses with the earliest card or document: the owner is asked to renew 30 days before, and at expiry
// the case is expired and the owner emailed again. Payouts keep their subaccount meanwhile. The clock is faked.
import { afterEach, expect, test, vi } from "vite-plus/test";
import { v7 } from "uuid";
import { decideKyb } from "@shopper/core/kyb";
import { call, caseRow, context, db, kybEmails, queue, validCase, waitForStatus } from "./support";

const DAY = 86_400_000;
// Each check also moves the fake clock by the interval, so keep it small next to the days being tested.
const wait = { timeout: 15_000, interval: 50 };
afterEach(() => vi.useRealTimers());

/** Moves the fake clock, then lets real I/O (database, mail, Paystack) settle. */
async function advance(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let round = 0; round < 20; round++) {
    await queue.idle();
    await vi.advanceTimersByTimeAsync(0);
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test("an approval asks for renewal 30 days before the earliest expiry, then expires", async () => {
  const soon = new Date(Date.now() + 40 * DAY).toISOString().slice(0, 10);
  const body = await validCase();
  body.directors[0]!.cardExpiresOn = soon;
  expect((await call("/kyb", "PUT", body)).status).toBe(200);
  expect((await call("/kyb/submit", "POST")).status).toBe(202);
  await waitForStatus("in_review");
  expect((await caseRow())?.expiresOn).toBe(soon);

  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  await decideKyb(
    db,
    { orgId: context.orgId, appVersion: "test", queue },
    { version: (await caseRow())!.version, decision: "approved", reviewerId: v7() },
  );
  await vi.waitFor(async () => expect((await caseRow())?.subaccountCode).toBeTruthy(), wait);
  const renewals = () => kybEmails().filter((sent) => /renew/i.test(sent.subject));

  await advance(9 * DAY);
  expect(renewals()).toHaveLength(0);
  await advance(2 * DAY);
  await vi.waitFor(() => expect(renewals()).toHaveLength(1), wait);
  expect((await caseRow())?.status).toBe("approved");

  await advance(30 * DAY);
  await vi.waitFor(async () => expect((await caseRow())?.status).toBe("expired"), wait);
  await vi.waitFor(
    () => expect(kybEmails().some((sent) => /lapsed|expired/i.test(sent.subject))).toBe(true),
    wait,
  );
  expect((await caseRow())?.subaccountCode).toBeTruthy();
  expect(renewals()).toHaveLength(1);
});
