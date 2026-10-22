// readShiftReport(db, config, session, { at }) is the X report: the open (or counted) shift's takings so far, read-only
// and behind report.read. printShiftReport(...) builds the same X and writes one `shift.print` audit row.
// The day below (tradeDay, support/till/cash.ts) is worked by hand; prices are 12 000 a unit, VAT 15%, NHIL 2.5%,
// GETFund 2.5%, cash rounded to 10p (1 000):
//   rice     3 units  gross 36 000  tax 4 500+750+750 = 6 000    cash 50 000 handed over, 14 000 change -> kept 36 000
//   rounded  1.05     gross 12 600  tax 1 575+263+263 = 2 101    total 13 000 (+400), 20 000 handed over, 7 000 change -> kept 13 000
//   card     2 units  gross 24 000  tax 3 000+500+500 = 4 000    card 24 000
//   split    1 unit   gross 12 000  tax 1 500+250+250 = 2 000    card 2 000 + cash 10 000 -> kept 10 000
//   sales: 4, gross 36 000+13 000+24 000+12 000 = 85 000 (the total, with the rounding), tax 14 101
//   cash sales 36 000+13 000+10 000 = 59 000; card sales 24 000+2 000 = 26 000; MoMo 0
//   refunds: the rounded sale in cash, 12 600 -> 13 000 paid out; half the card sale, 6 000 -> 2, total 19 000
//   cash: float 2 000 000 + 59 000 - 13 000 - drop 1 000 000 = 1 046 000 (the no-sale adds 0); card 26 000 - 6 000 = 20 000
import { expect, test } from "vite-plus/test";
import { printShiftReport, readShiftReport } from "@shopper/core/till";
import { config, tableCounts } from "../../../support/till/basket";
import { addStaff, hour, move, sellTenders, tradeDay } from "../../../support/till/cash";
import { auditRows, expectChain, fails, ids, withTill, world } from "../../../support/till/drafts";
import { clerk, refund, refundRows, saveSettings } from "../../../support/till/refunds";
import {
  earlierShiftId,
  insertOpenShift,
  setShiftStatus,
  shiftId,
  shiftMovements,
  shiftRows,
} from "../../../support/till/shifts";

type Db = Parameters<typeof readShiftReport>[0];
const reportAt = new Date(hour("13:00"));
const x = (db: Db, who = clerk) => readShiftReport(db, config, who, { at: reportAt });
const printX = (db: Db, who = clerk) => printShiftReport(db, config, who, { at: reportAt });
const writer = { ...clerk, permissions: ["sale.create", "shift.write"] };
const snapshot = async (db: Db) => ({
  audit: await auditRows(db),
  counts: await tableCounts(db),
  shifts: await shiftRows(db),
  movements: await shiftMovements(db),
  refunds: await refundRows(db),
});

test("the X of a day with cash and card sales, refunds, a drop and a no-sale reconciles to the pesewa", async () => {
  await withTill(async (db) => {
    await world(db);
    await saveSettings(db, { registerName: "Front till" });
    await addStaff(db, ids.cashier, "Ama Mensah");
    await tradeDay(db);
    expect(await x(db)).toEqual({
      kind: "x",
      shiftId,
      storeId: config.storeId,
      branchId: ids.branch,
      deviceId: ids.device,
      registerName: "Front till",
      openedAt: "2025-12-01T00:00:00.000Z",
      openedBy: ids.cashier,
      at: reportAt.toISOString(),
      sales: { count: 4, gross: 85_000, tax: 14_101 },
      refunds: { count: 2, total: 19_000 },
      tenders: [
        { tender: "cash", sales: 59_000, refunds: 13_000, expected: 1_046_000 },
        { tender: "card", sales: 26_000, refunds: 6_000, expected: 20_000 },
        { tender: "momo", sales: 0, refunds: 0, expected: 0 },
      ],
      account: { sales: 0, payments: { cash: 0, momo: 0 }, refunds: 0, points: 0, pointsValue: 0 },
      cash: {
        float: 2_000_000,
        sales: 59_000,
        refunds: 13_000,
        drops: 1_000_000,
        expected: 1_046_000,
      },
      movements: [
        {
          kind: "drop",
          amount: 1_000_000,
          reason: "Safe run",
          actorId: ids.cashier,
          at: move.drop,
        },
        {
          kind: "no_sale",
          amount: 0,
          reason: "Change request",
          actorId: ids.cashier,
          at: move.noSale,
        },
      ],
      cashiers: [{ userId: ids.cashier, name: "Ama Mensah" }],
    });
  });
});

