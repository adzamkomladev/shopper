import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { v7 } from "uuid";
import { e2eRun } from "../../../../tooling/e2e/run";

const root = process.cwd();
const entry = resolve(root, `apps/till/host/${e2eRun.outDir}/server.js`);
type Message = Record<string, unknown>;
type Ready = Message & {
  type: "ready";
  port: number;
  capability: string;
  appVersion: string;
  protocol: number;
};

const clockPreload = resolve(root, "tests/support/till/host/clock.mjs");

/** `clockOffsetMs` starts the host with its wall clock shifted; `setClock` then moves it. */
export async function startTillHost(config: unknown, options: { clockOffsetMs?: number } = {}) {
  const clocked = options.clockOffsetMs !== undefined;
  const child = spawn(process.execPath, [...(clocked ? ["--import", clockPreload] : []), entry], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    env: clocked
      ? { ...process.env, SHOPPER_TEST_CLOCK_OFFSET_MS: String(options.clockOffsetMs) }
      : process.env,
  });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveExit) => {
      child.once("exit", (code, signal) => resolveExit({ code, signal }));
    },
  );
  const spawnError = new Promise<never>((_resolve, reject) => child.once("error", reject));
  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  const messages: Message[] = [];
  const waiters = new Set<(message: Message) => void>();
  child.on("message", (raw) => {
    if (!isMessage(raw)) return;
    const waiter = [...waiters].find((candidate) => candidate(raw));
    if (waiter) waiters.delete(waiter);
    else messages.push(raw);
  });
  const waitFor = (matches: (message: Message) => boolean, timeoutMs = 5_000) => {
    const index = messages.findIndex(matches);
    if (index >= 0) {
      const message = messages.splice(index, 1)[0];
      if (!message) throw new Error("Expected a queued host message");
      return Promise.resolve(message);
    }
    return new Promise<Message>((resolveMessage, reject) => {
      const timer = setTimeout(() => {
        waiters.delete(onMessage);
        reject(new Error(`Host message timed out. Output: ${output.join("")}`));
      }, timeoutMs);
      const onMessage = (message: Message) => {
        if (!matches(message)) return false;
        clearTimeout(timer);
        resolveMessage(message);
        return true;
      };
      waiters.add(onMessage);
    });
  };
  let rawReady: Message;
  try {
    const readyPromise = waitFor((message) => message.type === "ready", 30_000);
    child.send({ type: "start", config });
    const earlyExit = exited.then(({ code, signal }) => {
      throw new Error(
        `Host exited before ready (code ${code}, signal ${signal}). Output: ${output.join("")}`,
      );
    });
    rawReady = await Promise.race([readyPromise, earlyExit, spawnError]);
    if (
      rawReady.type !== "ready" ||
      typeof rawReady.port !== "number" ||
      typeof rawReady.capability !== "string" ||
      typeof rawReady.appVersion !== "string" ||
      typeof rawReady.protocol !== "number"
    )
      throw new Error("Host returned an invalid ready message");
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    if (child.pid) await exited;
    throw error;
  }
  const ready = rawReady as Ready;
  return {
    child,
    ready,
    output,
    waitForStatus(matches: (status: Record<string, unknown>) => boolean) {
      return waitFor(
        (message) =>
          message.type === "status" && isMessage(message.status) && matches(message.status),
      );
    },
    /** Moves the host's wall clock to `offsetMs` from real time; needs a host started with `clockOffsetMs`. */
    async setClock(offsetMs: number) {
      if (!clocked) throw new Error("Start the host with clockOffsetMs to move its clock");
      const id = v7();
      child.send({ type: "test.clock", id, offsetMs });
      await waitFor((reply) => reply.type === "test.clock.set" && reply.id === id);
      // The host also answers the unknown message; drop that reply.
      await waitFor((reply) => reply.id === id && reply.type === "error", 1_000).catch(
        () => undefined,
      );
    },
    async request(message: Message, timeoutMs?: number) {
      const id = typeof message.id === "string" ? message.id : v7();
      child.send({ ...message, id });
      return waitFor(
        (reply) => reply.id === id && (reply.type === "result" || reply.type === "error"),
        timeoutMs,
      );
    },
    async stop() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const id = v7();
      try {
        child.send({ id, type: "shutdown" });
      } catch (error) {
        child.kill("SIGKILL");
        await exited;
        throw error;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        exited,
        new Promise((resolveExit) => {
          timer = setTimeout(resolveExit, 3_000);
        }),
      ]);
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
    },
    kill() {
      if (child.exitCode !== null || child.signalCode !== null) return exited;
      child.kill("SIGKILL");
      return exited;
    },
  };
}

function isMessage(value: unknown): value is Message {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
