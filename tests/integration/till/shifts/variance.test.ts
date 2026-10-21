// The variance of a tender is declared - expected, signed (negative = short). approvalRequired is true when any
// |variance| is strictly over the register's varianceThreshold (default 50 000 = GHS 5, set with register settings).
// closeShift without approverId then fails with APPROVAL_REQUIRED and leaves the shift declared; the approverId is a
// manager the host verified (shift.approve), stored on the shift, the audit row and the Z.
//   sellSome (support/till/close.ts): expected cash 2 000 000 + 36 000 = 2 036 000, card 24 000, MoMo 0
//   declared cash 2 033 000 (GHS 200 + 3 x GHS 1 + 3 x GHS 0.10): short 3 000; card 34 000: over 10 000
import { expect, test } from "vite-plus/test";
import {
  closeNow,
  declareCash,
  declareNow,
  denominate,
  sellSome,
  theShift,
} from "../../../support/till/close";
import { auditRows, ids, fails, withTill, world } from "../../../support/till/drafts";
import { manager } from "../../../support/till/approvers";
import { saveSettings } from "../../../support/till/refunds";

const float = 2_000_000;
const threshold = 50_000;

test("Declared vs expected variance computed correctly per tender", async () => {
  await withTill(async (db) => {
    await world(db);
    await sellSome(db);
    const result = await declareNow(db, { counts: denominate(2_033_000), card: 34_000, momo: 0 });
    const variances = [
      { tender: "cash", expected: 2_036_000, declared: 2_033_000, variance: -3_000 },
      { tender: "card", expected: 24_000, declared: 34_000, variance: 10_000 },
      { tender: "momo", expected: 0, declared: 0, variance: 0 },
    ];
    expect(result).toMatchObject({ variances, threshold, approvalRequired: false });
    expect(await theShift(db)).toMatchObject({
      status: "declared",
      declaration: { counts: denominate(2_033_000), cash: 2_033_000, card: 34_000, momo: 0 },
    });
    expect(await closeNow(db)).toMatchObject({ kind: "z", variances, approverId: null });
  });
});

test("a MoMo total typed in against no MoMo sales is a positive variance", async () => {
  await withTill(async (db) => {
    await world(db);
    const result = await declareCash(db, float, { momo: 7_000 });
    expect(result.variances).toEqual([
      { tender: "cash", expected: float, declared: float, variance: 0 },
      { tender: "card", expected: 0, declared: 0, variance: 0 },
      { tender: "momo", expected: 0, declared: 7_000, variance: 7_000 },
    ]);
  });
});

test("an empty drawer counted as {} is the whole float short", async () => {
  await withTill(async (db) => {
    await world(db);
    const result = await declareNow(db);
    expect(result.variances[0]).toEqual({
      tender: "cash",
      expected: float,
      declared: 0,
      variance: -float,
    });
    expect(result.approvalRequired).toBe(true);
  });
});

test.each([
  ["cash short", (n: number) => ({ counts: denominate(float - n) })],
  ["cash over", (n: number) => ({ counts: denominate(float + n) })],
  ["card over", (n: number) => ({ counts: denominate(float), card: n })],
  ["MoMo over", (n: number) => ({ counts: denominate(float), momo: n })],
])("%s by exactly the threshold closes alone", async (_name, declare) => {
  await withTill(async (db) => {
    await world(db);
    expect(await declareNow(db, declare(threshold))).toMatchObject({ approvalRequired: false });
    expect(await closeNow(db)).toMatchObject({ kind: "z", approverId: null });
    expect(await theShift(db)).toMatchObject({ status: "closed", approverId: null });
  });
});

test.each([
  ["cash short", (n: number) => ({ counts: denominate(float - n) })],
  ["cash over", (n: number) => ({ counts: denominate(float + n) })],
  ["card over", (n: number) => ({ counts: denominate(float), card: n })],
  ["MoMo over", (n: number) => ({ counts: denominate(float), momo: n })],
])(
  "%s by one pesewa over the threshold needs an approver and the shift stays declared",
  async (_name, declare) => {
    await withTill(async (db) => {
      await world(db);
      expect(await declareNow(db, declare(threshold + 100))).toMatchObject({
        approvalRequired: true,
      });
      const before = await auditRows(db);
      await expect(closeNow(db)).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
      expect(await theShift(db)).toMatchObject({
        status: "declared",
        closedAt: null,
        closedBy: null,
        approverId: null,
        report: null,
        anchorSeq: null,
        anchorHash: null,
      });
      expect(await auditRows(db)).toEqual(before);
    });
  },
);

test("with an approver the shift closes and records who approved it on the shift, the Z and the audit row", async () => {
  await withTill(async (db) => {
    await world(db);
    await declareCash(db, float - threshold - 100);
    const z = await closeNow(db, { approverId: manager });
    expect(z).toMatchObject({ approverId: manager, closedBy: ids.cashier });
    expect(await theShift(db)).toMatchObject({ status: "closed", approverId: manager, report: z });
    const row = (await auditRows(db)).find((entry) => entry.command === "shift.close");
    expect(row).toMatchObject({ actorId: ids.cashier, approverId: manager });
  });
});

test("a close within the threshold with an approver also records the approver", async () => {
  await withTill(async (db) => {
    await world(db);
    await declareCash(db, float);
    expect(await closeNow(db, { approverId: manager })).toMatchObject({ approverId: manager });
  });
});

test.each([
  ["a lowered threshold", 10_000, 10_000, 10_100],
  ["a raised threshold", 200_000, 200_000, 200_100],
  ["a threshold of zero", 0, 0, 100],
])(
  "%s is honoured: exactly at it closes alone, a pesewa over needs approval",
  async (_name, setting, atLimit, over) => {
    await withTill(async (db) => {
      await world(db);
      await saveSettings(db, { varianceThreshold: setting });
      const near = await declareCash(db, float - atLimit);
      expect(near).toMatchObject({ threshold: setting, approvalRequired: false });
      await closeNow(db);
    });
    await withTill(async (db) => {
      await world(db);
      await saveSettings(db, { varianceThreshold: setting });
      expect(await declareCash(db, float - over)).toMatchObject({
        threshold: setting,
        approvalRequired: true,
      });
      await expect(closeNow(db)).rejects.toMatchObject(fails("APPROVAL_REQUIRED"));
    });
  },
);

test.each([-1, 10_000_001, 1.5])("a varianceThreshold of %s is refused", async (value) => {
  await withTill(async (db) => {
    await world(db);
    await expect(saveSettings(db, { varianceThreshold: value })).rejects.toThrow();
  });
});

test("the Z carries the threshold the shift closed under", async () => {
  await withTill(async (db) => {
    await world(db);
    await saveSettings(db, { varianceThreshold: 25_000 });
    await declareCash(db, float);
    expect(await closeNow(db)).toMatchObject({ threshold: 25_000 });
  });
});
