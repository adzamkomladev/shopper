// declareShift(db, config, session, { at, counts, card, momo }) is the blind count (`shift.declare`); closeShift(db,
// config, session, { at, approverId? }) is `shift.close` and returns the Z report. The Z is the X report with
// kind "z", the declaration, the variance per tender, the threshold, the approver, closedAt/By and the audit anchor:
// the till_audit chain head just before the close row's own entry (the declare row), also stored as anchorSeq/Hash.
//
// The day below is worked by hand (12 000 a unit, VAT 15%, NHIL 2.5%, GETFund 2.5%, cash rounded to 10p = 1 000):
//   earlier shift  5 units cash 36 000 ... a sale of an earlier closed shift: it must not appear anywhere in the Z
//   A  1.05 units  gross 12 600, tax 1 575+263+263 = 2 101, cash total 13 000 (+400 rounding); 20 000 in, 7 000 change
//   B  3 units     gross 36 000, tax 6 000; 50 000 in, 14 000 change -> kept 36 000
//   C  2 units     gross 24 000, tax 4 000; card 24 000
//   sales: 3, gross 13 000 + 36 000 + 24 000 = 73 000, tax 2 101 + 6 000 + 4 000 = 12 101
//   refunds: A back in full in cash, 12 600 -> 13 000 paid out (+400 rounding); 1 of C's 2 units to card, 12 000; 25 000
//   cash: float 2 000 000 + 13 000 + 36 000 - 13 000 - drop 1 000 000 = 1 036 000 (the no-sale adds 0)
//   card: 24 000 - 12 000 = 12 000; MoMo 0
//   counted: GHS 100 + GHS 2 + GHS 1 + GHS 0.50 + GHS 0.10 = 1 000 000 + 20 000 + 10 000 + 5 000 + 1 000 = 1 036 000
import { expect, test } from "vite-plus/test";
import { dropCash, openShift, recordNoSale } from "@shopper/core/till";
import { config } from "../../../support/till/basket";
import { addStaff, hour, move, sellTenders } from "../../../support/till/cash";
import { closeAt, closeNow, declareNow } from "../../../support/till/close";
import { expectChain, ids, withTill, world } from "../../../support/till/drafts";
import { clerk, refund, saveSettings } from "../../../support/till/refunds";
import {
  earlierShiftId,
  insertOpenShift,
  setShiftStatus,
  shiftRows,
} from "../../../support/till/shifts";

const counts = { "1000000": 1, "20000": 1, "10000": 1, "5000": 1, "1000": 1 };
const balanced = [
  { tender: "cash", expected: 1_036_000, declared: 1_036_000, variance: 0 },
  { tender: "card", expected: 12_000, declared: 12_000, variance: 0 },
  { tender: "momo", expected: 0, declared: 0, variance: 0 },
];

test("Shift with sales, refunds, drops and a no-sale → Z-report reconciles to the cedi", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await saveSettings(db, { registerName: "Front till" });
    await addStaff(db, ids.cashier, "Ama Mensah");
    await insertOpenShift(db, { id: earlierShiftId });
    await sellTenders(db, hour("07:00"), 5_000, [{ kind: "cash", amount: 60_000 }]);
    await setShiftStatus(db, "closed");

    const opened = await openShift(db, config, clerk, {
      at: new Date(hour("08:30")),
      float: 2_000_000,
    });
    const rounded = await sellTenders(db, hour("09:00"), 1_050, [{ kind: "cash", amount: 20_000 }]);
    await sellTenders(db, hour("09:15"), 3_000, [{ kind: "cash", amount: 50_000 }]);
    const card = await sellTenders(db, hour("09:30"), 2_000, [{ kind: "card", amount: 24_000 }]);
    const at = (time: string) => new Date(time);
    await dropCash(db, config, clerk, { at: at(move.drop), amount: 1_000_000, reason: "Safe run" });
    await recordNoSale(db, config, clerk, { at: at(move.noSale), reason: "Change request" });
    await refund(db, rounded, [[0, 1_050]], { at: hour("12:00") });
    await refund(db, card, [[0, 1_000]], {
      at: hour("12:10"),
      tender: { kind: "card", reference: "CARD-9" },
    });

    const counted = await declareNow(db, { counts, card: 12_000, momo: 0 });
    expect(counted).toMatchObject({
      variances: balanced,
      threshold: 50_000,
      approvalRequired: false,
    });
    const z = await closeNow(db);

    const rows = await expectChain(db);
    const anchor = rows.at(-2)!;
    expect(rows.at(-1)!.command).toBe("shift.close");
    expect(anchor.command).toBe("shift.declare");
    expect(z).toEqual({
      kind: "z",
      shiftId: opened.id,
      storeId: config.storeId,
      branchId: ids.branch,
      deviceId: ids.device,
      registerName: "Front till",
      openedAt: hour("08:30"),
      openedBy: ids.cashier,
      at: closeAt.toISOString(),
      sales: { count: 3, gross: 73_000, tax: 12_101 },
      refunds: { count: 2, total: 25_000 },
      tenders: [
        { tender: "cash", sales: 49_000, refunds: 13_000, expected: 1_036_000 },
        { tender: "card", sales: 24_000, refunds: 12_000, expected: 12_000 },
        { tender: "momo", sales: 0, refunds: 0, expected: 0 },
      ],
      cash: {
        float: 2_000_000,
        sales: 49_000,
        refunds: 13_000,
        drops: 1_000_000,
        expected: 1_036_000,
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
      declared: { counts, cash: 1_036_000, card: 12_000, momo: 0 },
      variances: balanced,
      threshold: 50_000,
      approverId: null,
      closedAt: closeAt.toISOString(),
      closedBy: ids.cashier,
      anchor: { seq: anchor.chainSeq, hash: anchor.hash },
    });

    const stored = (await shiftRows(db)).find((row) => row.id === opened.id)!;
    expect(stored).toMatchObject({
      status: "closed",
      closedAt: closeAt.toISOString(),
      closedBy: ids.cashier,
      approverId: null,
      report: z,
      anchorSeq: anchor.chainSeq,
      anchorHash: anchor.hash,
      declaration: { counts, cash: 1_036_000, card: 12_000, momo: 0 },
    });
    expect(anchor.chainSeq).toBeGreaterThan(0);
  });
});

test("the shift's audit rows are shift.open, drop, nosale, declare and close, and the close row has no approver", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await openShift(db, config, clerk, { at: new Date(hour("08:30")), float: 2_000_000 });
    await dropCash(db, config, clerk, { at: new Date(move.drop), amount: 1_000_000 });
    await recordNoSale(db, config, clerk, { at: new Date(move.noSale), reason: "Change request" });
    await declareNow(db, { counts: { "1000000": 1 } });
    await closeNow(db);
    const commands = (await expectChain(db)).filter((row) => row.command.startsWith("shift."));
    expect(commands.map((row) => row.command)).toEqual([
      "shift.open",
      "shift.drop",
      "shift.nosale",
      "shift.declare",
      "shift.close",
    ]);
    expect(commands.at(-1)).toMatchObject({
      actorId: ids.cashier,
      entity: "shift",
      approverId: null,
    });
    expect(commands.at(-1)?.entityId).toBe(commands[0]?.entityId);
  });
});
