import type * as v from "valibot";
import type { Json, Workflow, WorkflowLauncher } from "@shopper/ports";
import type { BunWebSocketData } from "hono/bun";

export type BoxWebSocketServer = {
  upgrade(request: Request, options: { data: BunWebSocketData }): boolean;
};

/** A box workflow launcher on either engine. `idle` and `active` look at runs in this process (memory engine);
 * on Rivet the engine owns the runs, so `idle` returns at once and `active` is unknown. */
export type BoxLauncher = WorkflowLauncher & {
  idle: () => Promise<void>;
  active: (instanceId: string) => boolean | undefined;
};

/**
 * Gives a workflow kind its launcher on one engine; `loop` kinds treat a start while running as a wake. `schema`
 * refuses bad params at start; the run receives them as sent, since the shared `run*` functions parse their own.
 */
export type Launch = (
  kind: string,
  schema: v.GenericSchema,
  run: (flow: Workflow, params: Json) => Promise<void>,
  options?: { loop?: boolean },
) => BoxLauncher;
