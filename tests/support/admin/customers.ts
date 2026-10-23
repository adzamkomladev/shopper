// Customers for the portal specs, written through the real API as the E2E Mart owner on the saved session.
//   makeCustomer(request, patch)       -> a new individual (or the patched kind), with a phone no other customer has
//   settle(request, customer, ledger)  -> what they owe and the points they hold, written to the ledgers directly:
//                                         nothing in the API puts a balance on an account yet
// Names carry a tag that is new on every run, so a reused server never collides.
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { v7 } from "uuid";
import { E2E_DATABASE_URL } from "../../../tooling/database/e2e";
import { post, shopHeaders, unique } from "../admin";
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

/** `owed` in cedis (negative is a deposit) and `points` go straight onto the customer's ledgers. */
export async function settle(
  request: APIRequestContext,
  customer: Pick<CustomerRow, "id">,
  { owed = 0, points = 0 }: { owed?: number; points?: number },
) {
  const orgId = (await shopHeaders(request))["X-Shopper-Org"];
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    if (owed !== 0)
      await client.query(
        `INSERT INTO credit_entry (org_id, customer_id, kind, amount, method, occurred_at)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [
          orgId,
          customer.id,
          owed > 0 ? "charge" : "payment",
          Math.round(owed * 10_000),
          owed > 0 ? null : "cash",
        ],
      );
    if (points !== 0)
      await client.query(
        `INSERT INTO loyalty_entry (org_id, customer_id, reason, points, occurred_at)
         VALUES ($1, $2, $3, $4, now())`,
        [orgId, customer.id, points > 0 ? "earn" : "redeem", points],
      );
  } finally {
    await client.end();
  }
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
