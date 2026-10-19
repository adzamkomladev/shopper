import * as v from "valibot";
import { tillId } from "./fields";

const amount = v.pipe(v.number(), v.safeInteger());
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const timestamp = v.pipe(v.string(), v.isoTimestamp());
const tender = v.picklist(["cash", "card", "momo"]);

/** The X report: a shift's takings so far, read while it is open; printing it closes nothing. */
export const shiftReport = v.strictObject({
  kind: v.literal("x"),
  shiftId: tillId,
  storeId: tillId,
  branchId: tillId,
  deviceId: tillId,
  /** From the saved register settings; null while the register runs on its enrolled identity. */
  registerName: v.nullable(v.string()),
  openedAt: timestamp,
  openedBy: tillId,
  at: timestamp,
  sales: v.strictObject({ count, gross: amount, tax: amount }),
  refunds: v.strictObject({ count, total: amount }),
  tenders: v.array(v.strictObject({ tender, sales: amount, refunds: amount, expected: amount })),
  cash: v.strictObject({
    float: amount,
    sales: amount,
    refunds: amount,
    drops: amount,
    expected: amount,
  }),
  movements: v.array(
    v.strictObject({
      kind: v.picklist(["drop", "no_sale"]),
      amount,
      reason: v.nullable(v.string()),
      actorId: tillId,
      at: timestamp,
    }),
  ),
  cashiers: v.array(v.strictObject({ userId: tillId, name: v.nullable(v.string()) })),
});
export type ShiftReport = v.InferOutput<typeof shiftReport>;
