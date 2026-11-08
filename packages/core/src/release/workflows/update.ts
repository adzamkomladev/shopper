import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import type { Json, Workflow, WorkflowCheckpoint } from "@shopper/ports";
import { boxUpdateParams } from "../schemas/updates";
import type { BoxUpdateDeps } from "../types";

const once = { maxAttempts: 1, delayMs: 0, backoff: "constant" } as const;

export const boxUpdateId = (orgId: string, at: string) =>
  `box-update_${orgId.toLowerCase()}_${Date.parse(at)}`;

/** An update scheduled after closing: sleeps to its time, then installs once. The row and the audit entry are the record. */
export async function runBoxUpdate(
  flow: Pick<Workflow, "instanceId" | "step" | "sleepUntil">,
  deps: BoxUpdateDeps,
  rawParams: unknown,
) {
  const params = v.parse(boxUpdateParams, rawParams);
  const context = { orgId: params.orgId, actorId: params.actorId, appVersion: deps.appVersion };
  await flow.sleepUntil("due", new Date(params.at));
  const outcome = await flow.step("apply", once, async () => {
    const result: {
      status: "started" | "failed" | "cancelled";
      version: string | null;
      message: string | null;
    } = await deps.apply(params.file, flow.instanceId).then(
      (applied) =>
        applied
          ? { status: "started", version: applied.version, message: null }
          : { status: "cancelled", version: null, message: null },
      (error: unknown) => ({ status: "failed", version: null, message: String(error) }),
    );
    await deps.withDatabase((db) =>
      recordUpdate(
        db,
        context,
        {
          file: params.file,
          status: result.status,
          version: result.version ?? undefined,
          message: result.message ?? undefined,
        },
        updateCheckpoint(
          flow.instanceId,
          "apply",
          result.status === "failed" ? "failed" : "completed",
        ),
      ),
    );
    return result;
  });
  if (outcome.status === "failed") throw new Error(String(outcome.message));
}

/** Records that an update was started, or why a scheduled one could not be. */
export const recordUpdate = defineCommand({
  name: "box.update.run",
  run: async (
    _tx,
    _context,
    input: {
      file: string;
      status: "started" | "failed" | "cancelled";
      version?: string;
      message?: string;
    },
  ) => input,
  audit: (input) => input,
});

/** Schedules an update and records the workflow as waiting, in one transaction with its audit entry. */
export const scheduleUpdate = defineCommand({
  name: "box.update.schedule",
  async run(
    _tx,
    context,
    input: {
      instanceId: string;
      file: string;
      at: string;
      launch: (id: string, params: Json) => Promise<void>;
    },
  ) {
    await input.launch(input.instanceId, {
      orgId: context.orgId,
      ...(context.actorId ? { actorId: context.actorId } : {}),
      file: input.file,
      at: input.at,
    });
    return { instanceId: input.instanceId, file: input.file, at: input.at };
  },
  audit: (_input, result) => result,
});

export function updateCheckpoint(
  instanceId: string,
  step: "schedule" | "apply",
  status: WorkflowCheckpoint["status"],
): WorkflowCheckpoint {
  return { instanceId, businessKey: instanceId, type: "box-update", step, status };
}
