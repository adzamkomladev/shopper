// Customers for the portal specs, written through the real API as the E2E Mart owner on the saved session.
//   makeCustomer(request, patch)       -> a new individual (or the patched kind), with a phone no other customer has
//   settle(request, customer, ledger)  -> what they owe and the points they hold: a deposit is a real payment through
//                                         the API; a debt and earned points go onto the ledgers directly, because
//                                         only a sale creates either
//   owedSince(request, customer, ...)  -> a debt dated some days back, for the ageing buckets
//   verify(request, customer, limit)   -> identity verified with a credit limit in cedis, written directly: the KYC
//                                         flow needs an OTP, and a limit needs the verification
//   enableLoyalty(request)             -> loyalty switched on for the shop through the settings API
// Names carry a tag that is new on every run, so a reused server never collides.
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { v7 } from "uuid";
import { E2E_DATABASE_URL } from "../../../tooling/database/e2e";
import { post, shopHeaders, unique } from "../admin";
import { BOX_API } from "../e2e";
import { createStaff, type Staff } from "./people";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  kind: "individual" | "business";
  businessName: string | null;
  tin: string | null;
  email: string | null;
  creditLimit: number;
  version: number;
  kycVerifiedAt: string | null;
  lastVisitAt: string | null;
  archivedAt: string | null;
  mergedIntoId: string | null;
  balance: number;
  points: number;
};
type Patch = Partial<
  Pick<CustomerRow, "name" | "phone" | "kind" | "businessName" | "tin" | "email">
>;

/** A Ghana mobile number that is new on every call. */
export const uniquePhone = () => `05${Math.floor(Math.random() * 1e8)}`.padEnd(10, "0");

export const makeCustomer = (request: APIRequestContext, patch: Patch = {}) =>
  post<CustomerRow>(request, "/customers", {
    id: v7(),
    name: `Ama Mensah ${unique()}`,
    phone: uniquePhone(),
    kind: "individual",
    ...patch,
  });

const units = (cedis: number) => Math.round(cedis * 10_000);

async function withDatabase(
  request: APIRequestContext,
  run: (client: Client, orgId: string) => Promise<unknown>,
) {
  const orgId = (await shopHeaders(request))["X-Shopper-Org"]!;
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    await run(client, orgId);
  } finally {
    await client.end();
  }
}

/** `owed` in cedis (negative is a deposit) and `points` go onto the customer's ledgers. */
export async function settle(
  request: APIRequestContext,
  customer: Pick<CustomerRow, "id">,
  { owed = 0, points = 0 }: { owed?: number; points?: number },
) {
  if (owed < 0)
    await post(request, `/customers/${customer.id}/payments`, {
      id: v7(),
      amount: units(-owed),
      method: "cash",
    });
  if (owed > 0) await owedSince(request, customer, owed, 0);
  if (points !== 0)
    await withDatabase(request, (client, orgId) =>
      client.query(
        `INSERT INTO loyalty_entry (org_id, customer_id, reason, points, occurred_at)
         VALUES ($1, $2, $3, $4, now())`,
        [orgId, customer.id, points > 0 ? "earn" : "redeem", points],
      ),
    );
}

/** A debt of `owed` cedis charged `days` days ago. */
export const owedSince = (
  request: APIRequestContext,
  customer: Pick<CustomerRow, "id">,
  owed: number,
  days: number,
) =>
  withDatabase(request, (client, orgId) =>
    client.query(
      `INSERT INTO credit_entry (org_id, customer_id, kind, amount, occurred_at)
       VALUES ($1, $2, 'charge', $3, now() - make_interval(days => $4))`,
      [orgId, customer.id, units(owed), days],
    ),
  );

/** The identity is verified and `limit` cedis may be owed on account. */
export const verify = (request: APIRequestContext, customer: Pick<CustomerRow, "id">, limit = 0) =>
  withDatabase(request, (client, orgId) =>
    client.query(
      `UPDATE customer SET kyc_verified_at = now(), credit_limit = $3 WHERE org_id = $1 AND id = $2`,
      [orgId, customer.id, units(limit)],
    ),
  );

export async function enableLoyalty(request: APIRequestContext) {
  const response = await request.put(`${BOX_API}/settings/loyalty`, {
    headers: await shopHeaders(request),
    data: { enabled: true, earnBps: 100, pointValue: 100, expiryDays: 0, tierNoticeDays: 14 },
  });
  expect(response.status(), await response.text()).toBe(200);
}

const members = new Map<string, Promise<Staff>>();
/** The accountant can read and manage but not edit; the cashier can read and edit but not manage; inventory has neither. */
export function customerMember(
  request: APIRequestContext,
  role: "accountant" | "cashier" | "inventory",
) {
  const found = members.get(role);
  if (found) return found;
  const made = createStaff(
    request,
    role,
    role === "cashier" ? "Abena" : role === "inventory" ? "Kwame" : "Esi",
  );
  members.set(role, made);
  return made;
}

export const customersTable = (page: Page) => page.getByRole("region", { name: "Customers" });
export const segment = (page: Page, name: string) => page.getByRole("tab", { name, exact: true });

/** The Customers page, signed in as the saved owner, with the search field ready. */
export async function openCustomers(page: Page, query = "") {
  await page.goto(`/customers${query}`);
  await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
}

/** A customer's own page, once its name is showing. */
export async function openCustomer(page: Page, customer: Pick<CustomerRow, "id" | "name">) {
  await page.goto(`/customers/${customer.id}`);
  await expect(page.getByRole("heading", { name: customer.name, level: 1 })).toBeVisible();
}
