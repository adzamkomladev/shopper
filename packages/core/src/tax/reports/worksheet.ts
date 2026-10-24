import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { vatReturn } from "@shopper/db-pg";
import { add, money, sub, type Money } from "@shopper/money";
import { vatPeriodSchema, vatReturnInput } from "../../schemas/tax/returns";
import type { Queryable } from "../../types";
import { addParts, foldTax } from "./fold";
import type { TaxParts } from "../types";

/**
 * The VAT return worksheet for one month: standard-rated, zero-rated and exempt supplies and the output tax folded
 * from the month's sale lines, less the month's credit notes, less the input tax the accountant claims. Lines a shop
 * sold while not VAT-registered carry no tax and are not on the return.
 */
export async function readVatReturn(db: Queryable, orgId: string, rawPeriod: string) {
  const period = v.parse(vatPeriodSchema, rawPeriod);
  const lines = (await foldTax(db, orgId, { ...monthOf(period), group: "month" })).filter(
    (line) => line.registered,
  );
  const of = (kind: "sale" | "credit", taxClass: string) =>
    addParts(lines.filter((line) => line.kind === kind && line.taxClass === taxClass));
  const standard = of("sale", "standard");
  const credits = of("credit", "standard");
  const output = {
    vat: sub(standard.vat, credits.vat),
    nhil: sub(standard.nhil, credits.nhil),
    getfund: sub(standard.getfund, credits.getfund),
    covid: sub(standard.covid, credits.covid),
  };
  const input = await readInput(db, orgId, period);
  const claimed = [input.vat, input.nhil, input.getfund].reduce(add, money(0));
  return {
    period,
    ...monthOf(period),
    standard: supplies(standard),
    zeroRated: of("sale", "zero-rated").base,
    exempt: of("sale", "exempt").base,
    creditNotes: {
      ...supplies(credits),
      zeroRated: of("credit", "zero-rated").base,
      exempt: of("credit", "exempt").base,
    },
    output,
    input,
    payable: sub(
      [output.vat, output.nhil, output.getfund, output.covid].reduce(add, money(0)),
      claimed,
    ),
  };
}

/** Records the input tax claimed for a period; the worksheet's balance follows. */
export const setVatReturnInput = defineCommand({
  name: "tax.return.input",
  async run(tx, ctx, input: { period: string; body: unknown }) {
    const period = v.parse(vatPeriodSchema, input.period);
    const claimed = v.parse(vatReturnInput, input.body);
    const before = await readInput(tx, ctx.orgId, period);
    const values = {
      inputVat: money(claimed.vat),
      inputNhil: money(claimed.nhil),
      inputGetfund: money(claimed.getfund),
    };
    await tx
      .insert(vatReturn)
      .values({ orgId: ctx.orgId, period, ...values })
      .onConflictDoUpdate({
        target: [vatReturn.orgId, vatReturn.period],
        set: { ...values, updatedAt: new Date() },
      });
    return { period, before, after: claimed };
  },
  audit: (_input, output) => ({ ...output }),
  details: (_input, output) => ({
    entity: "vat_return",
    before: output.before,
    after: output.after,
  }),
});

async function readInput(db: Queryable, orgId: string, period: string) {
  const [row] = await db
    .select()
    .from(vatReturn)
    .where(and(eq(vatReturn.orgId, orgId), eq(vatReturn.period, period)));
  return {
    vat: row?.inputVat ?? money(0),
    nhil: row?.inputNhil ?? money(0),
    getfund: row?.inputGetfund ?? money(0),
  };
}

/** A class's supplies as the return lists them: the value before tax, then each tax. */
const supplies = (
  parts: TaxParts,
): Record<"value" | "vat" | "nhil" | "getfund" | "covid", Money> => ({
  value: parts.base,
  vat: parts.vat,
  nhil: parts.nhil,
  getfund: parts.getfund,
  covid: parts.covid,
});

/** The first and last Accra date of a YYYY-MM month. */
export function monthOf(period: string) {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` };
}
