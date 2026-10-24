// Notion Day 18: "A rate change dated tomorrow does not touch today's sales". A super admin schedules a new rate
// for tomorrow; sales already made keep their snapshots byte for byte, today's sales still use today's rule, the
// till quotes the new rate only from tomorrow in Accra, and the server refuses a today-dated sale carrying it.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { saleLine } from "@shopper/db-pg";
import { createTaxRule } from "@shopper/core/tax";
import { ghanaDate, provisionTillReference, quoteLine } from "@shopper/core/till";
import { snapshotLine } from "@shopper/tax";
import { goldenReferences, products } from "../../../fixtures/sales/golden/references";
import { goldenWorld } from "../../../support/sales/golden/setup";
import { ringGolden, runGolden } from "../../../support/sales/golden/run";
import { api } from "../../../support/till/server";
import { pushEvents } from "../../../support/till/requests";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
});

const rice = {
  name: "dated rule",
  lines: [{ product: "standard" as const }],
  tenders: [{ kind: "cash" as const, amount: 120_000 }],
};
const storedLines = async () =>
  (
    await world.db
      .select()
      .from(saleLine)
      .where(eq(saleLine.orgId, world.scope.orgId))
      .orderBy(asc(saleLine.id))
  ).map((row) => JSON.stringify(row.payload));
const tomorrow = ghanaDate(new Date(Date.now() + 86_400_000));

test("A rate change dated tomorrow does not touch today's sales", async () => {
  const today = goldenReferences.taxRules[0]!;
  await runGolden(world, rice);
  const before = await storedLines();
  expect(before.length).toBeGreaterThan(0);

  const scheduled = await createTaxRule(world.db, world.command, {
    body: {
      effectiveFrom: tomorrow,
      vatBps: 1_250,
      nhilBps: 250,
      getfundBps: 250,
      covidBps: 0,
      source: "Integration: VAT cut to 12.5%",
    },
  });
  // The till pulls the new rule beside today's.
  await provisionTillReference(world.local, world.command, {
    products: [],
    prices: [],
    taxRules: [scheduled],
    cashRounding: "10p",
  });

  expect(await storedLines()).toEqual(before);
  const sold = (await runGolden(world, rice))!;
  expect(sold.lines[0]!.tax.rule).toMatchObject({ id: today.id, vatBps: 1_500 });
  expect(sold.lines[0]!.tax.vat).toBe(15_000);
  expect((await storedLines()).slice(0, before.length)).toEqual(before);

  const quote = (at: string) =>
    quoteLine(world.local, {
      orgId: world.scope.orgId,
      branchId: world.scope.branchId,
      productId: products.standard.id,
      quantityThousandths: 1_000,
      at: new Date(at),
    });
  // Accra is UTC all year: the new rate starts at midnight UTC on its date, and not a second before.
  expect((await quote(`${tomorrow}T00:00:00.000Z`)).tax.rule.id).toBe(scheduled.id);
  expect((await quote(`${tomorrow}T00:00:00.000Z`)).tax.vat).toBe(
    snapshotLine({
      rule: scheduled,
      on: tomorrow,
      taxClass: "standard",
      priceMode: "inclusive",
      registered: true,
      unitPrice: products.standard.amount as never,
      quantityThousandths: 1_000,
    }).vat,
  );
  expect(
    (await quote(new Date(new Date(`${tomorrow}T00:00:00.000Z`).valueOf() - 1).toISOString())).tax
      .rule.id,
  ).toBe(today.id);

  // A today-dated sale that claims tomorrow's rule is refused.
  const forged = (await ringGolden(world, rice))!;
  const line = forged.sale.lines[0]!;
  // Taxed as if it were tomorrow, then dated back to today.
  line.tax = { ...snapshotLine({ ...line.tax, rule: scheduled, on: tomorrow }), on: line.tax.on };
  const { base, vat, nhil, getfund, covid, gross, roundingAdjustment } = line.tax;
  forged.sale.totals = { base, vat, nhil, getfund, covid, gross, roundingAdjustment };
  const response = await pushEvents(
    api,
    [forged],
    [{ sessionId: world.session.id, proof: world.session.proof }],
  );
  expect(await response.json()).toMatchObject({
    accepted: [],
    rejected: [{ localId: forged.sale.localId }],
  });
});
