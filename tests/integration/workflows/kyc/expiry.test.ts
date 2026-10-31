// Time limits on a case: OTP 10 minutes, at most 3 sends, a 7-day decision window. The clock is faked, never slept.
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import {
  as,
  auth,
  caseRow,
  creditInReview,
  customerRow,
  openCredit,
  otpFor,
  signIn,
  smsCount,
  waitForRun,
  waitForStatus,
} from "../../../support/kyc/world";

const minute = 60_000;
const day = 24 * 60 * minute;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});
afterEach(() => vi.useRealTimers());
const admin = () => signIn(auth, "admin@example.com");

test("an OTP expires after 10 minutes: the case is expired and the code is refused with 409", async () => {
  const made = await openCredit();
  const code = await otpFor(made.phone);
  await vi.advanceTimersByTimeAsync(10 * minute + 1000);
  await waitForStatus(made.id, "expired");
  const late = await as("accountant").verify(made.id, code);
  expect(late.status).toBe(409);
  expect(await customerRow(made.customerId)).toMatchObject({ kycVerifiedAt: null, creditLimit: 0 });
  await waitForRun(made.id, "completed");
});

test("a code is still good just inside the 10 minutes", async () => {
  const made = await openCredit();
  const code = await otpFor(made.phone);
  await vi.advanceTimersByTimeAsync(9 * minute);
  const verified = await as("accountant").verify(made.id, code);
  expect(verified.status).toBe(200);
  expect(verified.body.status).toBe("id_needed");
});

test("a case sends at most 3 codes: the 4th resend is 409 and no 4th SMS goes out", async () => {
  const made = await openCredit();
  await otpFor(made.phone);
  for (const nth of [2, 3]) {
    expect((await as("accountant").resend(made.id)).status, `resend ${nth - 1}`).toBe(200);
    await otpFor(made.phone, nth);
  }
  const fourth = await as("accountant").resend(made.id);
  expect(fourth.status).toBe(409);
  expect(smsCount(made.phone)).toBe(3);
  expect((await caseRow(made.id)).otpSends).toBe(3);
  const newest = await otpFor(made.phone, 3);
  expect((await as("accountant").verify(made.id, newest)).status).toBe(200);
});

test("the decision window is 7 days: a decision on day 6 works", async () => {
  const made = await creditInReview();
  const due = (await caseRow(made.id)).decisionDueAt!;
  expect(Math.abs(due.getTime() - (Date.now() + 7 * day))).toBeLessThan(2 * minute);
  await vi.advanceTimersByTimeAsync(7 * day - 5 * minute);
  // A session lasts 12 hours: the reviewer signs in on the day they decide.
  const cookie = await admin();
  const approved = await as(cookie).decide(made.id, {
    approve: true,
    limit: 2_000_000,
    note: "On time",
  });
  expect(approved.status).toBe(200);
  expect((await customerRow(made.customerId)).creditLimit).toBe(2_000_000);
});

test("after 7 days the case is expired and a late decision gets 409", async () => {
  const made = await creditInReview();
  await vi.advanceTimersByTimeAsync(7 * day + 5 * minute);
  await waitForStatus(made.id, "expired");
  await waitForRun(made.id, "completed");
  const cookie = await admin();
  const late = await as(cookie).decide(made.id, {
    approve: true,
    limit: 2_000_000,
    note: "Too late",
  });
  expect(late.status).toBe(409);
  expect(await customerRow(made.customerId)).toMatchObject({ creditLimit: 0, kycVerifiedAt: null });
  expect((await caseRow(made.id)).status).toBe("expired");
});
