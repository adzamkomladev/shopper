import { and, asc, eq, isNull } from "drizzle-orm";
import { creditEntry, customer, org } from "@shopper/db-pg";
import { add, money, sub, toDecimal, type Money } from "@shopper/money";
import { toCsv } from "@shopper/utils";
import type { Queryable } from "../../types";
import { readCustomerRow } from "../queries";

const DAY = 86_400_000;
export const ageingBuckets = ["current", "1-30", "31-60", "61-90", "90+"] as const;
type Bucket = (typeof ageingBuckets)[number];
type Entry = { amount: Money; occurredAt: Date };

/**
 * Pure FIFO ageing: every payment and credit note settles the oldest charges first, and what is left of each
 * charge falls in a bucket by the whole days it is past its terms (charge day + `termsDays`) on `asOf`.
 */
export function ageEntries(entries: readonly Entry[], termsDays: number, asOf: Date) {
  const sorted = [...entries].sort((a, b) => a.occurredAt.valueOf() - b.occurredAt.valueOf());
  let credit = sorted.reduce((sum, e) => (e.amount < 0 ? sub(sum, e.amount) : sum), money(0));
  const buckets = Object.fromEntries(ageingBuckets.map((b) => [b, money(0)])) as Record<
    Bucket,
    Money
  >;
  let total = money(0);
  for (const { amount, occurredAt } of sorted) {
    if (amount <= 0) continue;
    const settled = money(Math.min(amount, credit));
    credit = sub(credit, settled);
    const left = sub(amount, settled);
    if (left === 0) continue;
    const late = dayOf(asOf) - dayOf(occurredAt) - termsDays;
    const bucket = bucketOf(late);
    buckets[bucket] = add(buckets[bucket], left);
    total = add(total, left);
  }
  return { total, buckets };
}

/** One customer's ageing on today's date, with the org's credit terms. */
export async function readAgeing(db: Queryable, orgId: string, id: string, asOf = new Date()) {
  const current = await readCustomerRow(db, orgId, id);
  const entries = await db
    .select({ amount: creditEntry.amount, occurredAt: creditEntry.occurredAt })
    .from(creditEntry)
    .where(and(eq(creditEntry.orgId, orgId), eq(creditEntry.customerId, current.id)));
  return { customerId: current.id, ...ageEntries(entries, await termsOf(db, orgId), asOf) };
}

/** Every active customer who owes something, aged, by name. */
// ponytail: one read of the org's whole ledger; aggregate in SQL once ledgers reach millions of rows.
export async function readAgeingReport(db: Queryable, orgId: string, asOf = new Date()) {
  const terms = await termsOf(db, orgId);
  const rows = await db
    .select({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      amount: creditEntry.amount,
      occurredAt: creditEntry.occurredAt,
    })
    .from(creditEntry)
    .innerJoin(
      customer,
      and(eq(customer.orgId, creditEntry.orgId), eq(customer.id, creditEntry.customerId)),
    )
    .where(and(eq(creditEntry.orgId, orgId), isNull(customer.archivedAt)))
    .orderBy(asc(customer.name), asc(customer.id));
  const byCustomer = new Map<string, typeof rows>();
  for (const row of rows) byCustomer.set(row.id, [...(byCustomer.get(row.id) ?? []), row]);
  const items = [...byCustomer.values()].flatMap((entries) => {
    const aged = ageEntries(entries, terms, asOf);
    if (aged.total === 0) return [];
    const { id, name, phone } = entries[0]!;
    return [{ id, name, phone, ...aged }];
  });
  return { items };
}

/** The same report as CSV in cedis. */
export async function ageingCsv(db: Queryable, orgId: string, asOf = new Date()) {
  const { items } = await readAgeingReport(db, orgId, asOf);
  const lines = items.map(({ name, phone, buckets, total }) => [
    name,
    phone,
    ...ageingBuckets.map((b) => toDecimal(buckets[b])),
    toDecimal(total),
  ]);
  return toCsv([["Name", "Phone", "Current", "1-30", "31-60", "61-90", "90+", "Total"], ...lines]);
}

async function termsOf(db: Queryable, orgId: string) {
  const [found] = await db.select({ days: org.creditTermsDays }).from(org).where(eq(org.id, orgId));
  return found?.days ?? 30;
}

const dayOf = (at: Date) => Math.floor(at.valueOf() / DAY);

function bucketOf(late: number): Bucket {
  if (late <= 0) return "current";
  if (late <= 30) return "1-30";
  if (late <= 60) return "31-60";
  if (late <= 90) return "61-90";
  return "90+";
}
