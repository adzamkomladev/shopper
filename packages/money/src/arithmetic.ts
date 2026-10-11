import * as v from "valibot";
import { integer, moneySchema, type Money } from "./schemas/money";

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
export function divide(value: bigint, denominator: bigint): bigint {
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
