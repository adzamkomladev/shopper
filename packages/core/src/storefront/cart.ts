import * as v from "valibot";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import {
  branchFulfilment,
  cataloguePublic,
  org,
  price,
  product,
  taxClass,
  taxRule,
} from "@shopper/db-pg";
import { add, money, type Money } from "@shopper/money";
import { snapshotAmount, type TaxSnapshot } from "@shopper/tax";
import { priceUpsert, productUpsert, taxRulePayload } from "../changes/project";
import { cartQuery } from "../schemas/storefront/cart";
import { tillOrgSetting, tillPrice, tillProductBase, tillTaxRule } from "../schemas/till/reference";
import { availableOf } from "../stock/onhand";
import { TillError } from "../till/error";
import { ghanaDate, quoteFrom } from "../till/quotation";
import type { Queryable } from "../types";
import { storeBranch } from "./catalogue";

/**
 * Prices a basket exactly as a till at the branch would at `now`: the till's own `quoteFrom` over the rows a till's
 * snapshot carries. A line the store cannot sell (hidden, unpriced) or cannot sell that much of comes back with its
 * `problem` and stays out of the totals. Delivery adds the branch's flat fee as a standard-rated line.
 */
export async function quoteCart(db: Queryable, orgId: string, raw: unknown, now = new Date()) {
  const input = v.parse(cartQuery, raw);
  const site = await storeBranch(db, orgId, input.branch);
  const refs = await cartReference(
    db,
    orgId,
    site.id,
    input.lines.map((line) => line.productId),
    now,
  );
  const lines = input.lines.map((line) => {
    const listed = refs.listed.get(line.productId);
    const shown = {
      productId: line.productId,
      quantityThousandths: line.quantityThousandths,
      name: listed?.name ?? null,
      sku: listed?.sku ?? null,
      baseUnit: listed?.baseUnit ?? null,
      imageAssetId: listed?.imageAssetId ?? null,
      availableThousandths: Math.max(0, listed?.available ?? 0),
    };
    const quote = listed ? quoteOrNull(refs, site.id, line, now) : null;
    if (!quote) return { ...shown, priceId: null, tax: null, problem: "unavailable" as const };
    const problem =
      shown.availableThousandths < line.quantityThousandths ? ("short" as const) : null;
    return { ...shown, priceId: quote.priceId, tax: quote.tax, problem };
  });
  const delivery =
    input.fulfilment === "delivery" && refs.fulfilment?.delivery
      ? deliveryLine(refs, refs.fulfilment.deliveryFee, now)
      : null;
  const sold = lines.flatMap((line) => (line.problem === null && line.tax ? [line.tax] : []));
  return {
    branch: site,
    lines,
    delivery,
    totals: totalOf([...sold, ...(delivery ? [delivery] : [])]),
    count: sold.length,
  };
}

/** Everything one basket's quote reads, in the shapes a till's reference holds (`schemas/till/reference.ts`). */
async function cartReference(
  db: Queryable,
  orgId: string,
  branchId: string,
  productIds: string[],
  now: Date,
) {
  const ids = [...new Set(productIds)];
  const rows = await db
    .select({
      id: cataloguePublic.productId,
      sku: cataloguePublic.sku,
      name: cataloguePublic.name,
      baseUnit: cataloguePublic.baseUnit,
      imageAssetId: cataloguePublic.imageAssetId,
      taxClass: taxClass.code,
      finalSale: product.finalSale,
      available: availableOf(orgId, branchId, cataloguePublic.productId, now),
    })
    .from(cataloguePublic)
    .innerJoin(
      product,
      and(eq(product.orgId, cataloguePublic.orgId), eq(product.id, cataloguePublic.productId)),
    )
    .innerJoin(
      taxClass,
      and(eq(taxClass.orgId, product.orgId), eq(taxClass.id, product.taxClassId)),
    )
    .where(and(eq(cataloguePublic.orgId, orgId), inArray(cataloguePublic.productId, ids)));
  const prices = await db
    .select()
    .from(price)
    .where(
      and(
        eq(price.orgId, orgId),
        inArray(price.productId, ids),
        or(isNull(price.branchId), eq(price.branchId, branchId)),
      ),
    );
  const rules = await db.select().from(taxRule).where(eq(taxRule.orgId, orgId));
  const [settings] = await db
    .select({
      cashRounding: org.cashRounding,
      priceMode: org.priceMode,
      vatRegisteredFrom: org.vatRegisteredFrom,
      tin: org.tin,
    })
    .from(org)
    .where(eq(org.id, orgId));
  const [fulfilment] = await db
    .select()
    .from(branchFulfilment)
    .where(and(eq(branchFulfilment.orgId, orgId), eq(branchFulfilment.branchId, branchId)));
  const setting = v.parse(tillOrgSetting, { id: orgId, ...settings });
  return {
    listed: new Map(rows.map((row) => [row.id, row])),
    fulfilment,
    products: rows.map((row) =>
      v.parse(
        tillProductBase,
        productUpsert(orgId, { ...row, archivedAt: null, barcodes: [] }).payload,
      ),
    ),
    prices: prices.map((row) => v.parse(tillPrice, priceUpsert(row).payload)),
    rules: rules.map((row) => v.parse(tillTaxRule, taxRulePayload(row))),
    cashRounding: setting.cashRounding,
    priceMode: setting.priceMode,
    vatRegisteredFrom: setting.vatRegisteredFrom,
    tin: setting.tin,
  };
}

type References = Awaited<ReturnType<typeof cartReference>>;

/** The till's quote for one line, or null where the till could not sell it (no price, no tax rule). */
function quoteOrNull(
  refs: References,
  branchId: string,
  line: { productId: string; quantityThousandths: number },
  at: Date,
) {
  try {
    return quoteFrom(refs, { branchId, at, ...line });
  } catch (error) {
    if (error instanceof TillError) return null;
    throw error;
  }
}

/** The delivery fee is what the customer pays, so its tax is extracted from it, as on a standard-rated sale. */
function deliveryLine(refs: References, fee: Money, at: Date) {
  const on = ghanaDate(at);
  const rule = refs.rules
    .filter((row) => row.effectiveFrom <= on)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.id.localeCompare(a.id))[0];
  if (!rule) throw new TillError("TAX_RULE_MISSING", `No tax rule effective on ${on}`);
  return snapshotAmount({
    rule,
    on,
    taxClass: "standard",
    priceMode: "inclusive",
    registered: refs.vatRegisteredFrom !== null && refs.vatRegisteredFrom <= on,
    unitPrice: fee,
    quantityThousandths: 1_000,
    gross: fee,
  });
}

const totalKeys = [
  "base",
  "vat",
  "nhil",
  "getfund",
  "covid",
  "gross",
  "roundingAdjustment",
] as const;

/** Line snapshots summed key by key, as the till sums a sale's lines. */
function totalOf(lines: Pick<TaxSnapshot, (typeof totalKeys)[number]>[]) {
  return Object.fromEntries(
    totalKeys.map((key) => [key, lines.reduce((sum, line) => add(sum, line[key]), money(0))]),
  ) as Record<(typeof totalKeys)[number], Money>;
}
