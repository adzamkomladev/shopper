import { and, eq, inArray, sql } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { boxMove, exportJob, type ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";
import { requestArchiveExport } from "../archive/request";
import { ImportError } from "../import/error";

/** The statuses in which the cloud org only reads: from the start of a move, and for good once it is archived. */
export const LEAVING = ["open", "claimed", "archived"] as const;

/**
 * An owner moves the shop onto its own box. From this row on the cloud org only reads (the archive's snapshot is
 * taken next, and nothing after it would reach the box); the archive is Day 41's, sealed by its Workflow.
 */
export async function startOnPremMove(
  db: ShopperDatabase,
  context: CommandContext,
  launcher: WorkflowLauncher,
) {
  const jobId = v7();
  await openOnPremMove(db, context, { jobId });
  await requestArchiveExport(db, context, launcher, jobId);
  return { exportJobId: jobId };
}

/** The org's move with its archive's state, or undefined when it never started one. */
export async function getOnPremMove(db: ShopperDatabase, orgId: string) {
  const [row] = await db
    .select({ move: boxMove, archive: exportJob.status })
    .from(boxMove)
    .leftJoin(
      exportJob,
      and(eq(exportJob.orgId, boxMove.orgId), eq(exportJob.id, boxMove.exportJobId)),
    )
    .where(eq(boxMove.orgId, orgId));
  return row && { ...row.move, archive: row.archive ?? "failed" };
}

/** The move that keeps the org read-only (open, claimed or archived), if any. */
export async function leavingMove(db: Pick<ShopperDatabase, "select">, orgId: string) {
  const [row] = await db
    .select()
    .from(boxMove)
    .where(and(eq(boxMove.orgId, orgId), inArray(boxMove.status, [...LEAVING])));
  return row;
}

const openOnPremMove = defineCommand({
  name: "migration.onprem.start",
  async run(tx, ctx, input: { jobId: string }) {
    if (await leavingMove(tx, ctx.orgId))
      throw new ImportError("This shop is already moving to its own box.", 409);
    const fresh = {
      status: "open" as const,
      requestedBy: ctx.actorId ?? null,
      exportJobId: input.jobId,
      licenceId: null,
      licence: null,
      boxUpstream: null,
      relocations: {},
      report: null,
      error: null,
      completedAt: null,
    };
    const [row] = await tx
      .insert(boxMove)
      .values({ orgId: ctx.orgId, ...fresh })
      .onConflictDoUpdate({
        target: boxMove.orgId,
        set: { id: sql`uuidv7()`, ...fresh, updatedAt: sql`now()` },
      })
      .returning({ id: boxMove.id });
    return { moveId: row!.id };
  },
  audit: (input, output) => ({ moveId: output.moveId, exportJobId: input.jobId }),
});

/** The owner calls the move off before it is archived: the org takes changes again and the box's codes are void. */
export const cancelOnPremMove = defineCommand({
  name: "migration.onprem.cancel",
  async run(tx, ctx) {
    const [row] = await tx
      .update(boxMove)
      .set({ status: "cancelled", relocations: {}, updatedAt: sql`now()` })
      .where(and(eq(boxMove.orgId, ctx.orgId), inArray(boxMove.status, ["open", "claimed"])))
      .returning({ id: boxMove.id });
    if (!row) throw new ImportError("There is no move to call off.", 409);
    return { moveId: row.id };
  },
  audit: (_input: Record<string, never>, output) => ({ moveId: output.moveId }),
});
