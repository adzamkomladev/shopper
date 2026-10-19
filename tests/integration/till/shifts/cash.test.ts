// dropCash(db, config, session, { at, amount, reason? }) is `shift.drop`; recordNoSale(db, config, session, { at, reason })
// is `shift.nosale`. Both need shift.write and an open shift (SHIFT_REQUIRED, SHIFT_COUNTED once counted). A drop is
// never limited by the expected cash. readShiftReport(...).cash shows what they did to the drawer.
import { expect, test } from "vite-plus/test";
import { dropCash, readShiftReport, recordNoSale } from "@shopper/core/till";
import { config } from "../../../support/till/basket";
import {
  at,
  auditRows,
  expectChain,
  fails,
  ids,
  session,
  withTill,
  world,
} from "../../../support/till/drafts";
import { reader, setShiftStatus, shiftId, shiftMovements } from "../../../support/till/shifts";

type Db = Parameters<typeof dropCash>[0];
const drop = (db: Db, input: Record<string, unknown>, who = reader) =>
  dropCash(db, config, who, { at, amount: 300_000, ...input });
const noSale = (db: Db, input: Record<string, unknown> = {}, who = reader) =>
  recordNoSale(db, config, who, { at, reason: "Change request", ...input });
const cash = async (db: Db) => (await readShiftReport(db, config, reader, { at })).cash;
const commands = async (db: Db, name: string) =>
  (await auditRows(db)).filter((row) => row.command === name);

test("a drop is stored with who made it and when, and lowers the expected cash", async () => {
  await withTill(async (db) => {
    await world(db);
    const moved = await drop(db, { amount: 300_000, reason: "Safe run" });
    expect(moved).toMatchObject({
      kind: "drop",
      amount: 300_000,
      reason: "Safe run",
      actorId: ids.cashier,
      sessionId: session.id,
      at: at.toISOString(),
      shiftId,
    });
    expect(await shiftMovements(db)).toMatchObject([{ id: moved.id, kind: "drop" }]);
    expect(await cash(db)).toEqual({
      float: 2_000_000,
      sales: 0,
      refunds: 0,
      drops: 300_000,
      expected: 1_700_000,
    });
  });
});

test("drops add up, and the reason is optional and trimmed", async () => {
  await withTill(async (db) => {
    await world(db);
    await drop(db, { amount: 300_000 });
    await drop(db, { amount: 200_000, reason: "  Float to safe  " });
    expect(await shiftMovements(db)).toMatchObject([
      { amount: 300_000, reason: null },
      { amount: 200_000, reason: "Float to safe" },
    ]);
    expect(await cash(db)).toMatchObject({ drops: 500_000, expected: 1_500_000 });
  });
});

test("a drop larger than the expected cash is accepted and the expected cash goes negative", async () => {
  await withTill(async (db) => {
    await world(db);
    await drop(db, { amount: 3_000_000 });
    expect(await shiftMovements(db)).toMatchObject([{ kind: "drop", amount: 3_000_000 }]);
    expect(await cash(db)).toMatchObject({ drops: 3_000_000, expected: -1_000_000 });
  });
});

test("a drop writes one shift.drop audit row naming the shift and the amount, and the chain verifies", async () => {
  await withTill(async (db) => {
    await world(db);
    await drop(db, { amount: 300_000, reason: "Safe run" });
    const rows = (await expectChain(db)).filter((row) => row.command === "shift.drop");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: ids.cashier,
      deviceId: ids.device,
      entity: "shift",
      entityId: shiftId,
      payload: expect.objectContaining({ amount: 300_000 }),
    });
  });
});

test.each([
  ["zero", { amount: 0 }],
  ["negative", { amount: -100 }],
  ["fractional", { amount: 100.5 }],
  ["not a number", { amount: Number.NaN }],
  ["a reason over 200 characters", { reason: "x".repeat(201) }],
])("a drop of %s is refused and nothing is written", async (_name, input) => {
  await withTill(async (db) => {
    await world(db);
    const before = await auditRows(db);
    await expect(drop(db, input)).rejects.toThrow();
    expect(await shiftMovements(db)).toEqual([]);
    expect(await auditRows(db)).toEqual(before);
  });
});

test("a no-sale needs a reason: empty, blank, missing or over 200 characters is refused and writes nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    const before = await auditRows(db);
    for (const reason of ["", "   ", undefined, "x".repeat(201)])
      await expect(noSale(db, { reason })).rejects.toThrow();
    expect(await shiftMovements(db)).toEqual([]);
    expect(await auditRows(db)).toEqual(before);
  });
});

test("a no-sale is stored with amount 0 and its trimmed reason, audited with the reason, and adds nothing to the drawer", async () => {
  await withTill(async (db) => {
    await world(db);
    const before = await cash(db);
    const moved = await noSale(db, { reason: "  Customer wanted change  " });
    expect(moved).toMatchObject({
      kind: "no_sale",
      amount: 0,
      reason: "Customer wanted change",
      actorId: ids.cashier,
      sessionId: session.id,
      at: at.toISOString(),
      shiftId,
    });
    expect(await shiftMovements(db)).toMatchObject([{ id: moved.id, kind: "no_sale" }]);
    expect(await cash(db)).toEqual(before);
    const rows = (await expectChain(db)).filter((row) => row.command === "shift.nosale");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: ids.cashier,
      entity: "shift",
      entityId: shiftId,
      payload: expect.objectContaining({ reason: "Customer wanted change" }),
    });
  });
});

test("drops and no-sales need shift.write on the session and write nothing without it", async () => {
  await withTill(async (db) => {
    await world(db);
    const before = await auditRows(db);
    await expect(drop(db, {}, session)).rejects.toMatchObject(fails("permission"));
    await expect(noSale(db, {}, session)).rejects.toMatchObject(fails("permission"));
    expect(await shiftMovements(db)).toEqual([]);
    expect(await auditRows(db)).toEqual(before);
  });
});

test("a register with no shift is SHIFT_REQUIRED for a drop and a no-sale and writes nothing", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await expect(drop(db, {})).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    await expect(noSale(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    expect(await shiftMovements(db)).toEqual([]);
    expect(await commands(db, "shift.drop")).toEqual([]);
    expect(await commands(db, "shift.nosale")).toEqual([]);
  });
});

test("a closed shift counts as no shift", async () => {
  await withTill(async (db) => {
    await world(db);
    await setShiftStatus(db, "closed");
    await expect(drop(db, {})).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    await expect(noSale(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
  });
});

test("a counted shift is SHIFT_COUNTED for a drop and a no-sale and writes nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    await setShiftStatus(db, "declared");
    await expect(drop(db, {})).rejects.toMatchObject(fails("SHIFT_COUNTED"));
    await expect(noSale(db)).rejects.toMatchObject(fails("SHIFT_COUNTED"));
    expect(await shiftMovements(db)).toEqual([]);
    expect(await commands(db, "shift.drop")).toEqual([]);
    expect(await commands(db, "shift.nosale")).toEqual([]);
  });
});
