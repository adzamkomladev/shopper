import * as v from "valibot";
import type { Workflow } from "@shopper/ports";
import { exportArchiveId, exportPrefix } from "../archive/ids";
import { failArchiveExport } from "../archive/fail";
import { sealArchiveExport } from "../archive/seal";
import { dumpOrg } from "../dump/org";
import { archiveExportParams } from "../schemas/archive";
import type { ArchiveExportDeps } from "../types";

const policy = { maxAttempts: 3, delayMs: 2000, backoff: "exponential" } as const;

/**
 * One full copy of an org: a snapshot written as parts, then sealed with a signature. A step that fails for good marks
 * the archive failed (with the reason) before the workflow ends, so the owner sees an answer, not a spinner.
 */
export async function runArchiveExport(
  flow: Pick<Workflow, "instanceId" | "step">,
  deps: ArchiveExportDeps,
  raw: unknown,
) {
  const params = v.parse(archiveExportParams, raw);
  if (flow.instanceId !== exportArchiveId(params.orgId, params.jobId))
    throw new Error("Archive export instance must be its archive key");
  const context = { orgId: params.orgId, appVersion: deps.appVersion };
  const checkpoint = (step: string, status: "running" | "completed" | "failed") => ({
    instanceId: flow.instanceId,
    businessKey: flow.instanceId,
    type: "export-archive",
    step,
    status,
  });
  try {
    await flow.step("dump", policy, () =>
      deps.withDatabase(async (db) => {
        const prefix = exportPrefix(params.jobId);
        const dumped = await dumpOrg(db, {
          orgId: params.orgId,
          blobs: deps.blobs,
          prefix,
        });
        // Kept in storage, not in the step's output: a large business has thousands of parts.
        await deps.blobs.put(
          params.orgId,
          `${prefix}/files.json`,
          new TextEncoder().encode(JSON.stringify(dumped)),
        );
        return { files: dumped.files.length };
      }),
    );
    await flow.step("seal", policy, () =>
      deps.withDatabase((db) =>
        sealArchiveExport(
          db,
          context,
          {
            jobId: params.jobId,
            blobs: deps.blobs,
            at: (deps.now?.() ?? new Date()).toISOString(),
          },
          checkpoint("seal", "completed"),
        ),
      ),
    );
  } catch (error) {
    await flow.step("fail", policy, () =>
      deps.withDatabase((db) =>
        failArchiveExport(
          db,
          context,
          { jobId: params.jobId, reason: error instanceof Error ? error.message : String(error) },
          checkpoint("fail", "failed"),
        ),
      ),
    );
    throw error;
  }
}
