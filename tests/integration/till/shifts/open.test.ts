// openShift(db, config, session, { at, float?, counts? }) is the `shift.open` command: one open shift per register
// (org + device), a float given as an amount or as denomination counts (face in minor units -> count), audited.
// currentShift(db, scope) returns the open or declared shift of the register, or null.
import { expect, test } from "vite-plus/test";
import { currentShift, openShift } from "@shopper/core/till";
import { config } from "../../../support/till/basket";
import {
  at,
  auditRows,
  expectChain,
  fails,
  ids,
  scope,
  session,
  withTill,
  world,
} from "../../../support/till/drafts";
import {
  earlierShiftId,
  insertOpenShift,
  shiftId,
  shiftRows,
  shifter,
} from "../../../support/till/shifts";

const open = (
  db: Parameters<typeof openShift>[0],
  input: Record<string, unknown> = {},
  who = shifter,
) => openShift(db, config, who, { at, ...input });

test("a register without a shift has no current shift, and opening one makes it current", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    expect(await currentShift(db, scope)).toBeNull();
    const opened = await open(db, { float: 1_000_000 });
    expect(await currentShift(db, scope)).toMatchObject({ id: opened.id, status: "open" });
    expect(await shiftRows(db)).toMatchObject([
      {
        id: opened.id,
        orgId: ids.org,
        deviceId: ids.device,
        branchId: ids.branch,
        storeId: config.storeId,
        status: "open",
        openedAt: at.toISOString(),
        openedBy: ids.cashier,
        openedSessionId: session.id,
        closedAt: null,
        report: null,
      },
    ]);
  });
});

test("an amount float is stored as given, with no denomination counts", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await open(db, { float: 1_500_000 });
    expect(await shiftRows(db)).toMatchObject([{ float: 1_500_000, floatCounts: null }]);
  });
});

test("a float counted by denomination equals the sum of face times count", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    // GHS 200 + GHS 50 + 3 x GHS 0.50 + 7 x GHS 0.01
    const counts = { "2000000": 1, "500000": 1, "5000": 3, "100": 7 };
    await open(db, { counts });
    const [row] = await shiftRows(db);
    expect(row?.float).toBe(2_000_000 + 500_000 + 3 * 5_000 + 7 * 100);
    expect(row?.floatCounts).toMatchObject(counts);
  });
});

test.each([
  ["a face that is not a Ghana denomination", { counts: { "3000": 1 } }],
  ["a negative count", { counts: { "10000": -1 } }],
  ["a fractional count", { counts: { "10000": 1.5 } }],
  ["a count above 100 000", { counts: { "10000": 100_001 } }],
  ["a negative amount", { float: -1 }],
  ["a fractional amount", { float: 100.5 }],
])("%s is refused and nothing is written", async (_name, input) => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    const before = await auditRows(db);
    await expect(open(db, input)).rejects.toThrow();
    expect(await shiftRows(db)).toEqual([]);
    expect(await auditRows(db)).toEqual(before);
  });
});

test("a second open on the same register is SHIFT_OPEN and leaves the first untouched", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    const first = await open(db, { float: 1_000_000 });
    await expect(open(db, { float: 2_000_000 })).rejects.toMatchObject(fails("SHIFT_OPEN"));
    expect(await shiftRows(db)).toMatchObject([{ id: first.id, float: 1_000_000 }]);
    expect((await auditRows(db)).filter((r) => r.command === "shift.open")).toHaveLength(1);
  });
});

test("the database allows one unfinished shift per register: closed ones and other registers do not count", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await insertOpenShift(db, { id: earlierShiftId, status: "closed" });
    await insertOpenShift(db, { id: shiftId });
    const other = "019a0000-0000-7000-8000-0000000000d1";
    await insertOpenShift(db, { id: "019a0000-0000-7000-8000-0000000000f2", deviceId: other });
    await expect(
      insertOpenShift(db, { id: "019a0000-0000-7000-8000-0000000000f3" }),
    ).rejects.toThrow();
    await expect(
      insertOpenShift(db, { id: "019a0000-0000-7000-8000-0000000000f4", status: "declared" }),
    ).rejects.toThrow();
    expect(await shiftRows(db)).toHaveLength(3);
  });
});

test("opening needs shift.write on the session and writes nothing without it", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await expect(open(db, { float: 1_000_000 }, session)).rejects.toMatchObject(
      fails("permission"),
    );
    expect(await shiftRows(db)).toEqual([]);
    expect((await auditRows(db)).filter((r) => r.command === "shift.open")).toEqual([]);
  });
});

test("opening writes one shift.open audit row with the float, the actor and the shift", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    const opened = await open(db, { counts: { "1000000": 2, "10000": 5 } });
    const rows = (await expectChain(db)).filter((row) => row.command === "shift.open");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: ids.cashier,
      deviceId: ids.device,
      entity: "shift",
      entityId: opened.id,
      payload: expect.objectContaining({ float: 2_050_000 }),
    });
  });
});
