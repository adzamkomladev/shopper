// The count is final: declareShift on a counted shift is SHIFT_COUNTED and, once counted, selling, tendering,
// refunding, dropping and no-sales are SHIFT_COUNTED too. It is refused with SHIFT_BUSY while a basket of this register
// A Z reprint and the X/Z agreement are in z.test.ts.
import { eq } from "drizzle-orm";
import { expect, test } from "vite-plus/test";
import {
  addDraftTender,
  completeDraftSale,
  currentShift,
  dropCash,
  openShift,
  recordLocalSale,
  recordNoSale,
} from "@shopper/core/till";
import { saleDraft } from "@shopper/db-sqlite";
import { config, tableCounts } from "../../../support/till/basket";
import { hour } from "../../../support/till/cash";
import {
  bystander,
  closeNow,
  declareCash,
  declareNow,
  theShift,
} from "../../../support/till/close";
import {
  add,
  at,
  auditRows,
  ctx,
  fails,
  ids,
  products,
  scope,
  withTill,
  world,
} from "../../../support/till/drafts";
import { clerk, refund, sell } from "../../../support/till/refunds";
import { setShiftStatus, shiftId, shiftMovements, shiftRows } from "../../../support/till/shifts";

type Db = Parameters<typeof add>[0];
const float = 2_000_000;
const lines = [{ productId: products.ordinary.id, quantityThousandths: 1_000 }];
const cashTender = { scope, at, kind: "cash" as const, amount: 15_000 };
const state = async (db: Db) => ({
  audit: await auditRows(db),
  counts: await tableCounts(db),
  shifts: await shiftRows(db),
  movements: await shiftMovements(db),
});
/** A one-line basket with a cash tender on the open shift. */
async function tendered(db: Db) {
  const view = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1_000 });
  await addDraftTender(db, ctx, { ...cashTender, expectedRevision: view.draft?.revision ?? 0 });
}

test("the count is final: a second declare is SHIFT_COUNTED and keeps the first declaration", async () => {
  await withTill(async (db) => {
    await world(db);
    await declareCash(db, float);
    const kept = await state(db);
    await expect(declareCash(db, float - 100)).rejects.toMatchObject(fails("SHIFT_COUNTED"));
    expect(await state(db)).toEqual(kept);
    expect(await theShift(db)).toMatchObject({ status: "declared", declaration: { cash: float } });
  });
});

test("once counted, a sale, a tender, a refund, a drop and a no-sale are SHIFT_COUNTED", async () => {
  await withTill(async (db) => {
    await world(db);
    const old = await sell(db, hour("09:00"));
    const view = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1_000 });
    await declareNow(db);
    const kept = await state(db);
    const counted = fails("SHIFT_COUNTED");
    await expect(recordLocalSale(db, config, clerk, { lines })).rejects.toMatchObject(counted);
    await expect(
      addDraftTender(db, ctx, { ...cashTender, expectedRevision: view.draft?.revision ?? 0 }),
    ).rejects.toMatchObject(counted);
    await expect(refund(db, old, [[0, 1_000]])).rejects.toMatchObject(counted);
    await expect(
      dropCash(db, config, clerk, { at, amount: 100_000, reason: "Late" }),
    ).rejects.toMatchObject(counted);
    await expect(recordNoSale(db, config, clerk, { at, reason: "Late" })).rejects.toMatchObject(
      counted,
    );
    expect(await state(db)).toEqual(kept);
  });
});

test.each([
  ["an open basket", false],
  ["a held basket", true],
])("%s with a tender makes declaring SHIFT_BUSY and writes nothing", async (_name, held) => {
  await withTill(async (db) => {
    await world(db);
    await tendered(db);
    if (held)
      await db.transaction((tx) =>
        tx.update(saleDraft).set({ status: "held" }).where(eq(saleDraft.orgId, ids.org)),
      );
    const kept = await state(db);
    await expect(declareNow(db)).rejects.toMatchObject(fails("SHIFT_BUSY"));
    expect(await state(db)).toEqual(kept);
    expect(await theShift(db)).toMatchObject({ status: "open", declaration: null });
  });
});

test("finishing the tendered sale lets the register declare", async () => {
  await withTill(async (db) => {
    await world(db);
    await tendered(db);
    await expect(declareNow(db)).rejects.toMatchObject(fails("SHIFT_BUSY"));
    await completeDraftSale(db, config, clerk, { scope, expectedRevision: 2, at });
    expect(await declareNow(db)).toMatchObject({ variances: expect.any(Array) });
    expect(await theShift(db)).toMatchObject({ status: "declared" });
  });
});

test("an untendered basket does not stop the count", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { productId: products.ordinary.id });
    expect(await declareNow(db)).toMatchObject({ approvalRequired: expect.any(Boolean) });
  });
});

test("declaring needs shift.write and writes nothing without it", async () => {
  await withTill(async (db) => {
    await world(db);
    const kept = await state(db);
    await expect(declareNow(db, {}, bystander)).rejects.toMatchObject(fails("permission"));
    expect(await state(db)).toEqual(kept);
  });
});

test("closing without a shift is SHIFT_REQUIRED and an uncounted open shift is SHIFT_OPEN", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await expect(declareNow(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    await expect(closeNow(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    await openShift(db, config, clerk, { at, float });
    const kept = await state(db);
    await expect(closeNow(db)).rejects.toMatchObject(fails("SHIFT_OPEN"));
    expect(await state(db)).toEqual(kept);
    await setShiftStatus(db, "closed");
    await expect(declareNow(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    await expect(closeNow(db)).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
  });
});

test("closing without an approver needs shift.write", async () => {
  await withTill(async (db) => {
    await world(db);
    await declareCash(db, float);
    await expect(closeNow(db, {}, bystander)).rejects.toMatchObject(fails("permission"));
    expect(await theShift(db)).toMatchObject({ status: "declared", report: null });
  });
});

test("after the close there is no current shift, selling is SHIFT_REQUIRED and a new shift opens", async () => {
  await withTill(async (db) => {
    await world(db);
    await declareCash(db, float);
    await closeNow(db);
    expect(await currentShift(db, scope)).toBeNull();
    await expect(recordLocalSale(db, config, clerk, { lines })).rejects.toMatchObject(
      fails("SHIFT_REQUIRED"),
    );
    const next = await openShift(db, config, clerk, {
      at: new Date(hour("19:00")),
      float: 500_000,
    });
    expect(await currentShift(db, scope)).toMatchObject({ id: next.id, status: "open" });
    expect(await shiftRows(db)).toHaveLength(2);
    expect(await shiftRows(db)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: shiftId, status: "closed" })]),
    );
  });
});
