import * as v from "valibot";
import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { reportCsv, reportCsvRows, reportWorkbook, type ReportCell } from "@shopper/core/reports";
import { org } from "@shopper/db-pg";
import { entityExport, entityRange, rangedEntities, type entityNames } from "../schemas/entities";
import { ExportError } from "../archive/error";
import { catalogueEntities } from "./catalogue";
import type { DayRange } from "../types";
import { countRows, entityPages } from "./read";
import { tradingEntities } from "./trading";

const definitions = { ...catalogueEntities, ...tradingEntities };
const files = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const encoder = new TextEncoder();

/** Counts the rows (and refuses an Excel sheet too long to open) in the transaction that writes the audit row. */
const audited = defineCommand({
  name: "export.entity",
  async run(tx, ctx, input: v.InferOutput<typeof entityExport> & { range?: DayRange }) {
    const rows = await countRows(tx, definitions[input.entity], ctx.orgId, input.range);
    if (input.format === "xlsx" && rows > input.maxWorkbookRows)
      throw new ExportError(
        "too_many_rows",
        "Too many rows for Excel. Use CSV, or the full archive.",
      );
    const [business] = await tx.select({ slug: org.slug }).from(org).where(eq(org.id, ctx.orgId));
    return {
      entity: input.entity,
      format: input.format,
      ...input.range,
      rows,
      slug: business!.slug,
    };
  },
  // No undefined values: audit payloads are canonical JSON, so an unranged export simply has no range keys.
  audit: (_input, output) => ({
    entity: output.entity,
    format: output.format,
    rows: output.rows,
    ...(output.from && { from: output.from, to: output.to }),
  }),
});

/**
 * One entity as a CSV (streamed, any size) or Excel file. Every export is an audited command; a history entity
 * (sales, lines, tenders, audit) takes a day range of at most a year, the lists are as of now.
 */
export async function exportEntity(
  db: Parameters<typeof audited>[0],
  context: Parameters<typeof audited>[1],
  raw: v.InferInput<typeof entityExport>,
) {
  const input = v.parse(entityExport, raw);
  const ranged = rangedEntities.includes(input.entity);
  const range = ranged ? v.parse(entityRange, { from: input.from, to: input.to }) : undefined;
  const counted = await audited(db, context, {
    ...input,
    range: range && { from: range.from, to: range.to },
  });
  const def = definitions[input.entity];
  const table = { name: title(input.entity), headers: def.columns.map((c) => c.header), rows: [] };
  const pages = () =>
    entityPages(
      db,
      def,
      context.orgId,
      counted.from ? { from: counted.from, to: counted.to! } : undefined,
      input.pageRows,
      counted.rows,
    );
  const filename = [counted.slug, input.entity, counted.from, counted.to].filter(Boolean).join("-");
  const body =
    input.format === "csv"
      ? csvStream(reportCsv(table), pages())
      : reportWorkbook({ ...table, rows: await collect(pages()) });
  return {
    filename: `${filename}.${input.format}`,
    contentType: files[input.format],
    rows: counted.rows,
    body,
  };
}

const title = (entity: (typeof entityNames)[number]) => entity[0]!.toUpperCase() + entity.slice(1);

async function collect(pages: AsyncGenerator<ReportCell[][]>) {
  const rows: ReportCell[][] = [];
  for await (const page of pages) rows.push(...page);
  return rows;
}

function csvStream(header: string, pages: AsyncGenerator<ReportCell[][]>) {
  let started = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        started = true;
        return controller.enqueue(encoder.encode(header));
      }
      const next = await pages.next();
      if (next.done) return controller.close();
      controller.enqueue(encoder.encode(reportCsvRows(next.value)));
    },
    cancel: () => void pages.return(undefined),
  });
}
