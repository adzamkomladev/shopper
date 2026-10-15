// Unpaid drafts: one active draft per org/device/branch/cashier, revision per audited edit, ordinary scans merge.
import { expect, test } from "vite-plus/test";
import { removeDraftLine, setDraftQuantity } from "@shopper/core/till";
import { goldenSale } from "../../../../support/till/basket";
import {
  add,
  at,
  bare,
  ctx,
  draftAudit,
  expectChain,
  fails,
  pack,
  products,
  read,
  scope,
  untouched,
  uuid7,
  weightLabel,
  withTill,
  world,
  zeroTotals,
} from "../../../../support/till/drafts";

const later = new Date(at.valueOf() + 60_000);

test("a scope with no draft reads as empty at revision 0 and writes nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    const before = await expectChain(db);
    const view = await read(db);
    expect(view.draft).toBeNull();
    expect(view.quote).toMatchObject({ lines: [], totals: zeroTotals, changed: false });
    expect(await expectChain(db)).toHaveLength(before.length);
  });
});

test("the first add creates one UUIDv7 draft at revision 1 with the golden quote and one audit row", async () => {
  await withTill(async (db) => {
    await world(db);
    const before = await expectChain(db);
    const view = await add(db, 0, {
      productId: products.ordinary.id,
      quantityThousandths: goldenSale.quantityThousandths,
    });
    expect(view.draft).toMatchObject({
      revision: 1,
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      lines: [
        { productId: products.ordinary.id, quantityThousandths: goldenSale.quantityThousandths },
      ],
    });
    expect(view.draft?.id).toMatch(uuid7);
    expect(view.draft?.lines[0]?.id).toMatch(uuid7);
    expect(view.draft?.lines[0]).not.toHaveProperty("label");
    expect(view.quote).toMatchObject({ totals: goldenSale.totals, changed: false });
    expect(view.quote.lines).toHaveLength(1);
    expect(view.quote.lines[0]).toMatchObject({
      lineId: view.draft?.lines[0]?.id,
      productId: products.ordinary.id,
      sku: products.ordinary.sku,
      tax: goldenSale.line,
    });
    expect(await read(db)).toEqual(view);

    const rows = await expectChain(db);
    expect(rows).toHaveLength(before.length + 1);
    expect(await draftAudit(db)).toMatchObject([
      {
        command: "till.draft.add",
        orgId: scope.orgId,
        actorId: scope.cashierId,
        deviceId: scope.deviceId,
        branchId: scope.branchId,
        entity: "draft",
        entityId: view.draft?.id,
      },
    ]);
  });
});

test("a repeated ordinary scan adds the pack quantity to the same line; the draft id is stable", async () => {
  await withTill(async (db) => {
    await world(db);
    const first = await add(db, 0, { code: bare });
    const second = await add(db, 1, { code: bare }, { at: later });
    const third = await add(db, 2, { code: pack }, { at: later });
    expect(third.draft?.lines).toHaveLength(1);
    expect(third.draft?.lines[0]).toMatchObject({
      id: first.draft?.lines[0]?.id,
      productId: products.ordinary.id,
      quantityThousandths: 8000,
    });
    expect(second.draft?.lines[0]?.quantityThousandths).toBe(2000);
    expect(third.draft).toMatchObject({
      id: first.draft?.id,
      revision: 3,
      createdAt: at.toISOString(),
      updatedAt: later.toISOString(),
    });
    expect(third.quote.totals.gross).toBe(96_000);
    expect(await draftAudit(db)).toHaveLength(3);
    await expectChain(db);
  });
});

test("adding by product id merges into an ordinary line but never into an embedded-label line", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: weightLabel });
    const view = await add(db, 1, { productId: products.weighed.id, quantityThousandths: 250 });
    await add(db, 2, { productId: products.weighed.id, quantityThousandths: 250 });
    const lines = (await read(db)).draft?.lines.map((l) => [l.quantityThousandths, l.label?.kind]);
    expect(view.draft?.lines).toHaveLength(2);
    expect(lines).toEqual([
      [500, "weight"],
      [500, undefined],
    ]);
  });
});

test("quantity edits and removals each bump the revision, write an audit row and keep the draft", async () => {
  await withTill(async (db) => {
    await world(db);
    const one = await add(db, 0, { code: bare });
    const lineId = one.draft?.lines[0]?.id ?? "";
    const edited = await setDraftQuantity(db, ctx, {
      scope,
      expectedRevision: 1,
      at: later,
      lineId,
      quantityThousandths: goldenSale.quantityThousandths,
    });
    expect(edited.draft).toMatchObject({ id: one.draft?.id, revision: 2 });
    expect(edited.draft?.lines[0]).toMatchObject({
      id: lineId,
      quantityThousandths: goldenSale.quantityThousandths,
    });
    expect(edited.quote.totals).toEqual(goldenSale.totals);

    const emptied = await removeDraftLine(db, ctx, {
      scope,
      expectedRevision: 2,
      at: later,
      lineId,
    });
    expect(emptied.draft).toMatchObject({ id: one.draft?.id, revision: 3, lines: [] });
    expect(emptied.quote).toMatchObject({ lines: [], totals: zeroTotals });
    expect((await draftAudit(db)).map((r) => [r.command, r.approverId])).toEqual([
      ["till.draft.add", null],
      ["till.draft.quantity", null],
      ["till.draft.remove", null],
    ]);
    await expectChain(db);
  });
});

test("an unknown line id and a non-positive or fractional quantity are rejected without a change", async () => {
  await withTill(async (db) => {
    await world(db);
    const view = await add(db, 0, { code: bare });
    const lineId = view.draft?.lines[0]?.id ?? "";
    const base = { scope, expectedRevision: 1, at };
    const rows = await draftAudit(db);
    await expect(
      removeDraftLine(db, ctx, { ...base, lineId: products.ordinary.id }),
    ).rejects.toMatchObject(fails("LINE_UNKNOWN"));
    for (const quantityThousandths of [0, -1000, 1.5])
      await expect(
        setDraftQuantity(db, ctx, { ...base, lineId, quantityThousandths }),
      ).rejects.toMatchObject(fails("QUANTITY_INVALID"));
    await expect(add(db, 1, { code: "0000000000000" })).rejects.toMatchObject(
      fails("PRODUCT_UNKNOWN"),
    );
    await expect(add(db, 1, {})).rejects.toThrow();
    await expect(add(db, 1, { code: bare, productId: products.ordinary.id })).rejects.toThrow();
    expect(await read(db)).toEqual(view);
    expect(await draftAudit(db)).toEqual(rows);
  });
});

test("editing a basket never writes sale rows, outbox events, sessions or receipt allocation", async () => {
  await withTill(async (db) => {
    await world(db);
    const before = await untouched(db);
    const view = await add(db, 0, { code: bare });
    const lineId = view.draft?.lines[0]?.id ?? "";
    await add(db, 1, { code: weightLabel });
    await setDraftQuantity(db, ctx, {
      scope,
      expectedRevision: 2,
      at,
      lineId,
      quantityThousandths: 3000,
    });
    await removeDraftLine(db, ctx, { scope, expectedRevision: 3, at, lineId });
    expect(await untouched(db)).toEqual(before);
  });
});
