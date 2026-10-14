import { priceModeSchema, quantitySchema } from "./schemas/snapshot";

export type { TaxSnapshot } from "./types";
import * as v from "valibot";
import { add, money, mulQty, mulRate, mulRatio, sub, type Money } from "@shopper/money";
import {
  dateSchema,
  taxClassSchema,
  taxRuleSchema,
  type TaxClass,
  type TaxRule,
} from "./schemas/tax/rule";

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
  v.parse(priceModeSchema, input.priceMode);
  v.parse(quantitySchema, input.quantityThousandths);
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
