import * as v from "valibot";
import { memoryWorkflow, workflowInstanceIdSchema } from "@shopper/ports";
import type { BoxLauncher, Launch } from "../types";

// Loop runs get a fresh engine key each time, so a second run never replays another run's steps.
let runs = 0;

/**
 * The in-process engine (`memoryWorkflow`): development, tests and a box without Rivet. A restart loses its timers;
 * PostgreSQL deadlines and the boot relaunches decide then. A one-shot id runs once (again only after it failed);
 * a loop id that is running takes a start as a wake and looks once more when it ends.
 */
export const memoryLaunch: Launch = (kind, schema, run, options = {}) => {
  const started = new Set<string>();
  const running = new Map<string, { engine: string; done: Promise<void> }>();
  const again = new Set<string>();
  const launcher: BoxLauncher = {
    async start(id, params) {
      v.parse(workflowInstanceIdSchema, id);
      v.parse(schema, params);
      const current = running.get(id);
      if (current && options.loop) {
        again.add(id);
        return memoryWorkflow(current.engine).send(current.engine, "wake", {});
      }
      if (current || (!options.loop && started.has(id))) return;
      started.add(id);
      const engine = options.loop ? `${id}_${++runs}` : id;
      const done = run({ ...memoryWorkflow(engine), instanceId: id }, params)
        .catch((error: unknown) => {
          started.delete(id);
          console.error({ event: `${kind}.failed`, instanceId: id, error });
        })
        .finally(() => {
          running.delete(id);
          // A wake that landed as the run was ending must not be lost: look once more.
          if (again.delete(id)) void launcher.start(id, params);
        });
      running.set(id, { engine, done });
    },
    async send(id, type, payload) {
      v.parse(workflowInstanceIdSchema, id);
      // One-shot events buffer until the wait; a loop that is not running has nobody to tell.
      const engine = options.loop ? running.get(id)?.engine : id;
      if (engine) await memoryWorkflow(engine).send(engine, type, payload);
    },
    async idle() {
      while (running.size) await Promise.all([...running.values()].map((entry) => entry.done));
    },
    active: (id) => running.has(id),
  };
  return launcher;
};
