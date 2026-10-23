// Customers, identity checks and statement links for the portal specs. Customers and links go through the
// real API as the E2E Mart owner; ledger rows and review-ready cases are written straight to the e2e database,
// because the sales and the person who would have produced them are not what these specs test.
//   customer(request, over)               -> a new customer { id, name, phone }
//   charge / payment(request, id, amount, daysAgo)   ledger entries in minor units (1 GH₵ = 10000)
//   statementLink(request, customerId)    -> { id, token, url, from, to }
//   seedCase(request, over)               -> a kyc_case for a fresh customer, by default waiting in review
//   otpFor(request, phone, nth)           -> the nth 6-digit code the Arkesel fake received for that number
import { expect, type APIRequestContext } from "@playwright/test";
import { Client } from "pg";
import { v7 } from "uuid";
import { E2E_DATABASE_URL } from "../../../tooling/database/e2e";
import { BOX_API, MART } from "../e2e";
import { post, shopHeaders, unique } from "../admin";

export const ARKESEL_URL = process.env.E2E_ARKESEL_URL ?? "http://127.0.0.1:3104";
const DAY = 86_400_000;

async function sql<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows as T[];
  } finally {
    await client.end();
  }
}

export const orgId = async (request: APIRequestContext) =>
  (await shopHeaders(request))["X-Shopper-Org"];

let phoneSequence = Date.now() % 1_000_000;
/** A Ghana mobile number no other spec in this run used. */
export const freshPhone = () => `0245${String(++phoneSequence % 1_000_000).padStart(6, "0")}`;

export async function customer(
  request: APIRequestContext,
  over: { name?: string; phone?: string } = {},
) {
  const body = {
    id: v7(),
    name: over.name ?? `Ama ${unique()}`,
    phone: over.phone ?? freshPhone(),
    kind: "individual",
  };
  await post(request, "/customers", body);
  return { id: body.id, name: body.name, phone: body.phone };
}

async function ownerId(org: string) {
  const [row] = await sql<{ id: string }>(
    `SELECT id FROM "user" WHERE org_id = $1 AND email = $2`,
    [org, MART.email],
  );
  return row!.id;
}

async function entry(
  request: APIRequestContext,
  customerId: string,
  kind: "charge" | "payment",
  amount: number,
  daysAgo: number,
) {
  const org = await orgId(request);
  await sql(
    `INSERT INTO credit_entry (org_id, customer_id, kind, amount, method, actor_id, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      org,
      customerId,
      kind,
      kind === "charge" ? amount : -amount,
      kind === "payment" ? "cash" : null,
      await ownerId(org),
      new Date(Date.now() - daysAgo * DAY),
    ],
  );
}
export const charge = (request: APIRequestContext, id: string, amount: number, daysAgo = 0) =>
  entry(request, id, "charge", amount, daysAgo);
export const payment = (request: APIRequestContext, id: string, amount: number, daysAgo = 0) =>
  entry(request, id, "payment", amount, daysAgo);

const isoDay = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

export async function statementLink(request: APIRequestContext, customerId: string) {
  const from = isoDay(30);
  const to = isoDay(0);
  const link = await post<{ id: string; token: string; url: string }>(
    request,
    `/customers/${customerId}/statement/links`,
    { from, to },
  );
  return { ...link, from, to };
}

export async function revokeStatementLink(
  request: APIRequestContext,
  customerId: string,
  linkId: string,
) {
  const response = await request.delete(
    `${BOX_API}/customers/${customerId}/statement/links/${linkId}`,
    { headers: await shopHeaders(request) },
  );
  expect(response.status(), await response.text()).toBe(200);
}

type CaseOver = {
  status?: "otp_sent" | "id_needed" | "review" | "approved" | "rejected";
  limit?: number;
  id?: { type: string; masked: string; fingerprint: string; fullName: string };
  customer?: { id: string; phone: string };
};

/** An ID as a case shows it: a masked Ghana Card, with a fingerprint of its own unless two cases should share one. */
export const ghanaCard = (fingerprint = `fp-${v7()}`) => ({
  type: "ghana_card",
  masked: "GHA-•••••••45-6",
  fullName: "Ama Mensah",
  fingerprint,
});

/** A credit case as the workflow leaves it: phone verified, an ID (or none) on file, waiting in `status`. */
export async function seedCase(request: APIRequestContext, over: CaseOver = {}) {
  const org = await orgId(request);
  const subject = over.customer ?? (await customer(request));
  const id = v7();
  const status = over.status ?? "review";
  const decided = status === "approved" || status === "rejected";
  const opener = await ownerId(org);
  const limit = over.limit ?? 5_000_000;
  await sql(
    `INSERT INTO kyc_case (id, org_id, customer_id, purpose, requested_limit, phone, status, id_type,
       id_fingerprint, id_masked, full_name, opened_by, decided_by, decided_at, decision_note,
       approved_limit, id_sighted, decision_due_at)
     VALUES ($1, $2, $3, 'credit', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
    [
      id,
      org,
      subject.id,
      limit,
      subject.phone,
      status,
      over.id?.type ?? null,
      over.id?.fingerprint ?? null,
      over.id?.masked ?? null,
      over.id?.fullName ?? null,
      opener,
      decided ? opener : null,
      decided ? new Date() : null,
      decided ? (status === "approved" ? "Known customer" : "Name does not match") : null,
      status === "approved" ? limit : null,
      status === "approved" && Boolean(over.id),
      new Date(Date.now() + 7 * DAY),
    ],
  );
  return { id, customerId: subject.id, phone: subject.phone };
}

export async function caseRow(caseId: string) {
  const [row] = await sql<{
    status: string;
    approved_limit: string | null;
    id_sighted: boolean;
    decision_note: string | null;
  }>(`SELECT status, approved_limit::text, id_sighted, decision_note FROM kyc_case WHERE id = $1`, [
    caseId,
  ]);
  return row!;
}
export async function customerRow(customerId: string) {
  const [row] = await sql<{ credit_limit: string; kyc_verified_at: string | null }>(
    `SELECT credit_limit::text, kyc_verified_at::text FROM customer WHERE id = $1`,
    [customerId],
  );
  return row!;
}

/** The `nth` (1-based) 6-digit code the SMS fake received for `phone` (0XXXXXXXXX), once it has arrived. */
export async function otpFor(request: APIRequestContext, phone: string, nth = 1) {
  const recipient = phone.replace(/^0/, "233");
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const sent = (await (await request.get(`${ARKESEL_URL}/test/requests`)).json()) as {
          recipients: string[];
          message: string;
        }[];
        const mine = sent.filter((send) => send.recipients.includes(recipient));
        code = mine[nth - 1]?.message.match(/(?<!\d)\d{6}(?!\d)/)?.[0];
        return code;
      },
      { message: `an SMS code for ${phone}`, timeout: 10_000 },
    )
    .toBeDefined();
  return code!;
}

/** Changes org settings straight in the database (a spec's way of resetting them). */
export async function setOrgSettings(org: string, values: Record<string, unknown>) {
  const columns = Object.keys(values);
  await sql(
    `UPDATE org SET ${columns.map((column, index) => `${column} = $${index + 2}`).join(", ")} WHERE id = $1`,
    [org, ...Object.values(values)],
  );
}
