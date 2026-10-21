// Selling, tendering, taking a MoMo payment and refunding all need an open shift on the register (SHIFT_REQUIRED);
// a counted (declared) shift refuses them with SHIFT_COUNTED. Completed sales and refunds carry the shift's id in
// local_sale.shift_id / refund.shift_id; the sale and refund events are unchanged (protocol stays 4).
import { expect, test } from "vite-plus/test";
import {
  addDraftTender,
  applyDraftPayment,
  completeDraftSale,
  currentShift,
  recordLocalSale,
} from "@shopper/core/till";
import { localSale, outbox } from "@shopper/db-sqlite";
import { config } from "../../../support/till/basket";
import {
  add,
  at,
  ctx,
  fails,
  products,
  read,
  scope,
  session,
  withTill,
  world,
} from "../../../support/till/drafts";
import { clerk, refund, refundRows, sell } from "../../../support/till/refunds";
import {
  earlierShiftId,
  insertOpenShift,
  setShiftStatus,
  shiftId,
} from "../../../support/till/shifts";

type Db = Parameters<typeof add>[0];
const tender = { scope, at, kind: "cash" as const, amount: 15_000 };
const lines = [{ productId: products.ordinary.id, quantityThousandths: 1_000 }];
const momo = {
  scope,
  at,
  reference: "019a0000-0000-7000-8000-000000000092",
  amount: 12_000,
  phone: "******4987",
  network: "mtn",
  status: "pending" as const,
};
/** A one-line basket with a cash tender, taken while the shift was open. */
async function tendered(db: Db) {
  const view = await add(db, 0, { productId: products.ordinary.id, quantityThousandths: 1_000 });
  await addDraftTender(db, ctx, { ...tender, expectedRevision: view.draft?.revision ?? 0 });
}
const sales = (db: Db) => db.read((tx) => tx.select().from(localSale));

test("a register with no shift refuses to add a tender and keeps the basket as it was", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await add(db, 0, { productId: products.ordinary.id });
    await expect(addDraftTender(db, ctx, { ...tender, expectedRevision: 1 })).rejects.toMatchObject(
      fails("SHIFT_REQUIRED"),
    );
    expect((await read(db)).draft).toMatchObject({ revision: 1 });
  });
});

test("a register with no shift refuses a MoMo payment", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await add(db, 0, { productId: products.ordinary.id });
    await expect(
      applyDraftPayment(db, ctx, { ...momo, expectedRevision: 1 }),
    ).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    expect((await read(db)).draft).toMatchObject({ revision: 1 });
  });
});

test("a shift closed after the tender refuses completing the sale and records nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    await tendered(db);
    await setShiftStatus(db, "closed");
    await expect(
      completeDraftSale(db, config, session, { scope, expectedRevision: 2, at }),
    ).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    expect(await sales(db)).toEqual([]);
    expect(await db.read((tx) => tx.select().from(outbox))).toEqual([]);
  });
});

test("recordLocalSale refuses a register with no shift", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await expect(recordLocalSale(db, config, session, { lines })).rejects.toMatchObject(
      fails("SHIFT_REQUIRED"),
    );
    expect(await sales(db)).toEqual([]);
  });
});

test("a refund is refused once the shift is closed and records nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-20T10:00:00.000Z");
    await setShiftStatus(db, "closed");
    await expect(refund(db, sale, [[0, 1_000]])).rejects.toMatchObject(fails("SHIFT_REQUIRED"));
    expect(await refundRows(db)).toEqual([]);
  });
});

test("a counted shift refuses selling, tendering and refunding with SHIFT_COUNTED", async () => {
  await withTill(async (db) => {
    await world(db);
    const sale = await sell(db, "2025-12-20T10:00:00.000Z");
    await tendered(db);
    await setShiftStatus(db, "declared");
    expect(await currentShift(db, scope)).toMatchObject({ id: shiftId, status: "declared" });
    await expect(
      completeDraftSale(db, config, session, { scope, expectedRevision: 2, at }),
    ).rejects.toMatchObject(fails("SHIFT_COUNTED"));
    await expect(addDraftTender(db, ctx, { ...tender, expectedRevision: 2 })).rejects.toMatchObject(
      fails("SHIFT_COUNTED"),
    );
    await expect(recordLocalSale(db, config, session, { lines })).rejects.toMatchObject(
      fails("SHIFT_COUNTED"),
    );
    await expect(refund(db, sale, [[0, 1_000]])).rejects.toMatchObject(fails("SHIFT_COUNTED"));
    expect(await sales(db)).toHaveLength(1);
  });
});

test("sales and refunds are stamped with the current shift, never an earlier closed one", async () => {
  await withTill(async (db) => {
    await world(db, { shift: false });
    await insertOpenShift(db, { id: earlierShiftId, status: "closed" });
    await insertOpenShift(db, { id: shiftId });
    const sale = await sell(db, "2025-12-20T10:00:00.000Z");
    const direct = await recordLocalSale(db, config, clerk, { lines });
    const { event } = await refund(db, sale, [[0, 1_000]]);
    const stamped = await sales(db);
    expect(stamped.map((row) => [row.id, row.shiftId])).toEqual(
      expect.arrayContaining([
        [sale.id, shiftId],
        [direct.sale.id, shiftId],
      ]),
    );
    expect(stamped).toHaveLength(2);
    expect(await refundRows(db)).toMatchObject([{ id: event.refund.id, shiftId }]);
  });
});

test("the sale and refund events do not mention shifts and stay on protocol 4", async () => {
  await withTill(async (db) => {
    await world(db);
    const direct = await recordLocalSale(db, config, clerk, { lines });
    const sale = await sell(db, "2025-12-20T10:00:00.000Z");
    const { event } = await refund(db, sale, [[0, 1_000]]);
    expect(direct).toMatchObject({ v: 4, type: "sale.recorded" });
    expect(JSON.stringify(direct)).not.toMatch(/shift/i);
    expect(JSON.stringify(sale)).not.toMatch(/shift/i);
    expect(JSON.stringify(event)).not.toMatch(/shift/i);
  });
});
