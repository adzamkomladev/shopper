// Unpaid drafts: embedded-label lines stay separate, keep their label, and edit by integer ratio or requote.
import { expect, test } from "vite-plus/test";
import { setDraftQuantity } from "@shopper/core/till";
import { ean13 } from "../../../../support/till/basket";
import {
  add,
  at,
  bare,
  ctx,
  expectChain,
  priceLabel,
  products,
  read,
  scope,
  weightLabel,
  withTill,
  world,
} from "../../../../support/till/drafts";

const edit = (
  db: Parameters<typeof read>[0],
  expectedRevision: number,
  lineId: string,
  quantityThousandths: number,
) => setDraftQuantity(db, ctx, { scope, expectedRevision, at, lineId, quantityThousandths });

test("each weight-label scan is its own line and keeps the label code", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: weightLabel });
    const view = await add(db, 1, { code: weightLabel });
    expect(view.draft?.lines).toHaveLength(2);
    for (const line of view.draft?.lines ?? [])
      expect(line).toMatchObject({
        productId: products.weighed.id,
        quantityThousandths: 500,
        label: { kind: "weight", code: weightLabel },
      });
    expect(view.draft?.lines[0]?.label).not.toHaveProperty("gross");
    expect(view.draft?.lines[0]?.id).not.toBe(view.draft?.lines[1]?.id);
    expect(view.quote.totals.gross).toBe(30_000);
  });
});

test("each price-label scan is its own line that keeps the encoded gross, never unit price x quantity", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: priceLabel });
    const view = await add(db, 1, { code: priceLabel });
    expect(view.draft?.lines).toHaveLength(2);
    for (const line of view.draft?.lines ?? [])
      expect(line).toMatchObject({
        quantityThousandths: 333,
        label: { kind: "price", code: priceLabel, gross: 10_000 },
      });
    expect(view.quote.lines.map((l) => l.tax?.gross)).toEqual([10_000, 10_000]);
    expect(view.quote.totals.gross).toBe(20_000);
  });
});

test("label lines and ordinary lines of the same product coexist in scan order", async () => {
  await withTill(async (db) => {
    await world(db);
    await add(db, 0, { code: bare });
    await add(db, 1, { code: priceLabel });
    const view = await add(db, 2, { code: bare });
    expect(
      view.draft?.lines.map((l) => [l.productId, l.quantityThousandths, l.label?.kind]),
    ).toEqual([
      [products.ordinary.id, 2000, undefined],
      [products.weighed.id, 333, "price"],
    ]);
  });
});

test("editing a price-label quantity scales the encoded gross by integer ratio and exposes it in the quote", async () => {
  await withTill(async (db) => {
    await world(db);
    const first = await add(db, 0, { code: priceLabel });
    const lineId = first.draft?.lines[0]?.id ?? "";
    const up = await edit(db, 1, lineId, 500);
    expect(up.draft?.lines[0]).toMatchObject({
      quantityThousandths: 500,
      label: { kind: "price", gross: 10_000 },
    });
    expect(up.quote.lines[0]?.tax?.gross).toBe(15_015); // 10 000 x 500 / 333, half-up
    expect(up.quote.totals.gross).toBe(15_015);
    expect(up.quote.totals).toEqual(
      Object.fromEntries(
        Object.keys(up.quote.totals).map((key) => [
          key,
          up.quote.lines.reduce(
            (sum, l) => sum + (l.tax as unknown as Record<string, number>)[key]!,
            0,
          ),
        ]),
      ),
    );
    const doubled = await edit(db, 2, lineId, 666);
    expect(doubled.quote.totals.gross).toBe(20_000);
    const back = await edit(db, 3, lineId, 333);
    expect(back.quote.totals.gross).toBe(10_000); // no drift from repeated edits
    expect(await read(db)).toEqual(back);
    await expectChain(db);
  });
});

test("editing a weight-label quantity requotes the product at its unit price", async () => {
  await withTill(async (db) => {
    await world(db);
    const first = await add(db, 0, { code: weightLabel });
    const lineId = first.draft?.lines[0]?.id ?? "";
    expect(first.quote.totals.gross).toBe(15_000);
    const view = await edit(db, 1, lineId, 2000);
    expect(view.draft?.lines[0]).toMatchObject({
      quantityThousandths: 2000,
      label: { kind: "weight", code: weightLabel },
    });
    expect(view.quote.totals.gross).toBe(60_000);
    expect(view.quote.lines[0]?.tax?.gross).toBe(60_000);
  });
});

test("an unreadable label is rejected without touching the draft", async () => {
  await withTill(async (db) => {
    await world(db);
    const view = await add(db, 0, { code: bare });
    const badChecksum = `${weightLabel.slice(0, 12)}${(Number(weightLabel[12]) + 1) % 10}`;
    await expect(add(db, 1, { code: badChecksum })).rejects.toMatchObject({
      name: "TillError",
      code: "CHECKSUM_INVALID",
    });
    await expect(add(db, 1, { code: ean13("230000000000") })).rejects.toMatchObject({
      code: "MAPPING_MISSING",
    });
    expect(await read(db)).toEqual(view);
  });
});
