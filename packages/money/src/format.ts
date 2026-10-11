import { divide, fromBigInt, money } from "./arithmetic";
import type { Money } from "./schemas/money";

export const MONEY_SCALE = 10_000;
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
