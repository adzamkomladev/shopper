import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { tenant } from "./base";

export const onboardingStatuses = ["setup", "trading"] as const;

/**
 * A cloud shop's way from provisioning to its first sale. Created with the org; before that the registration
 * request is the record. Wizard steps are read from the real rows (stores, products, devices); only what has no
 * row of its own is stamped here.
 */
export const onboarding = pgTable(
  "onboarding",
  {
    ...tenant(),
    status: text("status", { enum: onboardingStatuses }).notNull().default("setup"),
    /** The first product, import or a skipped Products step. */
    catalogueAt: timestamp("catalogue_at", { withTimezone: true }),
    wizardDoneAt: timestamp("wizard_done_at", { withTimezone: true }),
    wizardSkippedAt: timestamp("wizard_skipped_at", { withTimezone: true }),
    firstSaleAt: timestamp("first_sale_at", { withTimezone: true }),
    nudges: integer("nudges").notNull().default(0),
  },
  (t) => [
    unique().on(t.orgId),
    check("onboarding_status", sql`${t.status} IN ('setup', 'trading')`),
    check("onboarding_trading", sql`(${t.status} = 'trading') = (${t.firstSaleAt} IS NOT NULL)`),
    check("onboarding_nudges", sql`${t.nudges} BETWEEN 0 AND 3`),
  ],
);
