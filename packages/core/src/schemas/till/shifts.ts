import * as v from "valibot";
import { add, money, mulRatio } from "@shopper/money";

/** Ghana cash faces in minor units (1 GHS = 10 000), GHS 200 down to the one-pesewa coin; GHS 2 and 1 are note or coin. */
export const DENOMINATIONS = [
  2_000_000, 1_000_000, 500_000, 200_000, 100_000, 50_000, 20_000, 10_000, 5_000, 2_000, 1_000, 500,
  100,
] as const;

const amount = v.pipe(v.number(), v.safeInteger(), v.minValue(0));

/** How many of each face are in the drawer, keyed by face; absent faces are zero. */
export const cashCounts = v.record(
  v.picklist(DENOMINATIONS.map(String)),
  v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(100_000)),
);
export type CashCounts = v.InferOutput<typeof cashCounts>;

/** Σ face × count. */
export const countedCash = (counts: CashCounts) =>
  Object.entries(counts).reduce(
    (sum, [face, count]) => add(sum, mulRatio(money(Number(face)), count, 1)),
    money(0),
  );

/** A float is an amount or a count by denomination, never both. */
export const openShiftInput = v.union([
  v.strictObject({ at: v.date(), float: amount }),
  v.strictObject({ at: v.date(), counts: cashCounts }),
]);

export const dropCashInput = v.strictObject({
  at: v.date(),
  amount: v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
  reason: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(200))),
});

export const noSaleInput = v.strictObject({
  at: v.date(),
  reason: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
});

export const shiftReportInput = v.strictObject({ at: v.date() });
