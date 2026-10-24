// Credit holds on the till sync lane, and the sale events that spend them.
//   Assumed wire shapes (the plan names the routes, not the bodies):
//     POST /sync/customers/holds              {requestId, proof, hold:{id, orgId, sessionId, customerId, kind:"credit", amount}}
//     POST /sync/customers/holds/:id/release  {requestId, proof, release:{orgId, sessionId}}
//     POST /sync/customers/:id/account        {proof, session:{orgId, sessionId}} -> {limit, balance, held, available, eligible, points, pointValue, loyaltyEnabled}
//   creditHolds(headers?)           -> { create, release, account } for one enrolled device (default: the fixture's)
//   secondDevice()                  -> another enrolled device with a session valid now
//   sessionOf(userId, pin)          -> a session valid now for that member on the fixture device
//   verifiedCustomer(api, limit)    -> a customer created through the API (so tills pull it) with a KYC-verified limit
//   freshSale()                     -> a golden sale on a re-enrolled till, for suites that also start counters
//   sameTillSale()                  -> another sale on that till
//   creditSaleEvent(created, ...)   -> the recorded sale as a v5 event paid wholly by one credit tender
//   pushSale(created, event)        -> { status, body } of POST /sync/push for that event
//   holdRows(customer) / backdate(holdId) / saleRows(saleId)
import { sql } from "drizzle-orm";
import { v7 } from "uuid";
import type { customerApi } from "./http";
import { accountRead } from "./account";
import { enrollFixtureTill } from "../till/enrollment";
import { pushEvents, syncHeaders } from "../till/requests";
import { openTillDatabase } from "@shopper/adapters-box";
import { provisionTillReference, recordLocalSale } from "@shopper/core/till";
import { goldenReferences } from "../../fixtures/sales/golden/references";
import { ids } from "../till/sales";
import { insertOpenShift } from "../till/shifts";
import {
  api,
  databases,
  deviceId,
  deviceToken,
  devices,
  hostConfiguration,
  principal,
  type recordSale,
  renewTillEnrollment,
} from "../till/server";

type Json = Record<string, any>;
export type Session = { sessionId: string; proof: string };
type Device = { headers: Record<string, string>; session: Session };

async function send(method: string, path: string, headers: Record<string, string>, body?: unknown) {
  const response = await api.request(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Json;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed };
}

export function creditHolds(device?: Record<string, string>) {
  // Read per call: every counter the suite starts re-enrols the fixture device.
  const headers = () => device ?? syncHeaders();
  return {
    create(
      session: Session,
      customerId: string,
      amount: number,
      over: { id?: string; kind?: string } = {},
    ) {
      return send("POST", "/sync/customers/holds", headers(), {
        requestId: v7(),
        proof: session.proof,
        hold: {
          id: over.id ?? v7(),
          orgId: ids.org,
          sessionId: session.sessionId,
          customerId,
          kind: over.kind ?? "credit",
          amount,
        },
      });
    },
    release: (session: Session, holdId: string) =>
      send("POST", `/sync/customers/holds/${holdId}/release`, headers(), {
        requestId: v7(),
        proof: session.proof,
        release: { orgId: ids.org, sessionId: session.sessionId },
      }),
    account: async (customerId: string, session?: Session) =>
      send("POST", `/sync/customers/${customerId}/account`, headers(), await accountRead(session)),
  };
}

/** A cashier session valid now on the fixture device (the fixture's own are dated 2025-12-31). */
export async function sessionOf(userId: string, pin: string): Promise<Session> {
  const login = await devices.login({ deviceId, deviceToken, userId, pin });
  return { sessionId: login.id, proof: login.token };
}

export async function secondDevice(): Promise<Device> {
  const enrolled = await enrollFixtureTill(databases().db, devices, principal);
  const login = await devices.login({
    deviceId: enrolled.deviceId,
    deviceToken: enrolled.deviceToken,
    userId: principal.userId,
    pin: "1357",
  });
  return {
    headers: {
      authorization: `Bearer ${enrolled.deviceToken}`,
      "X-Shopper-Device": enrolled.deviceId,
      "X-Shopper-Org": ids.org,
      "content-type": "application/json",
    },
    session: { sessionId: login.id, proof: login.token },
  };
}

