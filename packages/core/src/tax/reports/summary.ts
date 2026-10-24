import { and, eq, inArray } from "drizzle-orm";
import { branch } from "@shopper/db-pg";
import type { TaxClass } from "@shopper/tax";
import type { Queryable } from "../../types";
import { addParts, foldTax } from "./fold";
import type { TaxRange } from "../../schemas/tax/returns";

/**
 * Tax by period, branch and class for an Accra date range: what sales charged, what credit notes gave back, and the
 * net of the two.
 */
export async function taxSummary(db: Queryable, orgId: string, range: TaxRange) {
  const lines = await foldTax(db, orgId, range);
  const keys = [
    ...new Set(lines.map((line) => `${line.period}|${line.branchId}|${line.taxClass}`)),
  ];
  const ids = [...new Set(lines.map((line) => line.branchId))];
  const names = ids.length
    ? await db
        .select({ id: branch.id, name: branch.name })
        .from(branch)
        .where(and(eq(branch.orgId, orgId), inArray(branch.id, ids)))
    : [];
  const rows = keys.map((key) => {
    const [period, branchId, taxClass] = key.split("|") as [string, string, TaxClass];
    const of = (kind: "sale" | "credit") =>
      addParts(
        lines.filter(
          (line) =>
            line.kind === kind &&
            line.period === period &&
            line.branchId === branchId &&
            line.taxClass === taxClass,
        ),
      );
    return {
      period,
      branchId,
      branchName: names.find((row) => row.id === branchId)?.name ?? branchId,
      taxClass,
      sales: of("sale"),
      creditNotes: of("credit"),
    };
  });
  return { ...range, rows };
}
