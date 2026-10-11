import * as v from "valibot";
import type { Json, RetryPolicy, Workflow } from "./index";

type Timer = ReturnType<typeof setTimeout>;

type Waiter = {
  resolve: (payload: Json) => void;
  reject: (error: unknown) => void;
  timer: Timer;
};

type WorkflowState = {
  steps: Map<string, Json>;
  runningSteps: Map<string, Promise<Json>>;
  sleeps: Set<string>;
  runningSleeps: Map<string, Promise<void>>;
  waits: Map<string, Json>;
  runningWaits: Map<string, Promise<Json>>;
  messages: Map<string, Json[]>;
  waiters: Map<string, Waiter[]>;
  compensations: Array<() => Promise<void>>;
  compensated: boolean;
};

const workflowStates = new Map<string, WorkflowState>();
const policySchema = v.object({
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(1)),
  delayMs: v.pipe(v.number(), v.integer(), v.minValue(0)),
  backoff: v.picklist(["constant", "linear", "exponential"]),
});

export class WorkflowTimeoutError extends Error {
  constructor(
    readonly instanceId: string,
    readonly name: string,
    readonly type: string,
    readonly timeoutMs: number,
  ) {
    super(`Workflow ${instanceId} timed out waiting for ${type} at ${name}`);
    this.name = "WorkflowTimeoutError";
  }
}

function stateFor(instanceId: string): WorkflowState {
  let state = workflowStates.get(instanceId);
  if (!state) {
    state = {
      steps: new Map(),
      runningSteps: new Map(),
      sleeps: new Set(),
      runningSleeps: new Map(),
      waits: new Map(),
      runningWaits: new Map(),
      messages: new Map(),
      waiters: new Map(),
      compensations: [],
      compensated: false,
    };
    workflowStates.set(instanceId, state);
  }
  return state;
}

async function pause(delayMs: number): Promise<void> {
  if (delayMs === 0) {
    await Promise.resolve();
    return;
  }
  // setTimeout fires at once past 2^31-1 ms (~24.8 days), so long sleeps wait in chunks.
  for (let remaining = delayMs; remaining > 0; remaining -= MAX_TIMER_MS)
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(remaining, MAX_TIMER_MS)));
}
const MAX_TIMER_MS = 2 ** 31 - 1;

function retryDelay(policy: RetryPolicy, attempt: number): number {
  if (policy.backoff === "constant") return policy.delayMs;
  if (policy.backoff === "linear") return policy.delayMs * attempt;
  return policy.delayMs * 2 ** (attempt - 1);
}

async function runWithRetry<T extends Json>(
  policy: RetryPolicy,
  run: () => Promise<T>,
): Promise<T> {
  let attempt = 1;
  while (true) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= policy.maxAttempts) throw error;
      await pause(retryDelay(policy, attempt));
      attempt += 1;
    }
  }
}

function removeWaiter(waiters: Waiter[], waiter: Waiter): void {
  const index = waiters.indexOf(waiter);
  if (index >= 0) waiters.splice(index, 1);
}

/**
 * A portable workflow engine for development and contract conformance.
 * Durable Cloudflare/Rivet execution can replace this behind the same port.
 */
export function memoryWorkflow(instanceId: string): Workflow {
  if (!instanceId) throw new Error("Workflow instance id is required");
  const state = stateFor(instanceId);
  const sleep = async (name: string, durationMs: number): Promise<void> => {
    if (!name) throw new Error("Workflow sleep name is required");
    if (!Number.isFinite(durationMs) || durationMs < 0)
      throw new RangeError("Workflow sleep duration must be non-negative");
    if (state.sleeps.has(name)) return;
    const running = state.runningSleeps.get(name);
    if (running) return running;
    const promise = pause(durationMs)
      .then(() => {
        state.sleeps.add(name);
      })
      .finally(() => state.runningSleeps.delete(name));
    state.runningSleeps.set(name, promise);
    return promise;
  };

  return {
    instanceId,
    async step<T extends Json>(
      name: string,
      rawPolicy: RetryPolicy,
      run: () => Promise<T>,
      compensate?: (output: T) => Promise<void>,
    ) {
      if (!name) throw new Error("Workflow step name is required");
      const policy = v.parse(policySchema, rawPolicy);
      const existing = state.steps.get(name);
      if (existing !== undefined || state.steps.has(name)) return existing as T;
      const running = state.runningSteps.get(name);
      if (running) return running as Promise<T>;
      const promise = runWithRetry(policy, run)
        .then((output) => {
          state.steps.set(name, output);
          if (compensate) state.compensations.push(() => compensate(output));
          return output;
        })
        .finally(() => state.runningSteps.delete(name));
      state.runningSteps.set(name, promise as Promise<Json>);
      return promise;
    },
    sleep,
    async sleepUntil(name, instant) {
      if (!(instant instanceof Date) || Number.isNaN(instant.getTime()))
        throw new TypeError("Workflow sleepUntil requires a valid Date");
      await sleep(name, Math.max(0, instant.getTime() - Date.now()));
    },
    waitFor(name: string, type: string, timeoutMs: number): Promise<Json> {
      if (!name || !type)
        return Promise.reject(new Error("Workflow wait name and type are required"));
      if (!Number.isFinite(timeoutMs) || timeoutMs < 0)
        return Promise.reject(new RangeError("Workflow timeout must be non-negative"));
      const existing = state.waits.get(name);
      if (existing !== undefined || state.waits.has(name)) return Promise.resolve(existing as Json);
      const running = state.runningWaits.get(name);
      if (running) return running;
      const promise = new Promise<Json>((resolve, reject) => {
        const queued = state.messages.get(type);
        const payload = queued?.shift();
        if (payload !== undefined || (queued?.length === 0 && payload === null)) {
          state.waits.set(name, payload as Json);
          resolve(payload as Json);
          return;
        }
        const waiters = state.waiters.get(type) ?? [];
        const waiter: Waiter = {
          resolve: (value) => {
            clearTimeout(waiter.timer);
            state.waits.set(name, value);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(waiter.timer);
            reject(error);
          },
          timer: setTimeout(() => {
            removeWaiter(waiters, waiter);
            reject(new WorkflowTimeoutError(instanceId, name, type, timeoutMs));
          }, timeoutMs),
        };
        waiters.push(waiter);
        state.waiters.set(type, waiters);
      }).finally(() => state.runningWaits.delete(name));
      state.runningWaits.set(name, promise);
      return promise;
    },
    async send(targetInstanceId, type, payload) {
      if (!targetInstanceId || !type)
        throw new Error("Workflow target and message type are required");
      const target = stateFor(targetInstanceId);
      const waiters = target.waiters.get(type);
      const waiter = waiters?.shift();
      if (waiter) {
        waiter.resolve(payload);
        if (waiters && waiters.length === 0) target.waiters.delete(type);
        return;
      }
      const messages = target.messages.get(type) ?? [];
      messages.push(payload);
      target.messages.set(type, messages);
    },
    async compensate() {
      if (state.compensated) return;
      state.compensated = true;
      for (const undo of state.compensations.reverse()) await undo();
    },
  };
}
