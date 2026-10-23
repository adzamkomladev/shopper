import * as v from "valibot";
import {
  memoryWorkflow,
  workflowInstanceIdSchema,
  type Json,
  type Workflow,
  type WorkflowLauncher,
} from "@shopper/ports";

/**
 * The box launcher for a workflow that loops until it has nothing to do (one per customer or org): start launches
 * it, or sends "wake" while it runs. Each run gets a fresh engine key, so one that ended starts again cleanly.
 */
export function boxLoopFlows<P extends Json>(
  name: string,
  schema: v.GenericSchema<unknown, P>,
  run: (flow: Workflow, params: P) => Promise<void>,
): WorkflowLauncher & { active(id: string): boolean } {
  const running = new Map<string, string>();
  const again = new Set<string>();
  let runs = 0;
  const launcher = {
    active: (id: string) => running.has(id),
    async start(id: string, raw: Json) {
      v.parse(workflowInstanceIdSchema, id);
      const params = v.parse(schema, raw);
      const key = running.get(id);
      if (key) {
        again.add(id);
        return memoryWorkflow(key).send(key, "wake", {});
      }
      const engine = `${id}_${++runs}`;
      running.set(id, engine);
      run({ ...memoryWorkflow(engine), instanceId: id }, params)
        .catch((error: unknown) =>
          console.error({ event: `${name}.failed`, instanceId: id, error }),
        )
        .finally(() => {
          running.delete(id);
          // A wake that landed as the run was ending must not be lost: look once more.
          if (again.delete(id)) void launcher.start(id, params);
        });
    },
    async send(id: string, type: string, payload: Json) {
      v.parse(workflowInstanceIdSchema, id);
      const key = running.get(id);
      if (key) await memoryWorkflow(key).send(key, type, payload);
    },
  };
  return launcher;
}
