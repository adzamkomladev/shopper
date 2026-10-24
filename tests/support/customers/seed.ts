// Direct SQL seeding for the customer area: the ledgers and holds are written by later slices,
// so these helpers insert rows exactly as a finished slice would leave them.
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import { ids } from "../../fixtures/sales/golden";
import { databases, deviceId } from "../till/server";

type Customer = {
  id?: string;
  orgId?: string;
  name?: string;
  phone?: string;
  kind?: "individual" | "business";
  businessName?: string | null;
  tin?: string | null;
  creditLimit?: number;
  archivedAt?: Date | null;
};

export async function addCustomer(over: Customer = {}) {
  const id = over.id ?? v7();
  const kind = over.kind ?? (over.businessName ? "business" : "individual");
  const limit = over.creditLimit ?? 0;
  await databases().db.execute(sql`
    INSERT INTO customer (id, org_id, name, phone, kind, business_name, tin, credit_limit,
      kyc_verified_at, version, archived_at)
    VALUES (${id}, ${over.orgId ?? ids.org}, ${over.name ?? `Customer ${id.slice(-6)}`},
      ${over.phone ?? "0240000000"}, ${kind}, ${over.businessName ?? null}, ${over.tin ?? null},
      ${limit}, ${limit > 0 ? new Date() : null}, 1, ${over.archivedAt ?? null})`);
  return id;
}

/** Signed amount: charges and interest are positive; payments and credit notes negative. */
export async function addCreditEntry(
  customerId: string,
  kind: "charge" | "payment" | "credit_note" | "interest" | "transfer",
  amount: number,
) {
  await databases().db.execute(sql`
    INSERT INTO credit_entry (org_id, customer_id, kind, amount, method, reason, actor_id, occurred_at)
    VALUES (${ids.org}, ${customerId}, ${kind}, ${amount},
      ${kind === "payment" ? "cash" : null}, ${kind === "credit_note" ? "Seeded" : null},
      ${ids.cashier}, now())`);
}

export async function addLoyaltyEntry(
  customerId: string,
  reason: "earn" | "redeem" | "reverse" | "expire" | "transfer",
  points: number,
) {
  await databases().db.execute(sql`
    INSERT INTO loyalty_entry (org_id, customer_id, reason, points, actor_id, occurred_at)
    VALUES (${ids.org}, ${customerId}, ${reason}, ${points}, ${ids.cashier}, now())`);
}

/** A hold created now (so still counting); `credit` holds an amount, `loyalty` holds points. */
export async function addHold(
  customerId: string,
  kind: "credit" | "loyalty",
  size: number,
  status: "held" | "consumed" | "released" = "held",
) {
  const id = v7();
  await databases().db.execute(sql`
    INSERT INTO account_hold (id, org_id, customer_id, kind, amount, points, point_value, branch_id,
      device_id, cashier_id, status, created_at)
    VALUES (${id}, ${ids.org}, ${customerId}, ${kind},
      ${kind === "credit" ? size : null}, ${kind === "loyalty" ? size : null},
      ${kind === "loyalty" ? 100 : null}, ${ids.branch}, ${deviceId}, ${ids.cashier}, ${status}, now())`);
  return id;
}

/** The two ledger folds: what the customer owes (negative = deposit) and the points held. */
export async function folds(customerId: string) {
  const { rows } = await databases().db.execute<{ balance: string; points: string }>(sql`
    SELECT
      (SELECT COALESCE(SUM(amount), 0) FROM credit_entry WHERE customer_id = ${customerId})::text AS balance,
      (SELECT COALESCE(SUM(points), 0) FROM loyalty_entry WHERE customer_id = ${customerId})::text AS points`);
  return { balance: Number(rows[0]!.balance), points: Number(rows[0]!.points) };
}

export async function holdStatuses(customerId: string) {
  const { rows } = await databases().db.execute<{ status: string }>(
    sql`SELECT status FROM account_hold WHERE customer_id = ${customerId} ORDER BY id`,
  );
  return rows.map((row) => row.status);
}
