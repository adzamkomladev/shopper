// Notion Day 18: "VAT return worksheet equals the sum of line snapshots for the fixture month". The worksheet for
// October folds every October sale line's tax snapshot by class, less October's credit notes, and nothing from
// September; the Excel export carries the same figures, and the input tax the accountant claims sets the balance.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { refund, refundLine, sale, saleLine } from "@shopper/db-pg";
import { readVatReturn, setVatReturnInput, taxSummary, vatReturnWorkbook } from "@shopper/core/tax";
import { toDecimal, type Money } from "@shopper/money";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { postRefund, refundEvent } from "../../support/sales/refunds";

let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld({ since: "2026-09-29T00:00:00.000Z" });
});
afterAll(async () => {
  await world?.local.close();
});

const basket: GoldenSale = {
  name: "worksheet",
  lines: [
    { product: "standard", quantity: 3_000 },
    { product: "standard", discount: 20_000 },
    { product: "zero", quantity: 2_000 },
    { product: "exempt" },
  ],
  tenders: [{ kind: "cash", amount: 600_000 }],
};
const rice: GoldenSale = {
  name: "boundary",
  lines: [{ product: "standard" }],
  tenders: [{ kind: "cash", amount: 120_000 }],
};
type Parts = { base: number; vat: number; nhil: number; getfund: number; covid: number };
const parts = ["base", "vat", "nhil", "getfund", "covid"] as const;
/** The worksheet names a class's base its value. */
const asRow = (folded: Parts) => ({
  value: folded.base,
  vat: folded.vat,
  nhil: folded.nhil,
  getfund: folded.getfund,
  covid: folded.covid,
});

/** The month's line snapshots as stored, folded by tax class: the test's own sum, read straight from the rows. */
async function fold(month: string) {
  const sold = await world.db
    .select({ payload: saleLine.payload })
    .from(saleLine)
    .innerJoin(sale, and(eq(sale.orgId, saleLine.orgId), eq(sale.id, saleLine.saleId)))
    .where(eq(sale.orgId, world.scope.orgId));
  const returned = await world.db
    .select({
      payload: refundLine.payload,
      on: sql<string>`to_char(${refund.occurredAt} AT TIME ZONE 'Africa/Accra', 'YYYY-MM-DD')`,
    })
    .from(refundLine)
    .innerJoin(refund, and(eq(refund.orgId, refundLine.orgId), eq(refund.id, refundLine.refundId)))
    .where(eq(refund.orgId, world.scope.orgId));
  const sum = (rows: { tax: Parts & { taxClass: string } }[], taxClass: string) =>
    Object.fromEntries(
      parts.map((part) => [
        part,
        rows
          .filter((row) => row.tax.taxClass === taxClass)
          .reduce((total, row) => total + row.tax[part], 0),
      ]),
    ) as Parts;
  const sales = sold
    .map((row) => row.payload as { tax: Parts & { taxClass: string; on: string } })
    .filter((line) => line.tax.on.startsWith(month));
  const credits = returned
    .filter((row) => row.on.startsWith(month))
    .map((row) => row.payload as { tax: Parts & { taxClass: string } });
  return {
    standard: sum(sales, "standard"),
    zero: sum(sales, "zero-rated").base,
    exempt: sum(sales, "exempt").base,
    credits: sum(credits, "standard"),
    lines: sales.length,
  };
}

