import * as v from "valibot";
import { eq } from "drizzle-orm";
import { reference, type TillDatabase, type TillSqlite } from "@shopper/db-sqlite";
import { snapshotLine } from "@shopper/tax";
import { tillPrice, tillProductBase, tillTaxRule } from "../schemas/till/reference";
import { TillError } from "./error";
import { readCashRounding } from "./settings";

type Price = v.InferOutput<typeof tillPrice>;
type Quote = { branchId: string; productId: string; quantityThousandths: number; at: Date };

/** The sale-line fields recordLocalSale stores (minus its id) for one product, priced and taxed at `at`. */
export function quoteLine(database: TillDatabase, input: Quote & { orgId: string }) {
  return database.read(async (tx) => quoteFrom(await readQuoteReference(tx, input.orgId), input));
}

/** Everything a quote needs, read once so a sale quotes many lines from one snapshot. */
export async function readQuoteReference(tx: TillSqlite, orgId: string) {
  const rows = await tx.select().from(reference).where(eq(reference.orgId, orgId));
  const payloads = <T>(entity: string, schema: v.GenericSchema<unknown, T>) =>
    rows.filter((row) => row.entity === entity).map((row) => v.parse(schema, row.payload));
  return {
    products: payloads("product", tillProductBase),
    prices: payloads("price", tillPrice),
    rules: payloads("tax-rule", tillTaxRule),
    cashRounding: readCashRounding(rows),
  };
}

export function quoteFrom(refs: Awaited<ReturnType<typeof readQuoteReference>>, input: Quote) {
  if (!Number.isSafeInteger(input.quantityThousandths) || input.quantityThousandths <= 0)
    throw new TillError(
      "QUANTITY_INVALID",
      "Quantity must be a positive whole number of thousandths",
    );
  const product = refs.products.find(
    (row) => row.id === input.productId && row.archivedAt === null,
  );
  if (!product) throw new TillError("PRODUCT_UNKNOWN", `Unknown product ${input.productId}`);
  const price = effectivePrice(refs.prices, input.branchId, product.id, input.at);
  if (!price) throw new TillError("PRICE_MISSING", `No effective price for product ${product.id}`);
  const on = ghanaDate(input.at);
  const rule = refs.rules
    .filter((row) => row.effectiveFrom <= on)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id.localeCompare(a.id))[0];
  if (!rule) throw new TillError("TAX_RULE_MISSING", `No tax rule effective on ${on}`);
  return {
    productId: product.id,
    priceId: price.id,
    sku: product.sku,
    name: product.name,
    baseUnit: product.baseUnit,
    tax: snapshotLine({
      rule,
      on,
      taxClass: product.taxClass,
      priceMode: "inclusive",
      unitPrice: price.amount,
      quantityThousandths: input.quantityThousandths,
    }),
  };
}

/** Branch price beats organisation price, then the latest validFrom; valid from inclusive to exclusive. */
export function effectivePrice(prices: Price[], branchId: string, productId: string, at: Date) {
  return prices
    .filter(
      (row) =>
        row.productId === productId &&
        (row.branchId === branchId || row.branchId === null) &&
        new Date(row.validFrom) <= at &&
        (row.validTo === null || new Date(row.validTo) > at),
    )
    .sort(
      (a, b) =>
        Number(b.branchId !== null) - Number(a.branchId !== null) ||
        new Date(b.validFrom).valueOf() - new Date(a.validFrom).valueOf() ||
        b.id.localeCompare(a.id),
    )[0];
}

const accra = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Accra",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const ghanaDate = (at: Date) => accra.format(at);
