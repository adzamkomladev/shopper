import { and, eq } from "drizzle-orm";
import type { CommandContext, WorkflowCheckpoint } from "@shopper/audit";
import { workflowRun, type ShopperDatabase } from "@shopper/db-pg";
import type { Queryable } from "../../types";
import { creditEntries, overdueAt, postInterest } from "../credit/interest";
import { readCreditSettings } from "../credit/settings";
import { expirePoints, pointsEntries } from "../loyalty/expiry";
import { nextNoticeAt, sendTierNotice } from "../loyalty/notices";
import { lotExpiry, pointLots } from "../loyalty/points";
import { readLoyaltySettings } from "../loyalty/settings";
import { readCustomerRow } from "../queries";
import { nextDue } from "./due";
import type { AccountSettings, AccountState } from "./types";

export const ACCOUNT_RUN = "customer-account";

/** When the customer's account next needs a posting after `now`, or null. */
export async function accountDue(db: Queryable, orgId: string, customerId: string, now: Date) {
  const { state, settings } = await readAccount(db, orgId, customerId, now);
  return nextDue(state, settings, now);
}

/**
 * Posts what is due: the period's interest when `due` is the 1st of a month, the lots lapsed by `now` and a tier
 * notice due by `now`. Each is a command that only runs when the read says it has work, keyed for the workflow.
 */
export async function postDue(
  db: ShopperDatabase,
  ctx: CommandContext,
  customerId: string,
  due: Date,
  now: Date,
) {
  const { state, settings } = await readAccount(db, ctx.orgId, customerId, now);
  if (state.archived) return;
  const step = (name: string): WorkflowCheckpoint => ({
    instanceId: customerId,
    businessKey: customerId,
    type: ACCOUNT_RUN,
    step: name,
    status: "waiting",
  });
  const monthStart = due.getUTCDate() === 1 && due.getTime() % 86_400_000 === 0;
  if (
    settings.interestBps > 0 &&
    monthStart &&
    overdueAt(state.credit, settings.termsDays, due) > 0
  )
    await postInterest(
      db,
      ctx,
      { customerId, at: due },
      step(`interest-${due.toISOString().slice(0, 7)}`),
    );
  const lapsed =
    settings.loyaltyEnabled &&
    settings.expiryDays > 0 &&
    pointLots(state.points).some(
      (lot) => lot.left > 0 && lotExpiry(lot, settings.expiryDays) <= now,
    );
  if (lapsed)
    await expirePoints(db, ctx, { customerId, at: now }, step(`expire-${now.toISOString()}`));
  if (state.noticeAt && state.noticeAt <= now)
    await sendTierNotice(db, ctx, { customerId, at: now }, step(`notice-${now.toISOString()}`));
}

/** Marks the account's run completed once nothing is due; a later start sets it waiting again. */
export async function endAccountRun(db: Queryable, orgId: string, customerId: string) {
  await db
    .update(workflowRun)
    .set({ status: "completed", currentStep: "idle", updatedAt: new Date() })
    .where(
      and(
        eq(workflowRun.orgId, orgId),
        eq(workflowRun.instanceId, customerId),
        eq(workflowRun.type, ACCOUNT_RUN),
      ),
    );
}

async function readAccount(db: Queryable, orgId: string, customerId: string, now: Date) {
  const current = await readCustomerRow(db, orgId, customerId);
  const credit = await readCreditSettings(db, orgId);
  const loyalty = await readLoyaltySettings(db, orgId);
  const settings: AccountSettings = {
    interestBps: credit.interestBps,
    termsDays: credit.termsDays,
    loyaltyEnabled: loyalty.enabled,
    expiryDays: loyalty.expiryDays,
  };
  const state: AccountState = {
    archived: Boolean(current.archivedAt),
    credit: settings.interestBps > 0 ? await creditEntries(db, orgId, current.id) : [],
    points: loyalty.enabled ? await pointsEntries(db, orgId, current.id) : [],
    noticeAt: await nextNoticeAt(db, orgId, current.id, now),
  };
  return { state, settings };
}