test("a cashier without a cached staff record is listed with a null name", async () => {
  await withTill(async (db) => {
    await world(db);
    await sellTenders(db, hour("09:00"), 1_000, [{ kind: "cash", amount: 12_000 }]);
    expect((await x(db)).cashiers).toEqual([{ userId: ids.cashier, name: null }]);
  });
});

test("an empty shift shows its float as the expected cash and all three tenders at zero", async () => {
  await withTill(async (db) => {
    await world(db);
    expect(await x(db)).toMatchObject({
      sales: { count: 0, gross: 0, tax: 0 },
      refunds: { count: 0, total: 0 },
      tenders: [
        { tender: "cash", sales: 0, refunds: 0, expected: 2_000_000 },
        { tender: "card", sales: 0, refunds: 0, expected: 0 },
        { tender: "momo", sales: 0, refunds: 0, expected: 0 },
      ],
      cash: { float: 2_000_000, sales: 0, refunds: 0, drops: 0, expected: 2_000_000 },
      movements: [],
      cashiers: [{ userId: ids.cashier, name: null }],
    });
  });
});

test("sales and refunds of an earlier closed shift are excluded; a refund of an old sale made now counts now", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await insertOpenShift(db, { id: earlierShiftId });
    const old = await sellTenders(db, hour("07:00"), 3_000, [{ kind: "cash", amount: 36_000 }]);
    await refund(db, old, [[0, 1_000]], { at: hour("07:30") });
    await setShiftStatus(db, "closed");
    await insertOpenShift(db, { openedAt: hour("08:30"), float: 500_000 });
    await sellTenders(db, hour("09:00"), 1_000, [{ kind: "cash", amount: 12_000 }]);
    // Half a unit of the old sale, paid out of today's drawer: 6 000.
    await refund(db, old, [[0, 500]], { at: hour("10:00") });
    expect(await x(db)).toMatchObject({
      shiftId,
      sales: { count: 1, gross: 12_000, tax: 2_000 },
      refunds: { count: 1, total: 6_000 },
      cash: { float: 500_000, sales: 12_000, refunds: 6_000, drops: 0, expected: 506_000 },
    });
  });
});

test("the X can be read once the shift is counted, with the same figures", async () => {
  await withTill(async (db) => {
    await world(db);
    await tradeDay(db);
    const open = await x(db);
    await setShiftStatus(db, "declared");
    expect(await x(db)).toEqual(open);
  });
});

test("reading the X writes nothing: no audit row and no row changes", async () => {
  await withTill(async (db) => {
    await world(db);
    await tradeDay(db);
    const before = await snapshot(db);
    await x(db);
    await x(db);
    expect(await snapshot(db)).toEqual(before);
  });
});

test("the X needs report.read and refuses a session without it", async () => {
  await withTill(async (db) => {
    await world(db);
    const before = await auditRows(db);
    await expect(x(db, writer)).rejects.toMatchObject(fails("permission"));
    await expect(printX(db, writer)).rejects.toMatchObject(fails("permission"));
    expect(await auditRows(db)).toEqual(before);
  });
});

test("a register with no shift is SHIFT_REQUIRED for the X and its print", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    const before = await auditRows(db);
    await expect(x(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    await expect(printX(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    expect(await auditRows(db)).toEqual(before);
  });
});

test("printing the X returns the same report and writes exactly one shift.print audit row", async () => {
  await withTill(async (db) => {
    await world(db);
    await tradeDay(db);
    const before = (await auditRows(db)).length;
    const read = await x(db);
    expect(await printX(db)).toEqual(read);
    const rows = await expectChain(db);
    expect(rows).toHaveLength(before + 1);
    const row = rows.at(-1)!;
    expect(row).toMatchObject({
      command: "shift.print",
      entity: "shift",
      entityId: shiftId,
      actorId: ids.cashier,
      payload: expect.objectContaining({ kind: "x" }),
    });
    expect(JSON.stringify(row.payload)).toContain("1046000");
  });
});

test("printing the X changes no shift, sale, refund or movement row", async () => {
  await withTill(async (db) => {
    await world(db);
    await tradeDay(db);
    const before = await snapshot(db);
    await printX(db);
    expect(await snapshot(db)).toEqual({
      ...before,
      audit: expect.arrayContaining(before.audit),
      counts: { ...before.counts, audit: before.counts.audit + 1 },
    });
  });
});
