import * as v from "valibot";
import { add, money, mulQty, mulRate, mulRatio, sub, type Money } from "@shopper/money";

const rate = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10_000));
export const taxClassSchema = v.picklist(["standard", "zero-rated", "exempt"]);
export type TaxClass = v.InferOutput<typeof taxClassSchema>;
export const dateSchema = v.pipe(
  v.string(),
  v.regex(/^\d{4}-\d{2}-\d{2}$/),
  v.check((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return (
      !value.startsWith("0000-") &&
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Expected a calendar date"),
);
export const taxRuleSchema = v.object({
  id: v.pipe(v.string(), v.uuid()),
  effectiveFrom: dateSchema,
  vatBps: rate,
  nhilBps: rate,
  getfundBps: rate,
  covidBps: rate,
});
export type TaxRule = v.InferOutput<typeof taxRuleSchema>;
export const ghana2026 = Object.freeze({
  effectiveFrom: "2026-01-01",
  vatBps: 1_500,
  nhilBps: 250,
  getfundBps: 250,
  covidBps: 0,
  source: "https://gra.gov.gh/news/portfolio/notice-to-all-vat-registered-taxpayers/",
});

export function snapshotLine(input: {
  rule: TaxRule;
  on: string;
  taxClass: TaxClass;
  priceMode: "inclusive" | "exclusive";
  unitPrice: Money;
  quantityThousandths: number;
  discount?: Money;
}) {
  const rule = v.parse(taxRuleSchema, input.rule);
  const on = v.parse(dateSchema, input.on);
  const taxClass = v.parse(taxClassSchema, input.taxClass);
  if (rule.effectiveFrom > on) throw new RangeError("Tax rule is not yet effective");
  v.parse(v.picklist(["inclusive", "exclusive"]), input.priceMode);
  v.parse(v.pipe(v.number(), v.safeInteger(), v.minValue(0)), input.quantityThousandths);
  const amount = mulQty(input.unitPrice, input.quantityThousandths);
  const discount = money(input.discount ?? 0);
  if (discount < 0 || discount > amount) throw new RangeError("Invalid line discount");
  const taxable = sub(amount, discount);
  const rates =
    taxClass === "standard" ? rule : { vatBps: 0, nhilBps: 0, getfundBps: 0, covidBps: 0 };
  const sum = rates.vatBps + rates.nhilBps + rates.getfundBps + rates.covidBps;
  const base = input.priceMode === "inclusive" ? mulRatio(taxable, 10_000, 10_000 + sum) : taxable;
  const vat = mulRate(base, rates.vatBps);
  const nhil = mulRate(base, rates.nhilBps);
  const getfund = mulRate(base, rates.getfundBps);
  const covid = mulRate(base, rates.covidBps);
  const calculatedGross = [vat, nhil, getfund, covid].reduce(add, base);
  const gross = input.priceMode === "inclusive" ? taxable : calculatedGross;
  return Object.freeze({
    rule: Object.freeze(rule),
    on,
    taxClass,
    priceMode: input.priceMode,
    quantityThousandths: input.quantityThousandths,
    unitPrice: input.unitPrice,
    discount,
    base,
    vat,
    nhil,
    getfund,
    covid,
    gross,
    roundingAdjustment: sub(gross, calculatedGross),
  });
}
export type TaxSnapshot = ReturnType<typeof snapshotLine>;
