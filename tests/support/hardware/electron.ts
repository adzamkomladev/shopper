import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { parentRenderer } from "@shopper/adapters-box/till";
import type { Json } from "@shopper/ports";
import { e2eRun } from "../../../tooling/e2e/run";

const root = process.cwd();
export const electronMain = resolve(root, `apps/till/electron/${e2eRun.outDir}/main.js`);
// The `electron` package default export is the binary path; it downloads the binary on first use.
const binary = createRequire(import.meta.url)("electron") as string;

const windows = process.platform === "win32";

/**
 * Spawns Electron on the built main with a Node IPC channel. On Linux without a display it runs
 * under `xvfb-run -a`; Windows always has a desktop. `--no-sandbox` is for CI containers that run as root.
 */
export async function launchElectron(env: Record<string, string>, args: string[] = []) {
  const electron = [binary, "--no-sandbox", "--disable-gpu", electronMain, ...args];
  const [command, ...rest] =
    windows || process.env.DISPLAY ? electron : ["xvfb-run", "-a", ...electron];
  // Own process group, so `stopElectron` can take xvfb-run, Xvfb, Electron and the host down together.
  return spawn(command!, rest, {
    cwd: root,
    detached: !windows,
    // A startup error dialog is modal and would block the test until it times out.
    env: { ...process.env, SHOPPER_TEST_NO_DIALOG: "1", ...env },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
}

/**
 * Stops the whole process group (xvfb-run, Xvfb, Electron, the forked host): TERM, then KILL
 * stragglers. Windows has no process groups or graceful signal for the windowless host, so
 * `taskkill /T /F` ends the tree at once, while Electron is still alive to walk it.
 */
export async function stopElectron(child: ChildProcess) {
  const group = (signal: NodeJS.Signals) => {
    if (windows) {
      // Absolute path: a Git Bash or tool-launched PATH may not include System32.
      const taskkill = `${process.env.SystemRoot}/System32/taskkill.exe`;
      if (child.pid && signal === "SIGTERM")
        spawnSync(taskkill, ["/PID", String(child.pid), "/T", "/F"]);
      return;
    }
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