/** Created through the API so the change feed carries it to tills; the limit and KYC mark are set directly. */
export async function verifiedCustomer(
  portal: ReturnType<typeof customerApi>,
  limit: number,
  fields: { name?: string; phone: string },
) {
  const id = v7();
  const created = await portal.create({
    id,
    name: fields.name ?? "Credit Customer",
    phone: fields.phone,
    kind: "individual",
  });
  if (created.status !== 201) throw new Error(`Customer create failed: ${created.status}`);
  await databases().db.execute(
    sql`UPDATE customer SET credit_limit = ${limit}, kyc_verified_at = now() WHERE org_id = ${ids.org} AND id = ${id}`,
  );
  return id;
}

type Created = Awaited<ReturnType<typeof recordSale>>;
let golden: Awaited<ReturnType<typeof goldenTill>> | undefined;

/**
 * A golden-catalogue sale on a freshly enrolled till (counters re-enrol the fixture device). It is stamped inside
 * the enrolment's aged session and on or after the golden tax rules' 1 Jan 2026 start, so the server accepts it.
 */
export async function freshSale() {
  await renewTillEnrollment();
  golden = await goldenTill();
  return sameTillSale();
}

/** Another sale on the till `freshSale` enrolled. */
export async function sameTillSale(): Promise<Created> {
  if (!golden) throw new Error("Call freshSale first");
  const { local, config, session } = golden;
  const event = await recordLocalSale(local, config, session, {
    lines: [{ productId: goldenReferences.products[0]!.id, quantityThousandths: 1000 }],
  });
  return { event, proof: session.proof, sessionId: session.id };
}

async function goldenTill() {
  const host = await hostConfiguration(":memory:", ["http://localhost"]);
  const session = host.session!;
  const local = openTillDatabase(":memory:");
  const { context } = databases();
  const scope = {
    orgId: host.identity.orgId,
    deviceId: host.identity.deviceId,
    branchId: host.identity.branchId,
  };
  await provisionTillReference(
    local,
    { ...context, ...scope, actorId: session.userId, role: session.roleName },
    goldenReferences,
  );
  await insertOpenShift(local, {
    ...scope,
    storeId: host.identity.storeId,
    openedBy: session.userId,
    openedSessionId: session.id,
  });
  const config = {
    ...scope,
    storeId: host.identity.storeId,
    appVersion: context.appVersion,
    receiptCodes: host.receiptCodes,
    now: () => new Date("2026-01-01T06:00:00.000Z"),
  };
  return { local, config, session };
}

/** The recorded one-line cash sale re-cut as a v5 event whose only tender is credit with tender id `holdId`. */
export function creditSaleEvent(created: Created, customerId: string, holdId: string) {
  const sale = created.event.sale;
  const gross = Number(sale.totals.gross);
  return {
    ...structuredClone(created.event),
    v: 5,
    sale: {
      ...structuredClone(sale),
      customer: {
        id: customerId,
        name: "Snapshot Name",
        phone: "0240000099",
        kind: "individual",
        businessName: null,
        tin: null,
      },
      cashRounding: 0,
      total: gross,
      paid: gross,
      change: 0,
      tenders: [{ id: holdId, kind: "credit", amount: gross }],
    },
  };
}

export const saleGross = (created: Created) => Number(created.event.sale.totals.gross);

export async function pushSale(created: Created, event: unknown) {
  const response = await pushEvents(
    api,
    [event],
    [{ sessionId: created.sessionId, proof: created.proof }],
  );
  return { status: response.status, body: (await response.json()) as Json };
}

export async function holdRows(customerId: string) {
  const { rows } = await databases().db.execute<Json>(sql`
    SELECT id, status, amount::int AS amount, sale_id FROM account_hold
    WHERE org_id = ${ids.org} AND customer_id = ${customerId} ORDER BY id`);
  return rows;
}

/** Makes a hold two hours old, past the hour it counts for. */
export const backdate = (holdId: string) =>
  databases().db.execute(
    sql`UPDATE account_hold SET created_at = now() - interval '2 hours' WHERE org_id = ${ids.org} AND id = ${holdId}`,
  );

export async function saleRows(saleId: string) {
  const { rows } = await databases().db.execute<Json>(sql`
    SELECT s.customer_id, t.kind, t.amount::int AS amount, t.hold_id
    FROM sale s LEFT JOIN sale_tender t ON t.org_id = s.org_id AND t.sale_id = s.id
    WHERE s.org_id = ${ids.org} AND s.id = ${saleId} ORDER BY t.position`);
  return rows;
}
