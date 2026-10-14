// Unpaid drafts: reads requote against current reference data and flag when totals moved; removal needs no approval.
import { expect, test } from "vite-plus/test";
import { provisionTillReference, removeDraftLine } from "@shopper/core/till";
import {
  add,
  at,
  bare,
  context,
  ctx,
  draftAudit,
  expectChain,
  ids,
  priceLabel,
  products,
  read,
  scope,
  withTill,
  world,
} from "../../../../support/till/drafts";
import { refPrice } from "../../../../support/till/basket";

const reprice = (db: Parameters<typeof read>[0], amount: number) =>
  provisionTillReference(db, context, {
    products: [],
    prices: [refPrice(products.ordinary.id, amount, { validFrom: "2025-12-01T00:00:00.000Z" })],
    taxRules: [],
  });

test("reading after a reference price change requotes, flags the change and writes nothing", async () => {
  await withTill(async (db) => {
    await world(db);
    const view = await add(db, 0, { code: bare });
    expect(view.quote).toMatchObject({ changed: false, totals: { gross: 12_000 } });
    await reprice(db, 15_000);
    const rows = await draftAudit(db);

    const read1 = await read(db);
    expect(read1.quote.changed).toBe(true);
    expect(read1.quote.totals.gross).toBe(15_000);
    expect(read1.quote.lines[0]?.tax).toMatchObject({ unitPrice: 15_000, gross: 15_000 });
    expect(read1.draft).toEqual(view.draft); // the stored draft is untouched by a read
    expect(await read(db)).toEqual(read1);
    expect(await draftAudit(db)).toEqual(rows);
  });
});

test("an unchanged reference never flags the quote, and the next edit stores the requoted totals", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: bare });
    expect((await read(db)).quote.changed).toBe(false);
    await reprice(db, 15_000);
    expect((await read(db)).quote.changed).toBe(true);
    const next = await add(db, 1, { code: bare });
    expect(next.quote).toMatchObject({ changed: false, totals: { gross: 30_000 } });
    expect((await read(db)).quote.changed).toBe(false);
  });
});

test("a price-label line keeps its encoded gross when the unit price changes", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: priceLabel });
    await provisionTillReference(db, context, {
      products: [],
      prices: [refPrice(products.weighed.id, 45_000, { validFrom: "2025-12-01T00:00:00.000Z" })],
      taxRules: [],
    });
    const view = await read(db);
    expect(view.quote.lines[0]?.tax.gross).toBe(10_000);
    expect(view.quote.totals.gross).toBe(10_000);
    expect(view.draft?.lines[0]?.label).toMatchObject({ kind: "price", gross: 10_000 });
  });
});

test("a cashier removes a line without approval and the audit row records no approver", async () => {
  await withTill(async (db) => {
    await world(db);
    const first = await add(db, 0, { code: bare });
    const second = await add(db, 1, { productId: products.weighed.id, quantityThousandths: 1000 });
    const [keep, drop] = second.draft?.lines ?? [];
    expect(keep?.id).toBe(first.draft?.lines[0]?.id);
    const view = await removeDraftLine(db, ctx, {
      scope,
      expectedRevision: 2,
      at,
      lineId: drop?.id ?? "",
    });
    expect(view.draft?.lines.map((l) => l.id)).toEqual([keep?.id]);
    expect(view.quote.totals.gross).toBe(12_000);
    const removal = (await draftAudit(db)).at(-1);
    expect(removal).toMatchObject({
      command: "till.draft.remove",
      role: "Cashier",
      actorId: ids.cashier,
      approverId: null,
      reason: null,
    });
    await expectChain(db);
  });
});

test("a line whose product was archived is flagged with its error code and left out of the totals", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: bare });
    await add(db, 1, { productId: products.weighed.id, quantityThousandths: 1000 });
    await provisionTillReference(db, context, {
      products: [{ ...products.ordinary, archivedAt: "2025-12-01T00:00:00.000Z" }],
      prices: [],
      taxRules: [],
    });
    const view = await read(db);
    expect(view.quote.changed).toBe(true);
    expect(view.quote.lines[0]).toMatchObject({
      productId: products.ordinary.id,
      error: "PRODUCT_UNKNOWN",
    });
    expect(view.quote.lines[0]).not.toHaveProperty("tax");
    expect(view.quote.totals.gross).toBe(30_000);
    expect(view.draft?.lines).toHaveLength(2);
  });
});
