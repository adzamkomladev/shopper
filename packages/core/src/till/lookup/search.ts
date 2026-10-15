import { sql } from "drizzle-orm";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { CatalogueMatch } from "./types";

const MAX_ROWS = 50;

type Row = { product_id: string; sku: string; name: string; code?: string; quantity?: number };

const toMatch = (row: Row, match: CatalogueMatch["match"]): CatalogueMatch => ({
  productId: row.product_id,
  sku: row.sku,
  name: row.name,
  match,
  ...(row.code === undefined ? {} : { barcode: row.code, quantityThousandths: row.quantity }),
});

/** Exact barcode, then exact SKU, then FTS5 name matches ordered by name and id; at most 50 rows. */
export async function searchCatalogue(
  database: TillDatabase,
  input: { orgId: string; query: string; limit?: number },
): Promise<CatalogueMatch[]> {
  const query = input.query.trim();
  const limit = Math.max(1, Math.min(input.limit ?? MAX_ROWS, MAX_ROWS));
  const fts = ftsQuery(query);
  return database.read(async (tx) => {
    const found = new Map<string, CatalogueMatch>();
    const add = (rows: Row[], match: CatalogueMatch["match"]) => {
      for (const row of rows)
        if (!found.has(row.product_id)) found.set(row.product_id, toMatch(row, match));
    };
    if (query) {
      add(await barcodeRows(tx, input.orgId, query), "barcode");
      add(
        await tx.all<Row>(
          sql`SELECT product_id, sku, name FROM product_lookup
            WHERE org_id = ${input.orgId} AND sku = ${query} ORDER BY name, product_id LIMIT ${limit}`,
        ),
        "sku",
      );
    }
    if (fts)
      add(
        await tx.all<Row>(
          sql`SELECT p.product_id, p.sku, p.name FROM product_search s
            JOIN product_lookup p ON p.rowid = s.rowid
            WHERE product_search MATCH ${fts} AND p.org_id = ${input.orgId}
            ORDER BY p.name, p.product_id LIMIT ${limit}`,
        ),
        "name",
      );
    return [...found.values()].slice(0, limit);
  });
}

/** Exact barcode lookup only: no SKU, no name. */
export async function lookupCode(database: TillDatabase, input: { orgId: string; code: string }) {
  if (!input.code) return undefined;
  const [row] = await database.read((tx) => barcodeRows(tx, input.orgId, input.code));
  return row && toMatch(row, "barcode");
}

const barcodeRows = (
  tx: Parameters<Parameters<TillDatabase["read"]>[0]>[0],
  orgId: string,
  code: string,
) =>
  tx.all<Row>(
    sql`SELECT p.product_id, p.sku, p.name, b.code, b.quantity_thousandths AS quantity
      FROM product_barcode b JOIN product_lookup p ON p.org_id = b.org_id AND p.product_id = b.product_id
      WHERE b.org_id = ${orgId} AND b.code = ${code}`,
  );

/** Every whitespace token becomes a quoted literal, so FTS operators are plain text; the last one is a prefix. */
function ftsQuery(query: string) {
  const tokens = query.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
  return tokens
    .map((token, i) => `"${token.replaceAll('"', '""')}"${i === tokens.length - 1 ? "*" : ""}`)
    .join(" ");
}
