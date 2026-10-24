// The tax engine follows the org's tax settings: tills quote in the org's price mode, a shop that is not
// VAT-registered charges no VAT or levies, and the server accepts a sale only when its lines say the same.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { org } from "@shopper/db-pg";
import { mulRate, mulRatio, money } from "@shopper/money";
import { quoteLine } from "@shopper/core/till";
import { snapshotLine } from "@shopper/tax";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { products } from "../../fixtures/sales/golden/references";
import { goldenWorld } from "../../support/sales/golden/setup";
import { ringGolden, runGolden } from "../../support/sales/golden/run";
import { api } from "../../support/till/server";
import { pushEvents } from "../../support/till/requests";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});
afterEach(async () => {
  await serverSettings({ priceMode: "inclusive", vatRegisteredFrom: "2026-01-01" });
});

const serverSettings = (settings: Partial<typeof org.$inferInsert>) =>
  world.db.update(org).set(settings).where(eq(org.id, world.scope.orgId));
const rice = (over: Partial<GoldenSale["lines"][number]> = {}) => ({
  product: "standard" as const,
  ...over,
});
const sale = (lines: GoldenSale["lines"], pay: number, settings?: GoldenSale["settings"]) => ({
  name: "tax engine",
  lines,
  tenders: [{ kind: "cash" as const, amount: pay }],
  settings,
});
async function rejected(scenario: GoldenSale) {
  const event = (await ringGolden(world, scenario))!;
  const response = await pushEvents(
    api,
    [event],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    accepted: [],
    rejected: [{ localId: event.sale.localId }],
  });
}

test("an exclusive price list adds VAT, NHIL and GETFund on top of the shelf price", async () => {
  await serverSettings({ priceMode: "exclusive" });
  const sold = (await runGolden(world, sale([rice()], 150_000, { priceMode: "exclusive" })))!;
  expect(sold.lines[0]!.tax).toMatchObject({
    priceMode: "exclusive",
    registered: true,
    base: 120_000,
    vat: 18_000,
    nhil: 3_000,
    getfund: 3_000,
    covid: 0,
    gross: 144_000,
  });
  expect(sold.totals.gross).toBe(144_000);
});

test("a discount comes off the price before tax, inclusive and exclusive", async () => {
  const inclusive = (await runGolden(world, sale([rice({ discount: 20_000 })], 100_000)))!;
  const tax = inclusive.lines[0]!.tax;
  expect(tax.discount).toBe(20_000);
  expect(tax.base).toBe(mulRatio(money(100_000), 10_000, 12_000));
  expect(tax.vat).toBe(mulRate(tax.base, 1_500));
  expect(tax.gross).toBe(100_000);

  await serverSettings({ priceMode: "exclusive" });
  const exclusive = (await runGolden(
    world,
    sale([rice({ discount: 20_000 })], 120_000, { priceMode: "exclusive" }),
  ))!;
  expect(exclusive.lines[0]!.tax).toMatchObject({
    base: 100_000,
    vat: 15_000,
    nhil: 2_500,
    getfund: 2_500,
    gross: 120_000,
  });
});

test("a shop that is not VAT-registered charges no VAT or levies, and says so on each line", async () => {
  await serverSettings({ vatRegisteredFrom: null });
  const sold = (await runGolden(
    world,
    sale([rice(), { product: "zero" }], 150_000, { vatRegisteredFrom: null }),
  ))!;
  for (const line of sold.lines)
    expect(line.tax).toMatchObject({ registered: false, vat: 0, nhil: 0, getfund: 0, covid: 0 });
  expect(sold.lines[0]!.tax).toMatchObject({ base: 120_000, gross: 120_000 });
});

test("the server refuses lines whose registration differs from the shop's on the sale date", async () => {
  // The till still thinks the shop is registered.
  await serverSettings({ vatRegisteredFrom: null });
  await rejected(sale([rice()], 120_000));
  // The till thinks it is not, but the shop is.
  await serverSettings({ vatRegisteredFrom: "2026-01-01" });
  await rejected(sale([rice()], 120_000, { vatRegisteredFrom: null }));
});

test("the server refuses a price mode its arithmetic does not match", async () => {
  const event = (await ringGolden(world, sale([rice()], 120_000)))!;
  const line = event.sale.lines[0]!;
  // Claim the inclusive figures were exclusive.
  line.tax = { ...line.tax, priceMode: "exclusive" };
  const response = await pushEvents(
    api,
    [event],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(await response.json()).toMatchObject({ accepted: [], rejected: [{}] });
  // A registered shop's line forged to carry no tax is refused too.
  const forged = (await ringGolden(world, sale([rice()], 120_000)))!;
  const taxed = forged.sale.lines[0]!;
  taxed.tax = snapshotLine({ ...taxed.tax, registered: false });
  const { base, vat, nhil, getfund, covid, gross, roundingAdjustment } = taxed.tax;
  forged.sale.totals = { base, vat, nhil, getfund, covid, gross, roundingAdjustment };
  const refused = await pushEvents(
    api,
    [forged],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(await refused.json()).toMatchObject({ accepted: [], rejected: [{}] });
});

test("registration dated tomorrow leaves today untaxed and taxes tomorrow's quote", async () => {
  await serverSettings({ vatRegisteredFrom: "2026-10-16" });
  const today = (await runGolden(
    world,
    sale([rice()], 120_000, { vatRegisteredFrom: "2026-10-16" }),
  ))!;
  expect(today.lines[0]!.tax).toMatchObject({ registered: false, vat: 0 });
  const tomorrow = await quoteLine(world.local, {
    orgId: world.scope.orgId,
    branchId: world.scope.branchId,
    productId: products.standard.id,
    quantityThousandths: 1_000,
    at: new Date("2026-10-16T00:00:00.000Z"),
  });
  expect(tomorrow.tax).toMatchObject({ registered: true, vat: 15_000, gross: 120_000 });
});
