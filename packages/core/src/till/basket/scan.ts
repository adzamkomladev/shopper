import * as v from "valibot";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { reference, type TillDatabase } from "@shopper/db-sqlite";
import { money, mulRatio, type Money } from "@shopper/money";
import { tillMapping, tillPrice, tillProductBase } from "../../schemas/till/reference";
import { TillError } from "../error";
import { lookupCode } from "../lookup/search";
import { effectivePrice } from "../quotation";
import type { ScanResult } from "../types";

type Mapping = v.InferOutput<typeof tillMapping>;
type Scan = { orgId: string; branchId: string; code: string; at: Date };

/**
 * Resolves a scanned code, read-only: an exact product barcode wins; otherwise a 13-digit embedded
 * label (EAN-13 checksum, configured prefix, exact product code) yields a weight or a price-derived quantity.
 */
export async function resolveScan(database: TillDatabase, input: Scan): Promise<ScanResult> {
  const exact = await lookupCode(database, input);
  if (exact)
    return {
      kind: "barcode",
      productId: exact.productId,
      quantityThousandths: exact.quantityThousandths ?? 1000,
    };
  const { code } = input;
  if (!/^2\d{12}$/.test(code)) throw unknown(code);
  if (!validChecksum(code))
    throw new TillError("CHECKSUM_INVALID", `Invalid EAN-13 checksum: ${code}`);
  const prefix = Number(code.slice(0, 2));
  const mapping = await database.read(async (tx) => {
    const rows = await tx
      .select()
      .from(reference)
      .where(and(eq(reference.orgId, input.orgId), eq(reference.entity, "barcode-mapping")));
    // ponytail: parses every mapping per scan; a tenant has a handful, cache if that changes.
    return rows.map((row) => v.parse(tillMapping, row.payload)).find((m) => m.prefix === prefix);
  });
  if (!mapping) throw new TillError("MAPPING_MISSING", `No barcode mapping for prefix ${prefix}`);
  const field = (s: Mapping["product"]) => code.slice(s.start, s.start + s.length);
  const product = await lookupCode(database, { orgId: input.orgId, code: field(mapping.product) });
  if (!product) throw unknown(field(mapping.product));
  const value = Number(field(mapping.value));
  return mapping.kind === "weight"
    ? {
        kind: "weight",
        productId: product.productId,
        quantityThousandths: await weight(database, input, product.productId, mapping, value),
      }
    : {
        kind: "price",
        productId: product.productId,
        ...(await price(database, input, product.productId, mapping, value)),
      };
}

const unknown = (code: string) => new TillError("PRODUCT_UNKNOWN", `Unknown product code ${code}`);

function validChecksum(code: string) {
  const sum = [...code.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

/** Parsed payloads of one entity kind for this tenant, narrowed in SQL by a payload field or the entity id. */
async function readRows<T>(
  database: TillDatabase,
  input: Scan,
  entity: string,
  schema: v.GenericSchema<unknown, T>,
  where: SQL,
) {
  return database.read(async (tx) =>
    (
      await tx
        .select()
        .from(reference)
        .where(and(eq(reference.orgId, input.orgId), eq(reference.entity, entity), where))
    ).map((row) => v.parse(schema, row.payload)),
  );
}

/** Label value in grams (or kg) over 10^decimals, as exact thousandths of the product's own kg/g unit. */
async function weight(
  database: TillDatabase,
  input: Scan,
  productId: string,
  m: Extract<Mapping, { kind: "weight" }>,
  value: number,
) {
  const product = (await readRows(database, input, "product", tillProductBase)).find(
    (p) => p.id === productId,
  );
  if (product?.baseUnit !== "kg" && product?.baseUnit !== "g")
    throw new TillError("UNIT_INVALID", `Product ${productId} is not sold by weight`);
  const numerator = BigInt(value) * (m.unit === "kg" ? 1000n : 1n) * 1000n;
  const denominator = 10n ** BigInt(m.decimals) * (product.baseUnit === "kg" ? 1000n : 1n);
  if (
    numerator === 0n ||
    numerator % denominator !== 0n ||
    numerator / denominator > BigInt(Number.MAX_SAFE_INTEGER)
  )
    throw new TillError("QUANTITY_INVALID", `Weight ${value} is not an exact positive quantity`);
  return Number(numerator / denominator);
}

/** The encoded gross is authoritative; quantity is gross / effective unit price, rounded half-up. */
async function price(
  database: TillDatabase,
  input: Scan,
  productId: string,
  m: Mapping,
  value: number,
) {
  if (value === 0) throw new TillError("AMOUNT_INVALID", "Price label carries a zero amount");
  const unit = effectivePrice(
    await readRows(
      database,
      input,
      "price",
      tillPrice,
      sql`json_extract(${reference.payload}, '$.productId') = ${productId}`,
    ),
    input.branchId,
    productId,
    input.at,
  );
  if (!unit || unit.amount <= 0)
    throw new TillError("PRICE_MISSING", `No positive price for product ${productId}`);
  try {
    const gross = mulRatio(money(value), 10 ** (4 - m.decimals), 1);
    const quantityThousandths = mulRatio(gross, 1000, unit.amount);
    if (quantityThousandths <= 0) throw new RangeError();
    return { quantityThousandths, gross };
  } catch {
    throw new TillError("QUANTITY_INVALID", `Price label ${value} gives no valid quantity`);
  }
}
