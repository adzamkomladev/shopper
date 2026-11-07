import * as v from "valibot";
import {
  retryDelay,
  retryPolicySchema,
  WorkflowTimeoutError,
  type Json,
  type Workflow,
} from "@shopper/ports";

/** The part of Rivet's workflow context the adapter uses (`rivetkit/workflow`). */
type RivetContext = {
  step<T>(config: {
    name: string;
    maxRetries?: number;
    timeout?: number;
    run: () => Promise<T>;
  }): Promise<T>;
  sleep(name: string, durationMs: number): Promise<void>;
  sleepUntil(name: string, timestampMs: number): Promise<void>;
  queue: {
    nextBatch(
      name: string,
      options: { names: string[]; count: number; timeout: number },
    ): Promise<Array<{ body: unknown }>>;
  };
};

type Outcome = { ok?: Json } | { error: string; name: string };

// Rivet suspends a workflow by throwing these; shared code must never catch one.
const ENGINE_ERRORS = new Set([
  "SleepError",
  "MessageWaitError",
  "EvictedError",
  "EntryInProgressError",
  "HistoryDivergedError",
  "CancelledError",
  "StepFailedError",
  "StepExhaustedError",
  "CriticalError",
  "RollbackError",
  "JoinError",
  "RaceError",
]);
const STEP_TIMEOUT_MS = 15 * 60_000;

/**
 * Runs a shared `run*` function on Rivet Workflows through the Workflow port. An engine suspension leaves the
 * shared code's promise pending and rejects this run instead, so a catch-all in shared code never mistakes it for a
 * failure; on resume Rivet replays the function and finished steps return their stored output.
 */
export async function runRivetFlow(
  ctx: RivetContext,
  instanceId: string,
  send: (instanceId: string, type: string, payload: Json) => Promise<void>,
  body: (flow: Workflow) => Promise<void>,
) {
  let escape: (error: unknown) => void = () => {};
  const escaped = new Promise<never>((_, reject) => (escape = reject));
  escaped.catch(() => {});
  const guard = <T>(promise: Promise<T>) =>
    promise.catch((error: unknown) => {
      if (!(error instanceof Error) || !ENGINE_ERRORS.has(error.name)) throw error;
      escape(error);
      return new Promise<T>(() => {});
    });
  // Rivet rejects a name used twice in one run; the port returns the first result, as the memory engine does.
  const seen = new Map<string, Promise<unknown>>();
  const once = <T>(name: string, run: () => Promise<T>) => {
    if (!name) throw new Error("Workflow entry name is required");
    const known = seen.get(name);
    if (known) return known as Promise<T>;
    const promise = run();
    seen.set(name, promise);
    return promise;
  };
  const compensations: Array<() => Promise<void>> = [];
  let compensated = false;
  let sends = 0;

  const flow: Workflow = {
    instanceId,
    step<T extends Json>(
      name: string,
      raw: Parameters<Workflow["step"]>[1],
      run: () => Promise<T>,
      compensate?: (output: T) => Promise<void>,
    ) {
      const policy = v.parse(retryPolicySchema, raw);
      return once(name, async () => {
        // Rivet never retries: the port's policy runs inside the step and a final failure is stored as data.
        const outcome = await guard(
          ctx.step<Outcome>({
            name,
            maxRetries: 0,
            timeout: STEP_TIMEOUT_MS,
            run: async () => {
              for (let attempt = 1; ; attempt += 1) {
                try {
                  return { ok: await run() };
                } catch (error) {
                  if (attempt >= policy.maxAttempts) return failure(error);
                  await new Promise((resolve) => setTimeout(resolve, retryDelay(policy, attempt)));
                }
              }
            },
          }),
        );
        if ("error" in outcome)
          throw Object.assign(new Error(outcome.error), { name: outcome.name });
        const output = outcome.ok as T;
        if (compensate) compensations.push(() => compensate(output));
        return output;
      });
    },
    sleep(name, durationMs) {
      if (!Number.isFinite(durationMs) || durationMs < 0)
        return Promise.reject(new RangeError("Workflow sleep duration must be non-negative"));
      return once(name, () => guard(ctx.sleep(name, durationMs)));
    },
    sleepUntil(name, instant) {
      if (!(instant instanceof Date) || Number.isNaN(instant.getTime()))
        return Promise.reject(new TypeError("Workflow sleepUntil requires a valid Date"));
      return once(name, () => guard(ctx.sleepUntil(name, instant.getTime())));
    },
    waitFor(name, type, timeoutMs) {
      if (!type) return Promise.reject(new Error("Workflow wait type is required"));
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0)
        return Promise.reject(new RangeError("Workflow timeout must be non-negative"));
      return once(name, async () => {
        const [message] = await guard(
          ctx.queue.nextBatch(name, { names: [type], count: 1, timeout: timeoutMs }),
        );
        if (!message) throw new WorkflowTimeoutError(instanceId, name, type, timeoutMs);
        return message.body as Json;
      });
    },
    async send(target, type, payload) {
      if (!target || !type) throw new Error("Workflow target and message type are required");
      // A step, so a replay does not send again.
      await guard(ctx.step({ name: `send-${++sends}`, run: () => send(target, type, payload) }));
    },
    async compensate() {
      if (compensated) return;
      compensated = true;
      for (const [index, undo] of compensations.reverse().entries())
        await guard(ctx.step({ name: `compensate-${index}`, run: undo }));
    },
  };
  await Promise.race([body(flow), escaped]);
}

function failure(error: unknown): Outcome {
  return error instanceof Error
    ? { error: error.message, name: error.name }
    : { error: String(error), name: "Error" };
}
