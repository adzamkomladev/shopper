import { and, asc, eq, isNull } from "drizzle-orm";
import { branch, org, product } from "@shopper/db-pg";
import { availableOf } from "../stock/onhand";
import type { Queryable } from "../types";

/** Steps, in base units, that availability is floored to: only a crossing changes what the relay is sent. */
const STEPS = [0, 1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000].map(
  (units) => units * 1000,
);
/** A rise in a product's availability goes up at most this often; a sell-out goes at once. */
export const AVAILABILITY_DEBOUNCE_MS = 30_000;

/**
 * What each branch can still sell of every online product (v1.5 Day 49): on hand less live holds less the shop's
 * buffer, floored to the step below it, so the relay never offers more than the box has and a run of sales crosses a
 * step only now and then. Weighed goods under one unit floor to 0: they are not offered online.
 * On the relay the same function reads back exactly what was published (its buffer is 0 and a step floors to itself).
 */
export async function relayAvailability(db: Queryable, orgId: string, now: Date) {
  const [shop] = await db.select({ buffer: org.onlineBuffer }).from(org).where(eq(org.id, orgId));
  const branches = await db
    .select({ id: branch.id })
    .from(branch)
    .where(eq(branch.orgId, orgId))
    .orderBy(asc(branch.id));
  const byProduct = new Map<string, { branchId: string; available: number }[]>();
  for (const site of branches) {
    const rows = await db
      .select({ id: product.id, available: availableOf(orgId, site.id, product.id, now) })
      .from(product)
      .where(
        and(eq(product.orgId, orgId), eq(product.onlineVisible, true), isNull(product.archivedAt)),
      );
    for (const row of rows)
      byProduct.set(row.id, [
        ...(byProduct.get(row.id) ?? []),
        { branchId: site.id, available: step(row.available - (shop?.buffer ?? 0)) },
      ]);
  }
  return [...byProduct]
    .map(([id, list]) => ({ id, branches: list }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Whether a changed availability row goes on this run: a drop at any branch always does (the relay must never offer
 * more than the box has), a rise once the row's last publish is AVAILABILITY_DEBOUNCE_MS old. `last.hash` holds the
 * figures last sent.
 */
export function availabilityDue(
  row: { branches: { branchId: string; available: number }[] },
  last: { hash: string; publishedAt: Date },
  now: Date,
) {
  const before = new Map(
    (JSON.parse(last.hash) as { branchId: string; available: number }[]).map((entry) => [
      entry.branchId,
      entry.available,
    ]),
  );
  return (
    row.branches.some((entry) => entry.available < (before.get(entry.branchId) ?? Infinity)) ||
    now.getTime() - last.publishedAt.getTime() >= AVAILABILITY_DEBOUNCE_MS
  );
}

const step = (thousandths: number) => STEPS.filter((floor) => floor <= thousandths).at(-1) ?? 0;
