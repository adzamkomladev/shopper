// Drawer account payments: the `POST /sync/accounts/payments` lane and the register's own record of them.
//   paymentEvent(session, shiftId, over?)  -> an upload body (`account.payment` v1) as a till would queue it
//   postPayment(body)                      -> { status, body } as the fixture device
//   tillPayments(counter)                  -> the register's account_payment rows, oldest first
//   shiftOf(counter)                       -> the id of the register's open shift
//   report(counter)                        -> the X report the bridge answers
//   paymentAudit(customerId)               -> the server's `customer.payment` audit rows for the customer
import { and, asc, eq, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { auditLog } from "@shopper/db-pg";
import { syncHeaders } from "../till/requests";
import { ids } from "../till/sales";
import { api, databases } from "../till/server";
import type { Uploader } from "./till";
import type { startCounter } from "./till";

type Counter = Awaited<ReturnType<typeof startCounter>>;
type Json = Record<string, any>;

export const paymentEvent = (session: Uploader, shiftId: string, over: Json = {}) => ({
  requestId: v7(),
  proof: session.proof,
  payment: {
    v: 1,
    type: "account.payment",
    payment: {
      orgId: ids.org,
      sessionId: session.sessionId,
      occurredAt: new Date().toISOString(),
      id: v7(),
      customerId: v7(),
      shiftId,
      method: "cash",
      amount: 20_000,
      reference: null,
      ...over,
    },
  },
});

export async function postPayment(body: unknown, headers: Record<string, string> = syncHeaders()) {
  const response = await api.request("/sync/accounts/payments", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) as Json };
  } catch {
    // A missing route answers "404 Not Found" as plain text.
    return { status: response.status, body: { raw: text } as Json };
  }
}

export const tillPayments = (counter: Counter) =>
  counter.register.fixture.database.read((tx) =>
    tx.all<Json>(sql`SELECT * FROM account_payment ORDER BY rowid`),
  );

export async function shiftOf(counter: Counter) {
  const { shift } = await counter.register.status();
  return shift.current.id as string;
}

export async function report(counter: Counter) {
  const reply = await counter.ask({ type: "shift.report" });
  if (reply.kind !== "shiftReport") throw new Error(`Expected an X report, got ${reply.code}`);
  return reply.report as Json;
}

export const paymentAudit = (customerId: string) =>
  databases()
    .db.select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, ids.org),
        eq(auditLog.command, "customer.payment"),
        eq(auditLog.entityId, customerId),
      ),
    )
    .orderBy(asc(auditLog.chainSeq));
