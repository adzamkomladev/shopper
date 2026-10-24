import { priceModeSchema, quantitySchema, registeredSchema } from "./schemas/snapshot";

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

type Input = {
  rule: TaxRule;
  on: string;
  taxClass: TaxClass;
  priceMode: "inclusive" | "exclusive";
  /** Whether the seller was VAT-registered on `on`; an unregistered seller charges no VAT or levies. */
  registered: boolean;
  unitPrice: Money;
  quantityThousandths: number;
};

export function snapshotLine(input: Input & { discount?: Money }) {
  const amount = mulQty(input.unitPrice, input.quantityThousandths);
  const discount = money(input.discount ?? 0);
  if (discount < 0 || discount > amount) throw new RangeError("Invalid line discount");
  const taxable = sub(amount, discount);
  if (input.priceMode === "inclusive")
    return Object.freeze({ ...snapshotAmount({ ...input, gross: taxable }), discount });
  return breakdown(input, taxable, discount);
}

/** Tax breakdown extracted from an authoritative inclusive gross; unit price and quantity are recorded as given. */
export function snapshotAmount(input: Input & { gross: Money }) {
  if (input.priceMode !== "inclusive")
    throw new RangeError("Only inclusive amounts can be extracted");
  const gross = money(input.gross);
  if (gross < 0) throw new RangeError("Gross must not be negative");
  const unitPrice = money(input.unitPrice);
  if (unitPrice < 0) throw new RangeError("Unit price must not be negative");
  return breakdown({ ...input, unitPrice }, gross, money(0));
}

function breakdown(input: Input, taxable: Money, discount: Money) {
  const rule = v.parse(taxRuleSchema, input.rule);
  const on = v.parse(dateSchema, input.on);
  const taxClass = v.parse(taxClassSchema, input.taxClass);
  if (rule.effectiveFrom > on) throw new RangeError("Tax rule is not yet effective");
  v.parse(priceModeSchema, input.priceMode);
  v.parse(quantitySchema, input.quantityThousandths);
  const registered = v.parse(registeredSchema, input.registered);
  const rates =
    taxClass === "standard" && registered
      ? rule
      : { vatBps: 0, nhilBps: 0, getfundBps: 0, covidBps: 0 };
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
    registered,
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
