import { readFile, rename, writeFile } from "node:fs/promises";

type Till = typeof import("@shopper/adapters-box/till");
let host: Awaited<ReturnType<Till["startTillHost"]>> | undefined;
let enrolment: Awaited<ReturnType<Till["startEnrolmentHost"]>> | undefined;
// The port and capability an enrolment served, kept by the host that follows it.
let handover: { port: number; capability: string } | undefined;
let starting = false;
let stopped = false;
const ipc = typeof process.send === "function";
function stop() {
  stopped = true;
  parent?.dispose();
  void enrolment?.close();
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
    const { startTillHost, startEnrolmentHost, parentRenderer } =
      await import("@shopper/adapters-box/till");
    if (stopped || (ipc && !process.connected)) return;
    if (!enrolled(config)) {
      enrolment = await startEnrolmentHost(config, send);
      const registration = await enrolment.enrolled;
      enrolment = undefined;
      if (stopped) return;
      handover = { port: registration.port, capability: registration.capability };
      const record = {
        identity: registration.identity,
        deviceToken: registration.deviceToken,
        receiptCodes: registration.receiptCodes,
      };
      starting = false;
      // Under a parent the register file is the parent's (Electron seals the token): it stores this and starts us.
      if (ipc) return send({ type: "enrolled", registration: record });
      const next = { ...(config as object), ...record, session: null };
      await writeRegister(next);
      return start(next);
    }
    // Under Electron the parent renders receipts; otherwise the host renders them itself.
    if (renderer === "parent") parent = parentRenderer(send);
    host = await startTillHost(config, send, parent?.renderer, handover);
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
  else if (enrolment) void enrolment.receive(message);
});
process.on("disconnect", stop);
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
const path = process.argv[2];
if (!ipc) {
  if (!path) throw new Error("Usage: node dist/server.js <private-host-config.json>");
  void readFile(path, "utf8")
    .then((data) => start(JSON.parse(data)))
    .catch(() => {
      console.error("Register configuration could not be read");
      process.exitCode = 1;
    });
}

/** A config with an identity has been enrolled; one without is an install waiting for its code. */
function enrolled(config: unknown) {
  return typeof config === "object" && config !== null && "identity" in config;
}

/** Replaces the register file in one rename, so a crash leaves the old file or the new one, never half of one. */
async function writeRegister(config: object) {
  if (!path) throw new Error("No register file to write the enrolment to");
  await writeFile(`${path}.tmp`, JSON.stringify(config, null, 2), { mode: 0o600 });
  await rename(`${path}.tmp`, path);
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
