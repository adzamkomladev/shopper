// Helpers for the basket suites (quotation, scan): a seeded till SQLite file, barcode-mapping reference rows
// and EAN-13 label builders. Mapping rows are written as the pull worker stores them (entity 'barcode-mapping').
import { expect } from "vite-plus/test";
import { v7 } from "uuid";
import { openTillDatabase } from "@shopper/adapters-box/till";
import { provisionTillReference, resolveScan } from "@shopper/core/till";
import {
  hostSession,
  localSale,
  outbox,
  reference,
  saleLine,
  tillAudit,
  tillState,
} from "@shopper/db-sqlite";
import type { TillDatabase } from "@shopper/db-sqlite";
import { context, ids, references, withDatabase } from "./sales";

export { config, context, goldenSale, ids, references, session } from "./sales";
export const at = new Date("2025-12-31T23:30:00.000Z");

type Unit = "each" | "kg" | "g" | "l" | "ml";
type TaxClass = "standard" | "zero-rated" | "exempt";
export const refProduct = (
  over: Partial<{
    id: string;
    sku: string;
    baseUnit: Unit;
    taxClass: TaxClass;
    archivedAt: string | null;
    barcodes: { code: string; quantityThousandths: number }[];
  }> = {},
) => ({
  id: v7(),
  orgId: ids.org,
  sku: `SKU-${v7().slice(-6)}`,
  name: "Scan product",
  baseUnit: "each" as Unit,
  taxClass: "standard" as TaxClass,
  archivedAt: null as string | null,
  barcodes: [] as { code: string; quantityThousandths: number }[],
  ...over,
});
export const refPrice = (
  productId: string,
  amount: number,
  over: { branchId?: string | null; validFrom?: string; validTo?: string | null } = {},
) => ({
  id: v7(),
  orgId: ids.org,
  productId,
  branchId: null as string | null,
  amount,
  validFrom: "2020-01-01T00:00:00.000Z",
  validTo: null as string | null,
  ...over,
});

export type Layout = {
  prefix: number;
  product: { start: number; length: number };
  value: { start: number; length: number };
  kind: "weight" | "price";
  unit?: "g" | "kg";
  decimals: number;
};
/** Default layout: prefix at digits 0-1, five product digits, five value digits, check digit last. */
export const layout = (over: Partial<Layout> = {}): Layout => ({
  prefix: 21,
  product: { start: 2, length: 5 },
  value: { start: 7, length: 5 },
  kind: "weight",
  unit: "g",
  decimals: 0,
  ...over,
});

type Seed = {
  products?: ReturnType<typeof refProduct>[];
  prices?: ReturnType<typeof refPrice>[];
  taxRules?: typeof references.taxRules;
  mappings?: Layout[];
};
/** Provisions explicit reference rows (golden tax rules by default) plus barcode-mapping reference rows. */
export async function seed(db: TillDatabase, data: Seed = {}) {
  await provisionTillReference(db, context, {
    products: data.products ?? [],
    prices: data.prices ?? [],
    taxRules: data.taxRules ?? references.taxRules,
  });
  await db.transaction(async (tx) => {
    for (const mapping of data.mappings ?? []) {
      const id = v7();
      await tx
        .insert(reference)
        .values({ id, orgId: ids.org, entity: "barcode-mapping", payload: { id, ...mapping } });
    }
  });
}

export const withTill = <T>(run: (db: TillDatabase) => Promise<T>) =>
  withDatabase(async (path) => {
    const db = openTillDatabase(path);
    try {
      return await run(db);
    } finally {
      await db.close();
    }
  });

/** Row counts of every table a read-only operation must leave alone. */
export const tableCounts = (db: TillDatabase) =>
  db.read(async (tx) => ({
    sales: (await tx.select().from(localSale)).length,
    lines: (await tx.select().from(saleLine)).length,
    outbox: (await tx.select().from(outbox)).length,
    audit: (await tx.select().from(tillAudit)).length,
    state: (await tx.select().from(tillState)).length,
    sessions: (await tx.select().from(hostSession)).length,
    reference: (await tx.select().from(reference)).length,
  }));

export function ean13(body: string) {
  const sum = [...body].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}
/** A default-layout embedded label: 2-digit prefix, 5 product digits, 5 value digits, check digit. */
export const label = (prefix: number, product: string, value: string) =>
  ean13(`${prefix}${product}${value}`);

/** resolveScan as the till calls it: golden tenant and branch, fixed clock. */
export const scan = (db: TillDatabase, code: string) =>
  resolveScan(db, { orgId: ids.org, branchId: ids.branch, code, at });
/** Matcher for a TillError with this code (and, optionally, a message pattern). */
export const fails = (code: string, message?: RegExp) => ({
  name: "TillError",
  code,
  ...(message ? { message: expect.stringMatching(message) } : {}),
});
export const bareCode = "5012345678900";
