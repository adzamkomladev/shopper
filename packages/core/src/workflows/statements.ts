import * as v from "valibot";
import type { Workflow } from "@shopper/ports";
import {
  fanOutStatements,
  readStatementSettings,
  statementRunDue,
} from "../customers/statements/schedule";
import { statementFlowParams } from "../schemas/customers/statements";
import type { StatementFlowDeps } from "./types";
import { MAX_WAIT_MS, woken } from "./wait";
export type { StatementFlowDeps } from "./types";

const policy = { maxAttempts: 5, delayMs: 1000, backoff: "exponential" } as const;

/**
 * One org's statement schedule: sleep until the run day (a "wake" after a settings change looks again), fan the
 * period's statements out through the queue, repeat; end once the schedule is off.
 */
export async function runStatementSchedule(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: StatementFlowDeps,
  raw: unknown,
) {
  const { orgId, actorId } = v.parse(statementFlowParams, raw);
  if (orgId !== flow.instanceId)
    throw new Error("Statement schedule instance must equal its org id");
  const context = { orgId, actorId, appVersion: deps.appVersion, queue: deps.queue };
  // Runs follow the last one, not the clock, so a wake that arrives late never skips a run day.
  let since = await flow.step("start", policy, async () => Date.now());
  for (let tick = 0; ; tick++) {
    const after = since;
    const due = await flow.step(`due-${tick}`, policy, () =>
      deps.withDatabase(
        async (db) =>
          statementRunDue(await readStatementSettings(db, orgId), new Date(after))?.getTime() ??
          null,
      ),
    );
    if (due === null) break;
    const wait = due - Date.now();
    if (
      wait > 0 &&
      ((await woken(flow, `wait-${tick}`, Math.min(wait, MAX_WAIT_MS))) || wait > MAX_WAIT_MS)
    )
      continue;
    await flow.step(`run-${tick}`, policy, () =>
      deps.withDatabase((db) => fanOutStatements(db, context, { at: new Date(due) })),
    );
    since = due;
  }
}