test("VAT return worksheet equals the sum of line snapshots for the fixture month", async () => {
  const october = (await runGolden(world, basket))!;
  // Accra is UTC all year: midnight on the 1st is October's, a minute before is September's.
  await runGolden(world, rice, new Date("2026-10-01T00:00:00.000Z"));
  await runGolden(world, rice, new Date("2026-09-30T23:59:00.000Z"));
  const event = refundEvent(world, october, [{ line: 0, before: 0, after: 1_000 }]);
  expect((await postRefund(event, world.session.proof)).body.accepted).toBeTruthy();

  const expected = await fold("2026-10");
  expect(expected.lines).toBe(october.lines.length + 1);
  const worksheet = await readVatReturn(world.db, world.scope.orgId, "2026-10");
  expect(worksheet).toMatchObject({
    period: "2026-10",
    standard: asRow(expected.standard),
    zeroRated: expected.zero,
    exempt: expected.exempt,
    creditNotes: asRow(expected.credits),
    output: {
      vat: expected.standard.vat - expected.credits.vat,
      nhil: expected.standard.nhil - expected.credits.nhil,
      getfund: expected.standard.getfund - expected.credits.getfund,
      covid: expected.standard.covid - expected.credits.covid,
    },
    input: { vat: 0, nhil: 0, getfund: 0 },
  });
  expect(worksheet.standard.vat).toBeGreaterThan(0);
  expect(worksheet.creditNotes.vat).toBeGreaterThan(0);
  const output =
    worksheet.output.vat +
    worksheet.output.nhil +
    worksheet.output.getfund +
    worksheet.output.covid;
  expect(worksheet.payable).toBe(output);

  // September holds only the sale made a minute before midnight.
  const september = await fold("2026-09");
  expect(september.lines).toBe(1);
  expect((await readVatReturn(world.db, world.scope.orgId, "2026-09")).standard).toEqual(
    asRow(september.standard),
  );

  // The input tax claimed lowers what is payable, and is audited.
  await setVatReturnInput(world.db, world.command, {
    period: "2026-10",
    body: { vat: 5_000, nhil: 1_000, getfund: 1_000 },
  });
  const claimed = await readVatReturn(world.db, world.scope.orgId, "2026-10");
  expect(claimed.input).toEqual({ vat: 5_000, nhil: 1_000, getfund: 1_000 });
  expect(claimed.payable).toBe(output - 7_000);

  // The workbook's VAT return sheet carries the same figures, label by label.
  const book = XLSX.read(await vatReturnWorkbook(world.db, world.scope.orgId, "2026-10"));
  expect(book.SheetNames).toEqual(["VAT return", "Sales by class", "Credit notes"]);
  const rows = XLSX.utils.sheet_to_json<[string, number]>(book.Sheets["VAT return"]!, {
    header: 1,
  });
  const cell = (label: string) => rows.find((row) => row[0] === label)?.[1];
  const ghs = (amount: number) => Number(toDecimal(amount as Money, 4));
  expect(cell("Standard-rated supplies")).toBe(ghs(worksheet.standard.value));
  expect(cell("Output VAT")).toBe(ghs(claimed.output.vat));
  expect(cell("NHIL")).toBe(ghs(claimed.output.nhil));
  expect(cell("GETFund levy")).toBe(ghs(claimed.output.getfund));
  expect(cell("Zero-rated supplies")).toBe(ghs(worksheet.zeroRated));
  expect(cell("Exempt supplies")).toBe(ghs(worksheet.exempt));
  expect(cell("Credit notes (standard-rated value)")).toBe(ghs(worksheet.creditNotes.value));
  expect(cell("Credit notes (zero-rated value)")).toBe(ghs(worksheet.creditNotes.zeroRated));
  expect(cell("Credit notes (exempt value)")).toBe(ghs(worksheet.creditNotes.exempt));
  expect(cell("Input VAT")).toBe(ghs(5_000));
  expect(cell("Net payable")).toBe(ghs(claimed.payable));
  const notes = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Credit notes"]!);
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatchObject({
    "Original invoice": october.receiptNumber,
    VAT: ghs(expected.credits.vat),
  });

  // The summary by class adds up to the same month.
  const summary = await taxSummary(world.db, world.scope.orgId, {
    from: "2026-10-01",
    to: "2026-10-31",
    group: "month",
  });
  const standard = summary.rows.find((row) => row.taxClass === "standard")!;
  expect(standard).toMatchObject({ period: "2026-10", branchId: world.scope.branchId });
  expect(standard.sales.vat).toBe(expected.standard.vat);
  expect(standard.creditNotes.vat).toBe(expected.credits.vat);
});
