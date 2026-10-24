// Customers on the till: a running register synced with the shared test API through a recording upstream,
// plus hand-built uploads for the `POST /sync/customers` lane.
//   startCounter()         -> { register, upstream, ask, find, create, offline, online, settle, wire, lookup, close }
//   uploader()             -> a cashier session valid now, for crafted uploads
//   created / updated      -> upload bodies (`customer.created` v1, `customer.updated` v1)
//   upload(body)           -> { status, body } of POST /sync/customers as the fixture device
//   serverCustomer(id)     -> the customer row as the server stores it
//   tillAudit(command, id) -> the server's audit rows of one command on one customer
import { and, asc, eq, sql } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { v7 } from "uuid";
import { auditLog } from "@shopper/db-pg";
import { startRegister, type Register } from "../hardware/host";
import { startHostUpstream } from "../till/host/upstream";
import { syncHeaders } from "../till/requests";
import { ids } from "../till/sales";
import { api, databases, deviceId, deviceToken, devices, principal } from "../till/server";

type Reply = Record<string, any>;
export type Fields = {
  name: string;
  phone: string;
  kind?: "individual" | "business";
  businessName?: string;
  tin?: string;
};

export async function startCounter(
  options: { without?: readonly string[]; permissions?: readonly string[]; shift?: boolean } = {},
) {
  const upstream = await startHostUpstream(api);
  let register: Register;
  try {
    register = await startRegister({
      upstream: upstream.url,
      without: options.without,
      permissions: options.permissions,
      shift: options.shift,
    });
  } catch (error) {
    await upstream.close();
    throw error;
  }
  /** Sales still in the outbox plus customer events and account payments not yet accepted. */
  const unsent = () =>
    register.fixture.database.read(async (tx) => {
      const [row] = await tx.all<{ n: number }>(sql`SELECT
        (SELECT count(*) FROM outbox)
        + (SELECT count(*) FROM customer_upload WHERE accepted_at IS NULL AND blocked_code IS NULL)
        + (SELECT count(*) FROM account_payment WHERE accepted_at IS NULL AND blocked_code IS NULL) AS n`);
      return row!.n;
    });
  const ask = (message: Reply): Promise<Reply> => register.ask(message);
  // Sell against the server's catalogue, not the provisioned one: wait for the first pull.
  await expect
    .poll(async () => (await register.status()).lastPullAt, { timeout: 20_000, interval: 100 })
    .not.toBeNull();
  const counter = {
    register,
    upstream,
    ask,
    find: (phone: string) => ask({ type: "customer.find", phone }),
    create: (fields: Fields) => ask({ type: "customer.create", ...fields }),
    /** Push, pull and uploads once, as the Sync now button does. */
    sync: () => ask({ type: "retry" }),
    /** Twice: the first run uploads, the second pulls what the upload published. */
    async settle() {
      await counter.sync();
      await counter.sync();
    },
    /** Refuses sale pushes and leaves one sale queued, so the document lane holds back every upload. */
    async offline() {
      upstream.setAvailable(false);
      await register.sell([{ kind: "cash", amount: 12_000 }]);
    },
    async online() {
      upstream.setAvailable(true);
      // The refused sale push backs off for up to a second, so sync until it and every upload got through.
      await expect
        .poll(
          async () => {
            await counter.sync();
            return (await unsent()) === 0;
          },
          { timeout: 20_000, interval: 250 },
        )
        .toBe(true);
      await counter.settle();
    },
    /** What reached the server, in order: accepted sale pushes as "sale", customer uploads by event type, "account.payment". */
    wire: () =>
      upstream.requests
        .filter(
          (r) =>
            (r.path === "/sync/push" && r.status === 200) ||
            r.path === "/sync/customers" ||
            r.path === "/sync/accounts/payments",
        )
        .map((r) =>
          r.path === "/sync/push"
            ? "sale"
            : r.path === "/sync/accounts/payments"
              ? "account.payment"
              : (r.request as { customer: { type: string } }).customer.type,
        ),
    uploads: () => upstream.requests.filter((r) => r.path === "/sync/customers"),
    lookup: () =>
      register.fixture.database.read((tx) =>
        tx.all<Reply>(sql`SELECT * FROM customer_lookup ORDER BY customer_id`),
      ),
    async close() {
      await register.close();
      await upstream.close();
    },
  };
  return counter;
}

/** A cashier session valid now: the fixture's own sessions are dated to 2025-12-31. */
export async function uploader() {
  const login = await devices.login({
    deviceId,
    deviceToken,
    userId: principal.userId,
    pin: "1357",
  });
  return { sessionId: login.id, proof: login.token };
}
export type Uploader = Awaited<ReturnType<typeof uploader>>;

export const created = (
  session: Uploader,
  over: Partial<Fields & { id: string; occurredAt: string }> = {},
) => ({
  requestId: v7(),
  proof: session.proof,
  customer: {
    v: 1,
    type: "customer.created",
    customer: {
      orgId: ids.org,
      sessionId: session.sessionId,
      occurredAt: new Date().toISOString(),
      id: v7(),
      name: "Kofi Mensah",
      phone: "0241234567",
      kind: "individual",
      businessName: null,
      tin: null,
      ...over,
    },
  },
});

/** An edit made on a till that last saw `baseVersion` of the customer. */
export const updated = (
  session: Uploader,
  id: string,
  baseVersion: number,
  changes: Record<string, unknown>,
  occurredAt = new Date().toISOString(),
) => ({
  requestId: v7(),
  proof: session.proof,
  customer: {
    v: 1,
    type: "customer.updated",
    customer: {
      orgId: ids.org,
      sessionId: session.sessionId,
      occurredAt,
      id,
      baseVersion,
      changes,
    },
  },
});

export async function upload(body: unknown, headers: Record<string, string> = syncHeaders()) {
  const response = await api.request("/sync/customers", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) as Reply };
  } catch {
    // A missing route answers "404 Not Found" as plain text.
    return { status: response.status, body: { raw: text } as Reply };
  }
}

export async function serverCustomer(id: string) {
  const { rows } = await databases().db.execute<Reply>(sql`
    SELECT name, phone, kind, business_name, tin, version, credit_limit::text AS credit_limit,
      created_device_id, updated_at
    FROM customer WHERE org_id = ${ids.org} AND id = ${id}`);
  return rows[0];
}

export async function customersByPhone(phone: string) {
  const { rows } = await databases().db.execute<{ id: string }>(
    sql`SELECT id FROM customer WHERE org_id = ${ids.org} AND phone = ${phone} ORDER BY id DESC`,
  );
  return rows.map((row) => row.id);
}

export const tillAudit = (command: string, entityId: string) =>
  databases()
    .db.select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, ids.org),
        eq(auditLog.command, command),
        eq(auditLog.entityId, entityId),
      ),
    )
    .orderBy(asc(auditLog.chainSeq));

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
