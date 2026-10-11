// Shared helpers for the catalogue suites. Importing it also registers the auth tenants and sessions.
import { expect } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { verifyChain } from "@shopper/audit";
import { api, context, cookies, db, request } from "../auth/setup";

export { api, context, cookies, db, otherApi, request } from "../auth/setup";

let counter = 0;
export const unique = (prefix: string) => `${prefix}-${++counter}-${Date.now().toString(36)}`;
export const barcode = () =>
  `600${String(++counter).padStart(5, "0")}${Date.now() % 100000}`.padEnd(13, "0");

/** Call the API as one of the seeded roles (default super admin). */
export const call = (path: string, method = "GET", body?: unknown, role = "superadmin") =>
  request(api, cookies.get(role)!, path, method, body);

/** POST a body and return the created row, failing clearly when the route is missing or rejects it. */
export async function postOk(path: string, body: unknown) {
  const response = await call(path, "POST", body);
  expect(response.status, `POST ${path}`).toBe(201);
  return response.json();
}

export async function createProduct(extra: Record<string, unknown> = {}) {
  const response = await call("/products", "POST", {
    sku: unique("SKU"),
    name: unique("Product"),
    baseUnit: "each",
    taxClass: "standard",
    ...extra,
  });
  expect(response.status, "create product").toBe(201);
  return (await response.json()) as ProductDetail;
}

export type ProductDetail = {
  id: string;
  sku: string;
  name: string;
  baseUnit: string;
  taxClass: string;
  categoryId: string | null;
  supplierId: string | null;
  onlineVisible: boolean;
  archivedAt: string | null;
  barcodes: { code: string; quantityThousandths: number }[];
  prices: {
    id: string;
    branchId: string | null;
    amount: number;
    validFrom: string;
    validTo: string | null;
  }[];
};

export async function auditRowsFor(entityId: string) {
  const rows = await allAuditRows();
  return rows.filter((row) => row.entityId === entityId);
}

export const allAuditRows = () =>
  db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.orgId, context.orgId))
    .orderBy(schema.auditLog.chainSeq);

export async function expectChainValid() {
  expect(await verifyChain(await allAuditRows())).toMatchObject({ valid: true });
}
