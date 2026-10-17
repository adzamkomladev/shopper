import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parentRenderer } from "@shopper/adapters-box/till";
import type { Json } from "@shopper/ports";

const root = process.cwd();
export const electronMain = resolve(root, "apps/till/electron/dist/main.js");
// The `electron` package default export is the binary path; it downloads the binary on first use.
const binary = createRequire(import.meta.url)("electron") as string;
let built: Promise<void> | undefined;

/** Bundles apps/till/electron once per test process. */
export function buildElectron() {
  built ??= Promise.resolve().then(() => {
    execFileSync(
      "vp",
      [
        "-C",
        "apps/till/electron",
        "exec",
        "node",
        "../../../tooling/build/server.mjs",
        "till-electron",
      ],
      { cwd: root, stdio: "pipe" },
    );
  });
  return built;
}

/**
 * Spawns Electron on the built main with a Node IPC channel. Without a display it runs under
 * `xvfb-run -a`; `--no-sandbox` is for CI containers that run as root.
 */
export async function launchElectron(env: Record<string, string>, args: string[] = []) {
  await buildElectron();
  const electron = [binary, "--no-sandbox", "--disable-gpu", electronMain, ...args];
  const [command, ...rest] = process.env.DISPLAY ? electron : ["xvfb-run", "-a", ...electron];
  // Own process group, so `stopElectron` can take xvfb-run, Xvfb, Electron and the host down together.
  return spawn(command!, rest, {
    cwd: root,
    detached: true,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
}

/** Stops the whole process group (xvfb-run, Xvfb, Electron, the forked host): TERM, then KILL stragglers. */
export async function stopElectron(child: ChildProcess) {
  const group = (signal: NodeJS.Signals) => {
    try {
      if (child.pid) process.kill(-child.pid, signal);
    } catch {
      /* the group is already gone */
    }
  };
  const exited =
    child.exitCode === null && child.signalCode === null
      ? new Promise((done) => child.once("exit", done))
      : undefined;
  group("SIGTERM");
  const timer = setTimeout(() => group("SIGKILL"), 3_000);
  await exited;
  clearTimeout(timer);
  group("SIGKILL");
}

/** Electron in render-only mode, wrapped as a Renderer by the same `parentRenderer` the host uses. */
export async function electronRenderer(receipt: Json) {
  const child = await launchElectron({ SHOPPER_ELECTRON_RENDER_ONLY: "1" });
  const output: string[] = [];
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  const parent = parentRenderer((message) => child.send(message as object));
  child.on("message", (message) => parent.receive(message));
  return {
    renderer: parent.renderer,
    receipt,
    output,
    close: () => stopElectron(child),
  };
}
