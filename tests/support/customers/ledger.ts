// Back-office callers for the credit routes, and direct ledger reads and dated seeding.
//   creditApi(owner, cookie)              -> { pay, limit, note, statement, ageing, ageingCsv } as a signed-in member
//   addEntryAt(customer, kind, amount, at) -> a credit_entry dated `at` (ISO), as a finished slice would leave it
//   entries(customer)                      -> the customer's credit_entry rows, oldest first
//   failure(promise)                       -> the full message (and driver cause) of a rejected query
//   chainValid()                           -> true when the org's audit chain verifies
//   auditCommands(customer)                -> the audit commands that name the customer
import { asc, eq, sql } from "drizzle-orm";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { auditLog } from "@shopper/db-pg";
import type { Portal } from "../api/portal";
import { ids } from "../till/sales";
import { databases } from "../till/server";

type Json = Record<string, any>;

async function call(owner: Portal, cookie: string, method: string, path: string, body?: unknown) {
  const response = await owner.api.request(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Json;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A missing route answers "404 Not Found" as plain text.
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed, type: response.headers.get("content-type") };
}

export function creditApi(owner: Portal, cookie: string) {
  const at = (id: string, tail: string) => `/customers/${id}${tail}`;
  return {
    pay: (id: string, body: unknown) => call(owner, cookie, "POST", at(id, "/payments"), body),
    limit: (id: string, creditLimit: unknown) =>
      call(owner, cookie, "PUT", at(id, "/limit"), { creditLimit }),
    note: (id: string, body: unknown) => call(owner, cookie, "POST", at(id, "/credit/notes"), body),
    statement: (id: string, query: string) =>
      call(owner, cookie, "GET", at(id, `/statement?${query}`)),
    ageing: (id: string) => call(owner, cookie, "GET", at(id, "/ageing")),
    async ageingCsv() {
      const response = await owner.api.request("/customers/ageing.csv", { headers: { cookie } });
      return {
        status: response.status,
        type: response.headers.get("content-type"),
        text: await response.text(),
      };
    },
  };
}

type Kind = "charge" | "payment" | "credit_note" | "interest" | "transfer";

export async function addEntryAt(customerId: string, kind: Kind, amount: number, at: string) {
  await databases().db.execute(sql`
    INSERT INTO credit_entry (org_id, customer_id, kind, amount, method, reason, actor_id, occurred_at)
    VALUES (${ids.org}, ${customerId}, ${kind}, ${amount},
      ${kind === "payment" ? "cash" : null}, ${kind === "credit_note" ? "Seeded" : null},
      ${ids.cashier}, ${at}::timestamptz)`);
}

export async function entries(customerId: string) {
  const { rows } = await databases().db.execute<Json>(sql`
    SELECT kind, amount::int AS amount, method, reason, sale_id, refund_id, hold_id, actor_id
    FROM credit_entry WHERE org_id = ${ids.org} AND customer_id = ${customerId}
    ORDER BY occurred_at, id`);
  return rows;
}

export async function failure(promise: Promise<unknown>) {
  const error = (await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  )) as { message?: string; cause?: { message?: string } } | undefined;
  return `${error?.message ?? "did not reject"} ${error?.cause?.message ?? ""}`;
}

export async function chainValid() {
  const log = await databases()
    .db.select()
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(asc(auditLog.chainSeq));
  return (await verifyChain(log as AuditEntry[])).valid;
}

/** Audit commands that name the customer, as the entity or in the payload, oldest first. */
export async function auditCommands(customerId: string) {
  const { rows } = await databases().db.execute<{ command: string }>(sql`
    SELECT command FROM audit_log
    WHERE org_id = ${ids.org} AND (entity_id = ${customerId} OR payload::text LIKE ${`%${customerId}%`})
    ORDER BY chain_seq`);
  return rows.map((row) => row.command);
}
