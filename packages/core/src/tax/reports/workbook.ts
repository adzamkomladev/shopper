import { sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { fromBigInt, toDecimal, type Money } from "@shopper/money";
import type { Queryable } from "../../types";
import { taxSummary } from "./summary";
import { monthOf, readVatReturn } from "./worksheet";

/**
 * The month's VAT return as an Excel workbook for the accountant: the return itself in filing order, sales by
 * branch and class, and every credit note against its original invoice. Amounts are cedis, shown to the pesewa.
 */
export async function vatReturnWorkbook(db: Queryable, orgId: string, period: string) {
  const worksheet = await readVatReturn(db, orgId, period);
  const summary = await taxSummary(db, orgId, { ...monthOf(period), group: "month" });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    sheet([
      ["VAT return worksheet", period],
      ["From", worksheet.from],
      ["To", worksheet.to],
      [],
      ["Standard-rated supplies", ghs(worksheet.standard.value)],
      ["Zero-rated supplies", ghs(worksheet.zeroRated)],
      ["Exempt supplies", ghs(worksheet.exempt)],
      ["Credit notes (standard-rated value)", ghs(worksheet.creditNotes.value)],
      ["Credit notes (zero-rated value)", ghs(worksheet.creditNotes.zeroRated)],
      ["Credit notes (exempt value)", ghs(worksheet.creditNotes.exempt)],
      [],
      ["Output VAT", ghs(worksheet.output.vat)],
      ["NHIL", ghs(worksheet.output.nhil)],
      ["GETFund levy", ghs(worksheet.output.getfund)],
      ["COVID-19 levy", ghs(worksheet.output.covid)],
      [],
      ["Input VAT", ghs(worksheet.input.vat)],
      ["Input NHIL", ghs(worksheet.input.nhil)],
      ["Input GETFund levy", ghs(worksheet.input.getfund)],
      [],
      ["Net payable", ghs(worksheet.payable)],
    ]),
    "VAT return",
  );
  XLSX.utils.book_append_sheet(
    book,
    sheet([
      [
        "Branch",
        "Tax class",
        "Sales value",
        "VAT",
        "NHIL",
        "GETFund",
        "Credit notes value",
        "Credit notes VAT",
      ],
      ...summary.rows.map((row) => [
        row.branchName,
        row.taxClass,
        ghs(row.sales.base),
        ghs(row.sales.vat),
        ghs(row.sales.nhil),
        ghs(row.sales.getfund),
        ghs(row.creditNotes.base),
        ghs(row.creditNotes.vat),
      ]),
    ]),
    "Sales by class",
  );
  XLSX.utils.book_append_sheet(
    book,
    sheet([
      ["Credit note", "Original invoice", "Date", "Value", "VAT", "NHIL", "GETFund", "Total"],
      ...(await creditNotes(db, orgId, worksheet)).map((row) => [
        row.creditNote ?? "",
        row.invoice ?? "",
        row.day,
        ghs(fromBigInt(BigInt(row.base))),
        ghs(fromBigInt(BigInt(row.vat))),
        ghs(fromBigInt(BigInt(row.nhil))),
        ghs(fromBigInt(BigInt(row.getfund))),
        ghs(fromBigInt(BigInt(row.gross))),
      ]),
    ]),
    "Credit notes",
  );
  return new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
}

/** A cell holding cedis to four places, displayed to the pesewa: the decimal is written, never computed in floats. */
const ghs = (amount: Money): XLSX.CellObject => ({
  t: "n",
  v: Number(toDecimal(amount, 4)),
  z: "#,##0.00",
});

const sheet = (rows: (string | XLSX.CellObject)[][]) => XLSX.utils.aoa_to_sheet(rows);

async function creditNotes(db: Queryable, orgId: string, range: { from: string; to: string }) {
  const { rows } = await db.execute<{
    creditNote: string | null;
    invoice: string | null;
    day: string;
    base: string;
    vat: string;
    nhil: string;
    getfund: string;
    gross: string;
  }>(sql`
    SELECT r.credit_note_number AS "creditNote", s.receipt_number AS invoice,
      to_char(r.occurred_at AT TIME ZONE 'Africa/Accra', 'YYYY-MM-DD') AS day,
      ${sql.join(
        ["base", "vat", "nhil", "getfund", "gross"].map(
          (part) =>
            sql`coalesce(sum((rl.payload->'tax'->>${part})::bigint), 0)::text AS ${sql.identifier(part)}`,
        ),
        sql`, `,
      )}
    FROM refund r
      JOIN sale s ON s.org_id = r.org_id AND s.id = r.original_sale_id
      JOIN refund_line rl ON rl.org_id = r.org_id AND rl.refund_id = r.id
    WHERE r.org_id = ${orgId}
      AND to_char(r.occurred_at AT TIME ZONE 'Africa/Accra', 'YYYY-MM-DD') BETWEEN ${range.from} AND ${range.to}
    GROUP BY r.id, s.receipt_number
    ORDER BY r.occurred_at`);
  return rows;
}
