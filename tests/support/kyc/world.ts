// Shared setup for the KYC suites: the auth fixture's tenant and members, the shared API wired to a box KYC
// launcher, the Arkesel fake and typed callers. Importing it registers the auth fixture's hooks.
//   Assumed wiring (the plan names the pieces, not their signatures):
//     boxKycFlows({ withDatabase, sms, linkSecret, now? }) -> WorkflowLauncher  (@shopper/adapters-box)
//     createApi({ ..., kyc: launcher, linkSecret })                              (@shopper/api)
//   Assumed wire shapes: see `kyc` below. Case reads carry
//     { id, purpose, status, customerId, memberId, phone, requestedLimit, requestedRoleId, idType, idMasked,
//       fullName, idSighted, duplicates: [{ caseId, customerId }], approvedLimit, approvedRoleId, decisionDueAt }.
import { afterAll, beforeAll, expect, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { boxKycFlows } from "@shopper/adapters-box";
import { arkesel, sms } from "../stock/sms";
import {
  auth,
  baseURL,
  cookies,
  db,
  fixture,
  roleIds,
  secret,
  signIn,
} from "../../integration/auth/setup";

export { arkesel, auth, cookies, db, fixture, roleIds, signIn };
export { allAuditRows, expectChainValid } from "../../integration/catalogue/support";

let api: ReturnType<typeof createApi>;
// The auth fixture's `db` is one pg Client, so a workflow transaction running beside a request would share its
// BEGIN and COMMIT (and a refused request's ROLLBACK would undo the workflow's writes). Workflows get a pool, as on a host.
let workflowPool: Pool;
beforeAll(() => {
  workflowPool = new Pool({ connectionString: fixture.connectionString });
  const workflowDb = drizzle(workflowPool, { schema });
  const launcher = boxKycFlows({
    withDatabase: (run) => run(workflowDb),
    sms,
    linkSecret: secret,
  });
  api = createApi({ database: db, authentication: auth, kyc: launcher, linkSecret: secret });
});
afterAll(async () => {
  await workflowPool.end();
  await arkesel.stop();
});

export async function call(cookie: string, method: string, path: string, body?: unknown) {
  const response = await api.request(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, body: parsed, text };
}

/** The KYC routes as one member: `as("admin")`, `as("accountant")`, `as("cashier")`, or a raw cookie. */
export function as(who: string) {
  const cookie = () => cookies.get(who) ?? who;
  const c = (method: string, path: string, body?: unknown) => call(cookie(), method, path, body);
  return {
    call: c,
    open: (body: unknown) => c("POST", "/kyc", body),
    resend: (id: string) => c("POST", `/kyc/${id}/resend`),
    verify: (id: string, code: string) => c("POST", `/kyc/${id}/verify`, { code }),
    recordId: (id: string, body: unknown) => c("POST", `/kyc/${id}/id`, body),
    skipId: (id: string) => c("POST", `/kyc/${id}/id/skip`),
    decide: (id: string, body: unknown) => c("POST", `/kyc/${id}/decision`, body),
    read: (id: string) => c("GET", `/kyc/${id}`),
    list: (query = "") => c("GET", `/kyc${query ? `?${query}` : ""}`),
    settings: () => c("GET", "/settings/kyc"),
    setSettings: (body: unknown) => c("PUT", "/settings/kyc", body),
  };
}

let sequence = 0;
/** A fresh Ghana mobile number (0XXXXXXXXX), so each case's SMS is told apart in the fake. */
export const phone = () => `024${5_000_000 + ++sequence}`;
const international = (number: string) => number.replace(/^0/, "233");
const sentTo = (number: string) =>
  arkesel.requests.filter((request) => request.recipients.includes(international(number)));

/** The `nth` (1-based) 6-digit code sent to that number, waiting for the workflow to send it. */
export async function otpFor(number: string, nth = 1) {
  await vi.waitFor(() => expect(sentTo(number).length).toBeGreaterThanOrEqual(nth), {
    timeout: 5000,
    interval: 25,
  });
  const code = sentTo(number)[nth - 1]!.message.match(/(?<!\d)\d{6}(?!\d)/)?.[0];
  expect(code, "a 6-digit code in the SMS").toBeDefined();
  return code!;
}
export const smsCount = (number: string) => sentTo(number).length;
export const wrongCodeFor = (code: string) => (code === "000000" ? "111111" : "000000");

export async function newCustomer(over: Record<string, unknown> = {}) {
  const body = { id: v7(), name: "Kofi Credit", phone: phone(), kind: "individual", ...over };
  const created = await as("admin").call("POST", "/customers", body);
  expect(created.status).toBe(201);
  return { id: body.id as string, phone: body.phone as string };
}
export async function userIdOf(roleName: string) {
  const principal = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get(roleName)! } }),
  );
  return principal!.userId;
}

export const caseRow = async (id: string) =>
  (await db.select().from(schema.kycCase).where(eq(schema.kycCase.id, id)))[0]!;
export const customerRow = async (id: string) =>
  (await db.select().from(schema.customer).where(eq(schema.customer.id, id)))[0]!;
export const roleOf = async (userId: string) =>
  (await db.select().from(schema.member).where(eq(schema.member.userId, userId)))[0]!.roleId;
export const runOf = async (id: string) =>
  (await db.select().from(schema.workflowRun).where(eq(schema.workflowRun.instanceId, id)))[0];
export const waitForRun = (id: string, status: string) =>
  vi.waitFor(async () => expect(await runOf(id)).toMatchObject({ status }), {
    timeout: 5000,
    interval: 25,
  });
export const waitForStatus = (id: string, status: string) =>
  vi.waitFor(async () => expect((await caseRow(id)).status).toBe(status), {
    timeout: 5000,
    interval: 25,
  });

/** Open a credit case for a fresh customer and return it with the code the fake received. */
export async function openCredit(over: Record<string, unknown> = {}, who = "accountant") {
  const customer = await newCustomer();
  const opened = await as(who).open({
    subject: { customerId: customer.id },
    purpose: "credit",
    requestedLimit: 5_000_000,
    ...over,
  });
  expect(opened.status).toBe(201);
  return { ...customer, id: opened.body.id as string, customerId: customer.id, opened };
}
/** A credit case verified with its code and with the ID step skipped: waiting in `review`. */
export async function creditInReview() {
  const made = await openCredit();
  expect((await as("accountant").verify(made.id, await otpFor(made.phone))).status).toBe(200);
  expect((await as("accountant").skipId(made.id)).status).toBe(200);
  return made;
}
/** Every audit_log, workflow_step, workflow_run and kyc_case row, as text per store. */
export async function storedText() {
  const dump = async (table: string) =>
    (
      await fixture.client.query<{ t: string }>(
        `SELECT coalesce(string_agg(row_to_json(x)::text, E'\\n'), '') AS t FROM ${table} x`,
      )
    ).rows[0]!.t;
  return {
    audit_log: await dump("audit_log"),
    workflow_step: await dump("workflow_step"),
    workflow_run: await dump("workflow_run"),
    kyc_case: await dump("kyc_case"),
  };
}
