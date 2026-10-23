// Loyalty through the back-office API, the till's hold lane and a running counter.
//   loyaltyApi(owner, cookie)  -> { settings, setSettings, tiers, createTier, patchTier, archiveTier, transfer, history }
//   ON                         -> a settings body: 100 bps, 1 point = GH₵0.01 (100 units), no expiry, notices 14 days
//   loyaltyHolds()             -> { create(session, customerId, points, over?), release } on the fixture device
//   pointEntries(customer)     -> the customer's loyalty_entry rows, oldest first
//   pointsFold(customer)       -> SUM(points) read straight from the ledger
//   cashSaleEvent(created, customerId) -> the recorded cash sale re-cut as a v5 sale to that customer
//   pointsSaleEvent(created, customerId, holdId, points) -> the same sale paid with `points` and the rest in cash
//   customerSale(counter, customerId, {thousandths, points?, credit?, cash?}) -> a completed counter sale to the customer
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import type { Portal } from "../api/portal";
import { syncHeaders } from "../till/requests";
import { ids } from "../till/sales";
import { api, databases } from "../till/server";
import { expect } from "vite-plus/test";
import type { Session } from "./credit";
import { accountRead } from "./account";
import type { startCounter } from "./till";
import type { recordSale } from "../till/server";

type Json = Record<string, any>;
type Counter = Awaited<ReturnType<typeof startCounter>>;
type Created = Awaited<ReturnType<typeof recordSale>>;

export const ON = {
  enabled: true,
  earnBps: 100,
  pointValue: 100,
  expiryDays: 0,
  tierNoticeDays: 14,
};

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
  return { status: response.status, body: parsed };
}

export function loyaltyApi(owner: Portal, cookie: string) {
  return {
    settings: () => call(owner, cookie, "GET", "/settings/loyalty"),
    setSettings: (body: unknown) => call(owner, cookie, "PUT", "/settings/loyalty", body),
    tiers: () => call(owner, cookie, "GET", "/loyalty/tiers"),
    createTier: (body: unknown) => call(owner, cookie, "POST", "/loyalty/tiers", body),
    patchTier: (id: string, body: unknown) =>
      call(owner, cookie, "PATCH", `/loyalty/tiers/${id}`, body),
    archiveTier: (id: string) => call(owner, cookie, "POST", `/loyalty/tiers/${id}/archive`),
    transfer: (body: unknown) => call(owner, cookie, "POST", "/loyalty/transfers", body),
    history: (id: string) => call(owner, cookie, "GET", `/customers/${id}/loyalty`),
    customer: (id: string) => call(owner, cookie, "GET", `/customers/${id}`),
  };
}

async function send(method: string, path: string, body?: unknown) {
  const response = await api.request(path, {
    method,
    headers: syncHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) as Json };
  } catch {
    return { status: response.status, body: { raw: text } as Json };
  }
}

/** Points set aside for a redeem tender: `POST /sync/customers/holds` with `kind: "loyalty"` and whole `points`. */
export function loyaltyHolds() {
  return {
    create: (session: Session, customerId: string, points: unknown, over: { id?: string } = {}) =>
      send("POST", "/sync/customers/holds", {
        requestId: v7(),
        proof: session.proof,
        hold: {
          id: over.id ?? v7(),
          orgId: ids.org,
          sessionId: session.sessionId,
          customerId,
          kind: "loyalty",
          points,
        },
      }),
    release: (session: Session, holdId: string) =>
      send("POST", `/sync/customers/holds/${holdId}/release`, {
        requestId: v7(),
        proof: session.proof,
        release: { orgId: ids.org, sessionId: session.sessionId },
      }),
    account: async (customerId: string) =>
      send("POST", `/sync/customers/${customerId}/account`, await accountRead()),
  };
}

export async function pointEntries(customerId: string) {
  const { rows } = await databases().db.execute<Json>(sql`
    SELECT id, reason, points, sale_id, refund_id, hold_id, rate_bps, point_value::int AS point_value, actor_id
    FROM loyalty_entry WHERE org_id = ${ids.org} AND customer_id = ${customerId}
    ORDER BY occurred_at, id`);
  return rows;
}

export async function pointsFold(customerId: string) {
  const { rows } = await databases().db.execute<{ total: string }>(sql`
    SELECT COALESCE(SUM(points), 0)::text AS total FROM loyalty_entry
    WHERE org_id = ${ids.org} AND customer_id = ${customerId}`);
  return Number(rows[0]!.total);
}

/** Every point in the org, to show that a transfer moves points without making any. */
export async function orgPoints() {
  const { rows } = await databases().db.execute<{ total: string }>(
    sql`SELECT COALESCE(SUM(points), 0)::text AS total FROM loyalty_entry WHERE org_id = ${ids.org}`,
  );
  return Number(rows[0]!.total);
}

const snapshot = (customerId: string) => ({
  id: customerId,
  name: "Snapshot Name",
  phone: "0240000098",
  kind: "individual",
  businessName: null,
  tin: null,
});

/** The recorded one-line cash sale as a v5 sale to the customer, paid as recorded. */
export function cashSaleEvent(created: Created, customerId: string) {
  return {
    ...structuredClone(created.event),
    v: 5,
    sale: { ...structuredClone(created.event.sale), customer: snapshot(customerId) },
  };
}

/** The same sale paid with `points` (worth `points * 100` units) and the rest in exact cash. */
export function pointsSaleEvent(
  created: Created,
  customerId: string,
  holdId: string,
  points: number,
  value = points * 100,
) {
  const sale = created.event.sale;
  const gross = Number(sale.totals.gross);
  return {
    ...structuredClone(created.event),
    v: 5,
    sale: {
      ...structuredClone(sale),
      customer: snapshot(customerId),
      cashRounding: 0,
      total: gross,
      paid: gross,
      change: 0,
      tenders: [
        { id: holdId, kind: "loyalty", amount: value, points },
        { id: v7(), kind: "cash", amount: gross - value },
      ],
    },
  };
}

/** Sells `thousandths` of the first product to the customer at the counter, on account and with points when given. */
export async function customerSale(
  counter: Counter,
  customerId: string,
  options: { thousandths: number; points?: number; credit?: number; cash?: number },
) {
  const productId = counter.register.fixture.config.references.products[0].id;
  await counter.ask({
    type: "add",
    expectedRevision: 0,
    productId,
    quantityThousandths: options.thousandths,
  });
  const attached = await counter.ask({ type: "customer.attach", expectedRevision: 1, customerId });
  expect(attached).toMatchObject({ kind: "draft", view: { customer: { id: customerId } } });
  let revision = 2;
  if (options.credit) {
    const charged = await counter.ask({
      type: "tender.account",
      expectedRevision: revision,
      kind: "credit",
      amount: options.credit,
    });
    expect(charged).toMatchObject({ type: "result", kind: "draft" });
    revision += 1;
  }
  if (options.points) {
    const redeemed = await counter.ask({
      type: "tender.account",
      expectedRevision: revision,
      kind: "loyalty",
      points: options.points,
    });
    expect(redeemed).toMatchObject({ type: "result", kind: "draft" });
    revision += 1;
  }
  const cash = await counter.ask({
    type: "tender.add",
    expectedRevision: revision,
    kind: "cash",
    amount: options.cash ?? 5_000_000,
  });
  expect(cash).toMatchObject({ kind: "draft" });
  const done = await counter.ask({ type: "sale.complete", expectedRevision: revision + 1 });
  expect(done).toMatchObject({ type: "result", kind: "sale" });
  const sale = done.event.sale;
  return { saleId: sale.id as string, sale, receipt: sale.receiptNumber as string };
}
