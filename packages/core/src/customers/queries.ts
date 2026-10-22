import * as v from "valibot";
import { and, desc, eq, ilike, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { customer } from "@shopper/db-pg";
import { fromBigInt } from "@shopper/money";
import { customerId, customerQuery } from "../schemas/customers/inputs";
import type { Queryable } from "../types";
import { CustomerError } from "./error";

const like = (q: string) => `%${q.replace(/[\\%_]/g, "\\$&")}%`;

// Plain SQL, qualified by the outer "customer": Drizzle drops table names from a single-table select.
/** What the customer owes (below zero is a deposit): the one definition, a fold of the credit ledger. */
const balance = sql<string>`COALESCE((SELECT SUM(amount) FROM credit_entry WHERE org_id = "customer".org_id AND customer_id = "customer".id), 0)::bigint`;
/** The points held: a fold of the loyalty ledger. */
const points = sql<number>`COALESCE((SELECT SUM(points) FROM loyalty_entry WHERE org_id = "customer".org_id AND customer_id = "customer".id), 0)::bigint`;

const select = (db: Queryable) =>
  db
    .select({
      ...customerColumns(),
      balance: balance.mapWith((value) => fromBigInt(BigInt(value))),
      points: points.mapWith(Number),
    })
    .from(customer);

function customerColumns() {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    kind: customer.kind,
    businessName: customer.businessName,
    tin: customer.tin,
    email: customer.email,
    creditLimit: customer.creditLimit,
    version: customer.version,
    archivedAt: customer.archivedAt,
    mergedIntoId: customer.mergedIntoId,
  };
}

type CustomerRow = Awaited<ReturnType<typeof readCustomerRow>>;

/** The JSON a client sees. */
export const customerView = (row: CustomerRow) => ({
  ...row,
  archivedAt: row.archivedAt?.toISOString() ?? null,
});

/**
 * The customer with its folded balance and points, or NOT_FOUND when the id is not this org's.
 * `lock` takes the row lock first, so the folds are read after it is held.
 */
export async function readCustomerRow(db: Queryable, orgId: string, id: string, lock = false) {
  const where = and(eq(customer.orgId, orgId), eq(customer.id, v.parse(customerId, id)));
  if (lock) await db.select({ id: customer.id }).from(customer).where(where).for("update");
  const [found] = await select(db).where(where);
  if (!found) throw new CustomerError("NOT_FOUND", "Customer not found");
  return found;
}

export async function readCustomer(db: Queryable, orgId: string, id: string) {
  return customerView(await readCustomerRow(db, orgId, id));
}

/** Customers newest first, keyset-paged. A search matches name, business name, phone prefix or TIN. */
export async function listCustomers(db: Queryable, orgId: string, rawQuery: unknown) {
  const { q, archived, cursor, limit } = v.parse(customerQuery, rawQuery);
  const filters: (SQL | undefined)[] = [
    eq(customer.orgId, orgId),
    archived ? isNotNull(customer.archivedAt) : isNull(customer.archivedAt),
    cursor ? lt(customer.id, cursor) : undefined,
    q
      ? or(
          ilike(customer.name, like(q)),
          ilike(customer.businessName, like(q)),
          ilike(customer.phone, like(q.replaceAll(" ", ""))),
          eq(customer.tin, q.toUpperCase()),
        )
      : undefined,
  ];
  const rows = await select(db)
    .where(and(...filters))
    .orderBy(desc(customer.id))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map(customerView);
  return { items, nextCursor: rows.length > limit ? items[limit - 1]!.id : null };
}

/** Every active customer by name, for the CSV export. */
// ponytail: one read of the whole org; page it when an org holds tens of thousands of customers.
export function exportRows(db: Queryable, orgId: string) {
  return select(db)
    .where(and(eq(customer.orgId, orgId), isNull(customer.archivedAt)))
    .orderBy(customer.name, customer.id);
}
