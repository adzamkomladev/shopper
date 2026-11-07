import * as v from "valibot";
import { actor, setup } from "rivetkit";
import { createClient } from "rivetkit/client";
import { Loop, workflow } from "rivetkit/workflow";
import {
  workflowInstanceIdSchema,
  type Json,
  type Workflow,
  type WorkflowLauncher,
} from "@shopper/ports";
import { runRivetFlow } from "./flow";

type Launch = { kind: string; params: Json };
type Handler = { loop: boolean; run: (flow: Workflow, params: Json) => Promise<void> };

// Kinds this process runs. A replayed actor can wake before its kind registers at boot; it waits for it.
const handlers = new Map<string, Handler>();
const registered = new Map<string, Array<(handler: Handler) => void>>();
const handlerFor = (kind: string) =>
  handlers.get(kind) ??
  new Promise<Handler>((resolve) =>
    registered.set(kind, [...(registered.get(kind) ?? []), resolve]),
  );

/** One actor per workflow instance (keyed by its id): `start` records the launch, the run executes it. */
const flow = actor({
  state: { launched: false },
  actions: {
    async start(c, launch: Launch, loop: boolean) {
      if (c.state.launched && !loop) return;
      c.state.launched = true;
      await c.queue.send("start", launch);
      // A loop that is running treats a start as a wake; the start itself makes it look once more after.
      if (loop) await c.queue.send("wake", {});
    },
    // A client may only send to queues the actor declares; event types are open, so the actor enqueues them.
    async deliver(c, type: string, payload: Json) {
      await c.queue.send(type, payload);
    },
  },
  run: workflow(async (ctx) => {
    const instanceId = ctx.key[0]!;
    const first = (await ctx.queue.next("start", { names: ["start"] })).body as Launch;
    const handler = await handlerFor(first.kind);
    const run = (step: typeof ctx, params: Json) =>
      runRivetFlow(step, instanceId, send, (flow) => handler.run(flow, params));
    if (!handler.loop) return run(ctx, first.params);
    await ctx.loop({
      name: "passes",
      state: first.params,
      run: async (pass, params) => {
        // Starts and wakes queued before this pass are answered by it. A zero timeout returns before reading them.
        await pass.queue.nextBatch("queued", {
          names: ["start", "wake"],
          count: 1_000,
          timeout: 100,
        });
        await run(pass, params);
        const next = (await pass.queue.next("next", { names: ["start"] })).body as Launch;
        return Loop.continue(next.params);
      },
    });
  }),
});

let current: ReturnType<typeof start> | undefined;
let send: (instanceId: string, type: string, payload: Json) => Promise<void> = async () => {};

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
  const handle = (id: string) => client.flow.getOrCreate([v.parse(workflowInstanceIdSchema, id)]);
  send = (id, type, payload) => ready(() => handle(id).deliver(type, payload));
  return {
    pool: config.pool,
    client,
    launch<P extends Json>(
      kind: string,
      schema: v.GenericSchema<unknown, P>,
      run: (flow: Workflow, params: P) => Promise<void>,
      options: { loop?: boolean } = {},
    ): WorkflowLauncher {
      const handler = {
        loop: !!options.loop,
        run: (flow: Workflow, raw: Json) => run(flow, v.parse(schema, raw)),
      };
      handlers.set(kind, handler);
      for (const resolve of registered.get(kind) ?? []) resolve(handler);
      registered.delete(kind);
      return {
        start: (id, params) =>
          ready(() => handle(id).start({ kind, params: v.parse(schema, params) }, handler.loop)),
        send,
      };
    },
  };
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
