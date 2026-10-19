// Refunds are their own records. Each refund line's tax is the difference of two cumulative pro-rata
// amounts of the SOLD line's snapshot, so partial refunds always sum to the original line exactly.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { refund, refundLine, taxRule } from "@shopper/db-pg";
import { mulRatio } from "@shopper/money";
import type { GoldenSale } from "../../../fixtures/sales/golden/types";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { runGolden } from "../../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../../support/sales/refunds";

const scenario: GoldenSale = {
  name: "refund tax",
  lines: [
    { product: "standard", quantity: 3_000 },
    { product: "up", quantity: 7_000 },
  ],
  tenders: [{ kind: "cash", amount: 500_000 }],
};
const parts = ["base", "vat", "nhil", "getfund", "covid", "gross", "discount"] as const;
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

const sold = async () => (await runGolden(world, scenario))!;
const cumulative = (amount: number, x: number, q: number) =>
  x === q ? amount : Number(mulRatio(amount as never, x, q));
async function savedLines(refundId: string) {
  const rows = await world.db
    .select()
    .from(refundLine)
    .where(eq(refundLine.refundId, refundId))
    .orderBy(asc(refundLine.createdAt));
  return rows.map((row) => row.payload as Record<string, any>);
}

test("Partial refund reverses exactly the refunded lines' tax", async () => {
  const sale = await sold();
  const event = refundEvent(world, sale, [
    { line: 0, before: 0, after: 1_000 },
    { line: 1, before: 0, after: 2_500 },
  ]);
  const { body } = await postRefund(event, world.session.proof);
  expect(body.accepted).toMatchObject({ id: event.refund.id });
  const saved = await savedLines(event.refund.id);
  expect(saved).toHaveLength(2);
  for (const [index, [line, quantity]] of [
    [0, 1_000],
    [1, 2_500],
  ].entries()) {
    const original = sale.lines[line!]!.tax;
    const q = original.quantityThousandths;
    for (const part of parts)
      expect(saved[index]!.tax[part], `${part} of line ${line}`).toBe(
        cumulative(original[part], quantity!, q),
      );
    expect(saved[index]!.tax.quantityThousandths).toBe(quantity);
    expect(saved[index]!.tax.roundingAdjustment).toBe(
      saved[index]!.tax.gross -
        (saved[index]!.tax.base +
          saved[index]!.tax.vat +
          saved[index]!.tax.nhil +
          saved[index]!.tax.getfund +
          saved[index]!.tax.covid),
    );
  }
  const [header] = await world.db.select().from(refund).where(eq(refund.id, event.refund.id));
  expect(header?.gross).toBe(saved.reduce((sum, l) => sum + l.tax.gross, 0));
});

test("two partial refunds of one line sum to the line's original tax and gross exactly", async () => {
  const sale = await sold();
  const original = sale.lines[1]!.tax;
  const first = refundEvent(world, sale, [{ line: 1, before: 0, after: 2_500 }]);
  const second = refundEvent(world, sale, [{ line: 1, before: 2_500, after: 7_000 }]);
  for (const event of [first, second])
    expect((await postRefund(event, world.session.proof)).body.accepted).toBeDefined();
  const rows = [...(await savedLines(first.refund.id)), ...(await savedLines(second.refund.id))];
  for (const part of [...parts, "quantityThousandths"] as const)
    expect(
      rows.reduce((sum, row) => sum + row.tax[part], 0),
      part,
    ).toBe(original[part]);
  for (const row of rows) for (const part of parts) expect(row.tax[part]).toBeGreaterThanOrEqual(0);
});

test("refund tax uses the sale's snapshot after a new tax rule takes effect", async () => {
  const sale = await sold();
  await world.db
    .insert(taxRule)
    .values({
      orgId: world.scope.orgId,
      effectiveFrom: "2026-10-16",
      vatBps: 2_500,
      nhilBps: 500,
      getfundBps: 500,
      covidBps: 100,
      source: "refund test",
    })
    .onConflictDoNothing();
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }]);
  expect((await postRefund(event, world.session.proof)).body.accepted).toBeDefined();
  const [saved] = await savedLines(event.refund.id);
  const original = sale.lines[0]!.tax;
  expect(saved!.tax.rule).toEqual(original.rule);
  expect(saved!.tax.on).toBe(original.on);
  for (const part of parts)
    expect(saved!.tax[part]).toBe(cumulative(original[part], 1_000, original.quantityThousandths));
});

test("a cash refund's rounding is accepted when within 5p of the gross, whatever was paid before", async () => {
  const sale = await sold();
  const event = refundEvent(world, sale, [{ line: 0, before: 0, after: 1_000 }], {
    tender: { kind: "cash" },
  });
  const pay = (rounding: number) => {
    const changed = structuredClone(event);
    changed.refund.id = v7();
    changed.refund.cashRounding = rounding as never;
    changed.refund.total = (changed.refund.totals.gross + rounding) as never;
    return postRefund(changed, world.session.proof);
  };
  expect((await pay(-300)).body.rejected).toBeUndefined();
  expect((await pay(600)).body.rejected).toMatchObject({ code: "INVALID_TOTALS" });
  const card = structuredClone(event);
  card.refund.tender = { kind: "card", reference: "CARD-1" } as never;
  card.refund.cashRounding = 100 as never;
  card.refund.total = (card.refund.totals.gross + 100) as never;
  expect((await postRefund(card, world.session.proof)).body.rejected).toMatchObject({
    code: "INVALID_TOTALS",
  });
});
