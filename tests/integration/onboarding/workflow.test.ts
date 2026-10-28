// A cloud shop's onboarding: reminders while the email is unverified, then nudges toward the first sale, which ends
// it as trading. The clock is faked, never slept; emails are the captured Maileroo's.
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { and, eq, like } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import * as schema from "@shopper/db-pg";
import { markOnboarding } from "@shopper/core/onboarding";
import {
  DAY,
  HOUR,
  db,
  delivered,
  nudgeEmails,
  onboardingRow,
  queue,
  settle,
  signup,
  verificationEmails,
  waitForRun,
} from "../../support/onboarding/world";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
});
afterEach(() => vi.useRealTimers());

const context = (orgId: string) => ({ orgId, appVersion: "test", queue });
// Stands in for the sale accept: any command that marks the first sale, failing after it when asked to.
const sale = defineCommand({
  name: "test.sale",
  async run(tx, ctx, input: { fail?: boolean }) {
    const first = await markOnboarding(tx, ctx.orgId, "first_sale");
    if (input.fail) throw new Error("the sale failed");
    return { first };
  },
  audit: (_input, output) => output,
});
const sell = async (orgId: string) => (await sale(db, context(orgId), {})).first;

test("an unverified owner is reminded at 2 h and 12 h, and the onboarding ends when the link expires", async () => {
  const shop = await signup();
  await settle();
  expect(verificationEmails(shop.email)).toHaveLength(1);
  await settle(2 * HOUR - 60_000);
  expect(verificationEmails(shop.email)).toHaveLength(1);
  await settle(2 * 60_000);
  expect(verificationEmails(shop.email)).toHaveLength(2);
  await settle(10 * HOUR);
  expect(verificationEmails(shop.email)).toHaveLength(3);
  await settle(12 * HOUR + 60_000);
  await waitForRun(shop.id, "completed", "registration");
  expect(verificationEmails(shop.email)).toHaveLength(3);
  const audit = await db
    .select({ command: schema.registrationAuditLog.command })
    .from(schema.registrationAuditLog)
    .where(
      and(
        eq(schema.registrationAuditLog.orgId, shop.id),
        like(schema.registrationAuditLog.command, "onboarding.%"),
      ),
    );
  expect(audit.map((row) => row.command).sort()).toEqual([
    "onboarding.registration.abandon",
    "onboarding.registration.remind",
    "onboarding.registration.remind",
  ]);
});

test("a verified owner gets no reminder, and completion starts the shop in setup", async () => {
  const shop = await signup();
  await settle(HOUR);
  await shop.verify();
  await settle(13 * HOUR);
  expect(verificationEmails(shop.email)).toHaveLength(1);
  expect(await onboardingRow(shop.id)).toBeUndefined();
  await shop.complete();
  await settle();
  expect(await onboardingRow(shop.id)).toMatchObject({
    status: "setup",
    nudges: 0,
    firstSaleAt: null,
  });
  await waitForRun(shop.id, "completed", "registration");
  await waitForRun(shop.id, "waiting", "tenant");
});

test("a shop with no sale is nudged at +1, +3 and +7 days, never a fourth time", async () => {
  const shop = await signup();
  await shop.verify();
  await shop.complete();
  await settle(DAY - 60_000);
  expect(nudgeEmails(shop.email)).toHaveLength(0);
  await settle(2 * 60_000);
  expect(nudgeEmails(shop.email)).toHaveLength(1);
  // The nudge names what is left: a fresh shop has no store yet, and links back to the wizard.
  expect(nudgeEmails(shop.email)[0]!.plain).toMatch(/store/i);
  expect(nudgeEmails(shop.email)[0]!.plain).toContain("http://shopper.test/setup");
  await settle(2 * DAY);
  expect(nudgeEmails(shop.email)).toHaveLength(2);
  await settle(4 * DAY);
  expect(nudgeEmails(shop.email)).toHaveLength(3);
  await settle(30 * DAY);
  expect(nudgeEmails(shop.email)).toHaveLength(3);
  expect(await onboardingRow(shop.id)).toMatchObject({ status: "setup", nudges: 3 });
  await waitForRun(shop.id, "completed", "tenant");
});

test("the first sale ends onboarding as trading once; a second sale sends nothing", async () => {
  const shop = await signup();
  await shop.verify();
  await shop.complete();
  await settle(DAY + 60_000);
  expect(nudgeEmails(shop.email)).toHaveLength(1);
  const [first, second] = await Promise.all([sell(shop.id), sell(shop.id)]);
  expect([first, second].filter(Boolean)).toHaveLength(1);
  expect(await sell(shop.id)).toBe(false);
  await settle();
  await waitForRun(shop.id, "completed", "tenant");
  const row = await onboardingRow(shop.id);
  expect(row).toMatchObject({ status: "trading", nudges: 1 });
  expect(row?.firstSaleAt).toBeInstanceOf(Date);
  expect(
    delivered.filter((message) => message.orgId === shop.id && message.type === "onboarding.event"),
  ).toHaveLength(1);
  await settle(10 * DAY);
  expect(nudgeEmails(shop.email)).toHaveLength(1);
});

test("a rolled-back sale marks nothing and sends no event", async () => {
  const shop = await signup();
  await shop.verify();
  await shop.complete();
  await settle();
  await expect(sale(db, context(shop.id), { fail: true })).rejects.toThrow("the sale failed");
  await settle();
  expect((await onboardingRow(shop.id))?.firstSaleAt).toBeNull();
  expect(
    delivered.filter((message) => message.orgId === shop.id && message.type === "onboarding.event"),
  ).toHaveLength(0);
});
