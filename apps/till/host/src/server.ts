import { readFile } from "node:fs/promises";

let host:
  | Awaited<ReturnType<typeof import("@shopper/adapters-box/till").startTillHost>>
  | undefined;
let starting = false;
let stopped = false;
const ipc = typeof process.send === "function";
function stop() {
  stopped = true;
  parent?.dispose();
  void host?.close();
}
const send = (message: unknown) => {
  if (ipc) {
    if (!process.connected) stop();
    else
      process.send?.(message, (error) => {
        if (error) stop();
      });
  } else console.log(JSON.stringify(message));
};
let parent: ReturnType<typeof import("@shopper/adapters-box/till").parentRenderer> | undefined;
async function start(config: unknown, renderer?: unknown) {
  if (starting || stopped) return;
  starting = true;
  try {
    const { startTillHost, parentRenderer } = await import("@shopper/adapters-box/till");
    if (stopped || (ipc && !process.connected)) return;
    // Under Electron the parent renders receipts; otherwise the host renders them itself.
    if (renderer === "parent") parent = parentRenderer(send);
    host = await startTillHost(config, send, parent?.renderer);
    if (stopped) await host.close();
  } catch (error) {
    parent?.dispose();
    parent = undefined;
    send({ type: "error", code: "HOST_UNAVAILABLE", message: cause(error, config) });
    process.exitCode = 1;
    if (process.connected) process.disconnect?.();
  }
}
process.on("message", (message) => {
  if (
    !host &&
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "start" &&
    "config" in message
  )
    void start(message.config, "renderer" in message ? message.renderer : undefined);
  else if (parent?.receive(message)) return;
  else if (host) void host.receive(message);
});
process.on("disconnect", stop);
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
if (!ipc) {
  const path = process.argv[2];
  if (!path) throw new Error("Usage: node dist/server.js <private-host-config.json>");
  void readFile(path, "utf8")
    .then((data) => start(JSON.parse(data)))
    .catch(() => {
      console.error("Register configuration could not be read");
      process.exitCode = 1;
    });
}

/**
 * A short cause for the operator. Validation issues name the field and what it expects, never the value
 * received (Valibot echoes strings, such as a malformed token); any secret left in a message is masked.
 */
function cause(error: unknown, config: unknown) {
  type Issue = { path?: { key: unknown }[]; expected?: string | null; message: string };
  const issues =
    error instanceof Error && "issues" in error ? (error.issues as Issue[]) : undefined;
  let text = issues
    ? issues
        .map(({ path, expected, message }) => {
          const field = path?.map(({ key }) => String(key)).join(".") ?? "register.json";
          return `${field}: ${expected ? `expected ${expected}` : message}`;
        })
        .join("; ")
    : error instanceof Error
      ? error.message
      : String(error);
  const { deviceToken, databaseKey } = (config ?? {}) as Record<string, unknown>;
  for (const secret of [deviceToken, databaseKey])
    if (typeof secret === "string" && secret) text = text.replaceAll(secret, "[redacted]");
  return text;
}
