import * as v from "valibot";
import { tillId } from "./fields";
import { cashCounts, countedCash, type CashCounts } from "./shifts";

const amount = v.pipe(v.number(), v.safeInteger());
const count = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const timestamp = v.pipe(v.string(), v.isoTimestamp());
const tender = v.picklist(["cash", "card", "momo"]);

const variance = v.strictObject({ tender, expected: amount, declared: amount, variance: amount });

/** The X report: a shift's takings so far, read while it is open; printing it closes nothing. */
export const xReport = v.strictObject({
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

/** The blind count of the drawer and the terminal totals typed in at close. */
const declared = { counts: cashCounts, cash: amount, card: amount, momo: amount };
const counted = (d: { counts: CashCounts; cash: number }) => d.cash === countedCash(d.counts);
export const declaration = v.pipe(
  v.strictObject(declared),
  v.check((d) => counted(d), "Declared cash must equal its counts"),
);

/** What `shift.declare` keeps on the shift: the count and the threshold it was judged against. */
export const storedDeclaration = v.pipe(
  v.strictObject({ ...declared, threshold: count }),
  v.check((d) => counted(d), "Declared cash must equal its counts"),
);

/** The Z report: the X at close, the count, the variance per tender and the audit chain head it closed on. */
export const zReport = v.strictObject({
  ...xReport.entries,
  kind: v.literal("z"),
  declared: declaration,
  variances: v.array(variance),
  threshold: count,
  approverId: v.nullable(tillId),
  closedAt: timestamp,
  closedBy: tillId,
  anchor: v.strictObject({ seq: count, hash: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)) }),
});

export const shiftReport = v.variant("kind", [xReport, zReport]);
export type ShiftReport = v.InferOutput<typeof shiftReport>;
export type XReport = v.InferOutput<typeof xReport>;
export type ZReport = v.InferOutput<typeof zReport>;
