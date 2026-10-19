// The Z is the X report's figures frozen at close. Reading the X of a counted shift writes nothing and agrees with
// the Z in every shared figure. A Z reprint (printShiftReport with a shiftId, shift.read) returns the stored Z, never
// a recomputation, and writes one `shift.print` audit row with kind "z".
import { expect, test } from "vite-plus/test";
import { openShift, printShiftReport, readShiftReport } from "@shopper/core/till";
import { config } from "../../../support/till/basket";
import { addStaff, hour, sellTenders } from "../../../support/till/cash";
import { auditor, closeAt, closeNow, declareCash, sellSome } from "../../../support/till/close";
import { auditRows, expectChain, fails, ids, withTill, world } from "../../../support/till/drafts";
import { clerk, saveSettings } from "../../../support/till/refunds";
import { shiftId, shiftMovements, shiftRows } from "../../../support/till/shifts";

const float = 2_000_000;
type Db = Parameters<typeof auditRows>[0];
const state = async (db: Db) => ({
  audit: await auditRows(db),
  shifts: await shiftRows(db),
  movements: await shiftMovements(db),
});

test("the X on a counted shift matches the Z in every shared figure, and reading it writes nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    await addStaff(db, ids.cashier, "Ama Mensah");
    await sellSome(db);
    await declareCash(db, float + 36_000, { card: 24_000 });
    const kept = await state(db);
    const x = await readShiftReport(db, config, clerk, { at: new Date(hour("17:45")) });
    expect(await state(db)).toEqual(kept);
    const z = await closeNow(db);
    const zOnly = ["kind", "at", "declared", "variances", "threshold", "approverId"];
    const zOnlyMore = ["closedAt", "closedBy", "anchor"];
    const shared = (report: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(report).filter(([key]) => ![...zOnly, ...zOnlyMore].includes(key)),
      );
    expect([x.kind, z.kind, x.at, z.at]).toEqual(["x", "z", hour("17:45"), closeAt.toISOString()]);
    expect(shared(z)).toEqual(shared(x));
    expect(z).toMatchObject({
      declared: { cash: float + 36_000, card: 24_000, momo: 0 },
      threshold: 50_000,
      approverId: null,
      closedAt: closeAt.toISOString(),
      closedBy: ids.cashier,
    });
    expect(z.variances).toHaveLength(3);
  });
});

test("a Z reprint returns the stored report unchanged, even after later activity, and is audited", async () => {
  await withTill(async (db) => {
    await world(db);
    await sellSome(db);
    await declareCash(db, float + 36_000, { card: 24_000 });
    const z = await closeNow(db);
    // Everything a recomputation would pick up: a new register name, a staff name, a new shift with sales.
    await saveSettings(db, { registerName: "Back till" });
    await addStaff(db, ids.cashier, "Ama Mensah");
    await openShift(db, config, clerk, { at: new Date(hour("19:00")), float: 500_000 });
    await sellTenders(db, hour("19:30"), 1_000, [{ kind: "cash", amount: 12_000 }]);
    const kept = await state(db);
    const print = () =>
      printShiftReport(db, config, auditor, { at: new Date(hour("20:00")), shiftId });
    expect(await print()).toEqual(z);
    expect(await print()).toEqual(z);
    expect((await shiftRows(db)).find((row) => row.id === shiftId)?.report).toEqual(z);
    const rows = (await expectChain(db)).filter((row) => row.command === "shift.print");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      actorId: ids.cashier,
      entity: "shift",
      entityId: shiftId,
      payload: expect.objectContaining({ kind: "z" }),
    });
    const after = await state(db);
    expect([after.shifts, after.movements]).toEqual([kept.shifts, kept.movements]);
  });
});

test("a Z reprint needs shift.read", async () => {
  await withTill(async (db) => {
    await world(db);
    await declareCash(db, float);
    await closeNow(db);
    const kept = await auditRows(db);
    await expect(
      printShiftReport(db, config, clerk, { at: new Date(hour("20:00")), shiftId }),
    ).rejects.toMatchObject(fails("permission"));
    expect(await auditRows(db)).toEqual(kept);
  });
});
