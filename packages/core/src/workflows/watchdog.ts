import { lte } from "drizzle-orm";
import { org, store, subscription, type ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";
import { auditAnchorId } from "../audit/anchor";
import { storeDayId } from "../reports/day/steps";
import { settlementId } from "../payments/settlements/record";
import { billingId } from "../billing/access";

const DAY_MS = 86_400_000;

/**
 * The one daily watchdog (the cron at 23:59 UTC on Cloudflare, a timer on the box): starts the day's audit anchor for
 * every org, and today's and tomorrow's store day for every store, so a store-day chain that died picks up again
 * tomorrow, (where Paystack is set up) the day's settlement fetch for every org, and each subscription's billing
 * period falling due by tomorrow. Starting an id that already exists does nothing, so a second firing the same day is harmless.
 */
export async function runWatchdog(
  deps: {
    withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
    anchors: WorkflowLauncher;
    storeDays: WorkflowLauncher;
    settlements?: WorkflowLauncher;
    billing?: WorkflowLauncher;
  },
  at: Date,
) {
  const today = at.toISOString().slice(0, 10);
  const tomorrow = new Date(at.getTime() + DAY_MS).toISOString().slice(0, 10);
  const [orgs, stores] = await deps.withDatabase((db) =>
    Promise.all([
      db.select({ id: org.id }).from(org),
      db.select({ orgId: store.orgId, id: store.id }).from(store),
    ]),
  );
  for (const row of orgs) {
    await deps.anchors.start(auditAnchorId(row.id, today), { orgId: row.id, day: today });
    await deps.settlements?.start(settlementId(row.id, today), { orgId: row.id, day: today });
  }
  // A billing period starts the day before it falls due, so the invoice is raised at midnight UTC.
  const due = deps.billing
    ? await deps.withDatabase((db) =>
        db
          .select({ orgId: subscription.orgId, periodStart: subscription.nextInvoiceOn })
          .from(subscription)
          .where(lte(subscription.nextInvoiceOn, tomorrow)),
      )
    : [];
  for (const row of due)
    await deps.billing!.start(billingId(row.orgId, row.periodStart), {
      orgId: row.orgId,
      periodStart: row.periodStart,
    });
  for (const row of stores)
    for (const day of [today, tomorrow])
      await deps.storeDays.start(storeDayId(row.orgId, row.id, day), {
        orgId: row.orgId,
        storeId: row.id,
        day,
      });
}
