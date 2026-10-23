import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { creditEntry, type ShopperTransaction } from "@shopper/db-pg";
import { mulRate, sub, type Money } from "@shopper/money";
import type { Queryable } from "../../types";
import { readCustomerRow } from "../queries";
import { ageEntries } from "./ageing";
import { readCreditSettings } from "./settings";

const DAY = 86_400_000;
type Entry = { kind: string; amount: Money; occurredAt: Date };
type Input = { customerId: string; at: Date };

/**
 * Charges a month's interest: `credit_interest_bps` of the principal past its terms at `at` (the 1st of the month,
 * Accra keeps UTC), once per customer and period. Simple interest: earlier interest is never charged on. A period
 * already charged, nothing overdue or a rate of 0 posts nothing.
 */
export const postInterest = defineCommand({
  name: "credit.interest",
  async replay(tx, ctx, input: Input) {
    const assessed = await assess(tx, ctx, input);
    return assessed.amount === 0 || assessed.saved ? { output: assessed.output } : undefined;
  },
  async run(tx, ctx, input) {
    const assessed = await assess(tx, ctx, input);
    if (assessed.amount === 0 || assessed.saved) return assessed.output;
    await tx.insert(creditEntry).values({
      orgId: ctx.orgId,
      customerId: assessed.customerId,
      kind: "interest",
      amount: assessed.amount,
      period: assessed.period,
      occurredAt: input.at,
    });
    return { ...assessed.output, posted: true };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({ entity: "customer", entityId: output.customerId }),
});

/** The principal past its terms at `at`, FIFO; interest entries are left out of the principal. */
export function overdueAt(entries: readonly Entry[], termsDays: number, at: Date) {
  const principal = entries.filter((e) => e.kind !== "interest" && e.occurredAt <= at);
  const { total, buckets } = ageEntries(principal, termsDays, at);
  return sub(total, buckets.current);
}

/** The first month start after `now` with something overdue, assuming no new entries; null when there is none. */
export function nextInterestAt(entries: readonly Entry[], termsDays: number, now: Date) {
  if (entries.length === 0) return null;
  const last = Math.max(...entries.map((e) => e.occurredAt.getTime()));
  const horizon = last + (termsDays + 62) * DAY;
  for (let at = nextMonthStart(now); at.getTime() <= horizon; at = nextMonthStart(at))
    if (overdueAt(entries, termsDays, at) > 0) return at;
  return null;
}

export const nextMonthStart = (at: Date) =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));

/** A customer's credit entries, for the pure interest and due-date sums. */
export async function creditEntries(db: Queryable, orgId: string, customerId: string) {
  return db
    .select({
      kind: creditEntry.kind,
      amount: creditEntry.amount,
      occurredAt: creditEntry.occurredAt,
    })
    .from(creditEntry)
    .where(and(eq(creditEntry.orgId, orgId), eq(creditEntry.customerId, customerId)));
}

async function assess(tx: ShopperTransaction, ctx: CommandContext, input: Input) {
  const current = await readCustomerRow(tx, ctx.orgId, input.customerId, true);
  const period = input.at.toISOString().slice(0, 7);
  const settings = await readCreditSettings(tx, ctx.orgId);
  const [saved] = await tx
    .select({ amount: creditEntry.amount })
    .from(creditEntry)
    .where(
      and(
        eq(creditEntry.orgId, ctx.orgId),
        eq(creditEntry.customerId, current.id),
        eq(creditEntry.period, period),
      ),
    );
  const entries = settings.interestBps > 0 ? await creditEntries(tx, ctx.orgId, current.id) : [];
  const amount = saved
    ? saved.amount
    : mulRate(overdueAt(entries, settings.termsDays, input.at), settings.interestBps);
  return {
    customerId: current.id,
    period,
    amount,
    saved: Boolean(saved),
    output: { customerId: current.id, period, amount, posted: false },
  };
}
