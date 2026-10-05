import * as v from "valibot";

export const MONEY_SCALE = 10_000;
const integer = v.pipe(v.number(), v.safeInteger());
const moneySchema = v.pipe(integer, v.brand("Money"));
export type Money = v.InferOutput<typeof moneySchema>;
export function money(value: number): Money {
  return v.parse(moneySchema, value);
}
export function fromBigInt(value: bigint): Money {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError("Money exceeds the safe integer range");
  }
  return money(Number(value));
}
// Half-up on the magnitude: refunds mirror positive amounts, including ties.
function divide(value: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new RangeError("Denominator must be positive");
  const magnitude = value < 0n ? -value : value;
  const rounded = (magnitude + denominator / 2n) / denominator;
  return value < 0n ? -rounded : rounded;
}
export function add(a: Money, b: Money): Money {
  return fromBigInt(BigInt(money(a)) + BigInt(money(b)));
}
export function sub(a: Money, b: Money): Money {
  return fromBigInt(BigInt(money(a)) - BigInt(money(b)));
}
export function mulRatio(amount: Money, numerator: number, denominator: number): Money {
  v.parse(integer, numerator);
  v.parse(integer, denominator);
  return fromBigInt(divide(BigInt(money(amount)) * BigInt(numerator), BigInt(denominator)));
}
export function mulQty(amount: Money, thousandths: number): Money {
  return mulRatio(amount, thousandths, 1_000);
}
export function mulRate(amount: Money, basisPoints: number): Money {
  return mulRatio(amount, basisPoints, 10_000);
}
export function fromDecimal(value: string): Money {
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(value))
    throw new TypeError("Expected a decimal with at most 4 places");
  const negative = value.startsWith("-");
  const [whole, fraction = ""] = (negative ? value.slice(1) : value).split(".");
  const amount = BigInt(whole!) * BigInt(MONEY_SCALE) + BigInt(fraction.padEnd(4, "0"));
  return fromBigInt(negative ? -amount : amount);
}
export function toPesewas(amount: Money): number {
  return Number(divide(BigInt(money(amount)), 100n));
}
export function toDecimal(amount: Money, places: 2 | 4 = 2): string {
  if (places !== 2 && places !== 4) throw new RangeError("Supported precision: 2 or 4");
  const units = divide(BigInt(money(amount)), places === 2 ? 100n : 1n);
  const magnitude = units < 0n ? -units : units;
  const scale = places === 2 ? 100n : 10_000n;
  return `${units < 0n ? "-" : ""}${magnitude / scale}.${String(magnitude % scale).padStart(places, "0")}`;
}
export function formatGHS(amount: Money): string {
  const [whole, fraction] = toDecimal(amount).split(".");
  return `GH₵ ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
