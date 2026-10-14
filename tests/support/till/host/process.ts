import { execFileSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import { v7 } from "uuid";

const root = process.cwd();
const entry = resolve(root, "apps/till/host/dist/server.js");
let build: Promise<void> | undefined;
type Message = Record<string, unknown>;
type Ready = Message & {
  type: "ready";
  port: number;
  capability: string;
  appVersion: string;
  protocol: number;
};

export async function startTillHost(config: unknown) {
  build ??= Promise.resolve().then(() => {
    execFileSync(
      "vp",
      ["-C", "apps/till/host", "exec", "node", "../../../tooling/build/server.mjs", "till-host"],
      {
        cwd: root,
        stdio: "pipe",
      },
    );
  });
  await build;
  const child = spawn(process.execPath, [entry], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe", "ipc"],
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
    async request(message: Message) {
      const id = typeof message.id === "string" ? message.id : v7();
      child.send({ ...message, id });
      return waitFor(
        (reply) => reply.id === id && (reply.type === "result" || reply.type === "error"),
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
