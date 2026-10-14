import { readFile } from "node:fs/promises";

let host:
  | Awaited<ReturnType<typeof import("@shopper/adapters-box/till").startTillHost>>
  | undefined;
let starting = false;
let stopped = false;
const ipc = typeof process.send === "function";
function stop() {
  stopped = true;
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
async function start(config: unknown) {
  if (starting || stopped) return;
  starting = true;
  try {
    const { startTillHost } = await import("@shopper/adapters-box/till");
    if (stopped || (ipc && !process.connected)) return;
    host = await startTillHost(config, send);
    if (stopped) await host.close();
  } catch {
    send({
      type: "error",
      code: "HOST_UNAVAILABLE",
      message: "Register could not start. Check its configuration and storage.",
    });
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
    void start(message.config);
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
