import { v7 } from "uuid";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";
import type { CommandContext } from "@shopper/audit";
import { failArchiveExport } from "./fail";
import { exportArchiveId } from "./ids";
import { startArchiveExport } from "./start";

/** Records the request (audited) and starts its workflow; if the engine cannot take it the archive says so, not spins. */
export async function requestArchiveExport(
  db: ShopperDatabase,
  context: CommandContext,
  launcher: WorkflowLauncher,
) {
  const jobId = v7();
  const instanceId = exportArchiveId(context.orgId, jobId);
  await startArchiveExport(
    db,
    context,
    { jobId },
    {
      instanceId,
      businessKey: instanceId,
      type: "export-archive",
      step: "start",
      status: "running",
    },
  );
  await launcher
    .start(instanceId, { orgId: context.orgId, jobId })
    .catch(async (error: unknown) => {
      await failArchiveExport(db, context, { jobId, reason: "The export could not be started." });
      throw error;
    });
  return { id: jobId };
}
