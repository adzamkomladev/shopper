import { and, eq, sql } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import type { Licence } from "@shopper/core/licence";
import { boxMove, type ShopperDatabase } from "@shopper/db-pg";
import { ImportError } from "../import/error";
import { compareReports } from "../reconcile/compare";
import { reconciliationReport } from "../reconcile/report";
import type { ReconciliationReport } from "../types";

/**
 * The box's account of what arrived, set against the same report over the cloud's frozen rows. All green archives the
 * cloud org for good and lets its registers relocate; anything else is kept for the owner to read, and the move waits.
 */
export async function verifyOnPremMove(
  db: ShopperDatabase,
  appVersion: string,
  input: { licence: Licence; report: ReconciliationReport },
) {
  const orgId = input.licence.org;
  const [move] = await db.select().from(boxMove).where(eq(boxMove.orgId, orgId));
  if (move && move.licenceId !== input.licence.id)
    throw new ImportError("This licence was not issued for this move.", 403);
  // Already verified: the box never heard the answer and asks again; the agreed report is the answer.
  const agreed = move?.report as ReturnType<typeof compareReports> | null | undefined;
  if (move?.status === "archived" && agreed?.ok) return agreed;
  if (move?.status !== "claimed")
    throw new ImportError("This shop has no move waiting for its report.", 409);
  const cloud = await reconciliationReport(db, orgId, {
    auditUpTo: input.report.auditUpTo ?? undefined,
  });
  const result = compareReports(cloud, input.report);
  await recordReport(db, { orgId, appVersion }, { moveId: move.id, result });
  return result;
}

const recordReport = defineCommand({
  name: "migration.onprem.verify",
  async run(tx, _ctx, input: { moveId: string; result: ReturnType<typeof compareReports> }) {
    const updated = await tx
      .update(boxMove)
      .set({
        report: input.result,
        ...(input.result.ok ? { status: "archived" as const, completedAt: sql`now()` } : {}),
        updatedAt: sql`now()`,
      })
      // Called off while the cloud was counting: the report describes a move that is no longer on.
      .where(and(eq(boxMove.id, input.moveId), eq(boxMove.status, "claimed")))
      .returning({ id: boxMove.id });
    if (!updated.length) throw new ImportError("This move was called off.", 409);
    return { ok: input.result.ok };
  },
  audit: (input) => ({
    moveId: input.moveId,
    ok: input.result.ok,
    tables: input.result.tables.length,
    mismatched: input.result.tables.filter((row) => !row.ok).map((row) => row.table),
    days: input.result.days.filter((row) => !row.ok).map((row) => row.day),
  }),
});
