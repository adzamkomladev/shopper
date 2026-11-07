import * as v from "valibot";
import { actor, setup } from "rivetkit";
import { createClient } from "rivetkit/client";
import { Loop, workflow } from "rivetkit/workflow";
import { workflowInstanceIdSchema, type Json, type Workflow } from "@shopper/ports";
import type { Launch } from "../types";
import { runRivetFlow } from "./flow";

type Handler = { loop: boolean; run: (flow: Workflow, params: Json) => Promise<void> };

// Kinds this process runs. A replayed actor can wake before its kind registers at boot; it waits for it.
const handlers = new Map<string, Handler>();
const registered = new Map<string, Array<(handler: Handler) => void>>();
const handlerFor = (kind: string) =>
  handlers.get(kind) ??
  new Promise<Handler>((resolve) =>
    registered.set(kind, [...(registered.get(kind) ?? []), resolve]),
  );

/** One actor per workflow instance, keyed `[kind, id]`: `start` records the launch, the run executes it. */
const flow = actor({
  state: { launched: false },
  actions: {
    async start(c, params: Json, loop: boolean) {
      if (c.state.launched && !loop) return;
      c.state.launched = true;
      await c.queue.send("start", params);
      // A loop that is running treats a start as a wake; the start itself makes it look once more after.
      if (loop) await c.queue.send("wake", {});
    },
    // A client may only send to queues the actor declares; event types are open, so the actor enqueues them.
    async deliver(c, type: string, payload: Json) {
      await c.queue.send(type, payload);
    },
  },
  run: workflow(async (ctx) => {
    const [kind, instanceId] = ctx.key as [string, string];
    const first = (await ctx.queue.next("start", { names: ["start"] })).body as Json;
    const handler = await handlerFor(kind);
    // Workflow.send reaches an instance of the same kind; no shared workflow sends across kinds.
    const run = (step: typeof ctx, params: Json) =>
      runRivetFlow(
        step,
        instanceId,
        (id, type, payload) => send(kind, id, type, payload),
        (flow) => handler.run(flow, params),
      );
    if (!handler.loop) return run(ctx, first);
    await ctx.loop({
      name: "passes",
      state: first,
      run: async (pass, params) => {
        // Starts and wakes queued before this pass are answered by it. A zero timeout returns before reading them.
        await pass.queue.nextBatch("queued", {
          names: ["start", "wake"],
          count: 1_000,
          timeout: 100,
        });
        await run(pass, params);
        const next = (await pass.queue.next("next", { names: ["start"] })).body as Json;
        return Loop.continue(next);
      },
    });
  }),
});

let current: ReturnType<typeof start> | undefined;
let send: (
  kind: string,
  instanceId: string,
  type: string,
  payload: Json,
) => Promise<void> = async () => {};

/**
 * The box's Rivet runner, one per process: connects to the engine and runs this process's actors in `pool`.
 * `launch` gives each workflow kind a launcher whose instances run on Rivet Workflows.
 */
export function rivetHost(config: {
  endpoint: string;
  token: string;
  namespace: string;
  pool: string;
}) {
  current ??= start(config);
  if (current.pool !== config.pool) throw new Error("One Rivet host per process");
  return current;
}

function start(config: { endpoint: string; token: string; namespace: string; pool: string }) {
  const engine = { endpoint: config.endpoint, token: config.token, namespace: config.namespace };
  const registry = setup({
    use: { flow },
    ...engine,
    noWelcome: true,
    logging: { level: "warn" },
    node: { poolName: config.pool },
  });
  registry.start();
  const client = createClient<typeof registry>({ ...engine, poolName: config.pool });
  const handle = (kind: string, id: string) =>
    client.flow.getOrCreate([kind, v.parse(workflowInstanceIdSchema, id)]);
  send = (kind, id, type, payload) => ready(() => handle(kind, id).deliver(type, payload));
  const launch: Launch = (kind, schema, run, options = {}) => {
    const handler = { loop: !!options.loop, run };
    handlers.set(kind, handler);
    for (const resolve of registered.get(kind) ?? []) resolve(handler);
    registered.delete(kind);
    return {
      async start(id, params) {
        v.parse(schema, params);
        await ready(() => handle(kind, id).start(params, handler.loop));
      },
      send: (id, type, payload) => send(kind, id, type, payload),
      // The engine owns the runs: nothing in this process to wait for or look at.
      idle: async () => {},
      active: () => undefined,
    };
  };
  return { pool: config.pool, launch };
}

// The engine answers "service unavailable" until this process's runner has connected.
async function ready<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "service_unavailable" || attempt >= 100) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
