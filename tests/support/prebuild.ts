import { execFileSync } from "node:child_process";

const once = globalThis as { shopperPrebuilt?: boolean };

/**
 * Vitest and Playwright global setup: bundles the till host and Electron once, before any file runs.
 * Files run in parallel, and a per-file build would empty a `dist/` another file is executing from.
 * Every Vitest project inherits this setup and runs it in the main process, so the flag builds once.
 * The box is not built here: Playwright's web servers are already running from apps/box/dist.
 */
export default function prebuild() {
  if (once.shopperPrebuilt) return;
  once.shopperPrebuilt = true;
  for (const [app, bundle] of [
    ["host", "till-host"],
    ["electron", "till-electron"],
  ])
    execFileSync(
      "vp",
      ["-C", `apps/till/${app}`, "exec", "node", "../../../tooling/build/server.mjs", bundle!],
      { stdio: "pipe" },
    );
}
