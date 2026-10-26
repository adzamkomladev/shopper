import { execFileSync } from "node:child_process";

const once = globalThis as { shopperPrebuilt?: boolean };

/**
 * Vitest global setup: bundles every app a suite spawns once, before any file runs. Files run in
 * parallel, and a per-file build would empty a `dist/` another file is executing from. Every project
 * inherits this setup, and all of them run it in the main process, so the flag builds only once.
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
  execFileSync("vp", ["run", "-F", "@shopper/box", "build"], { stdio: "pipe" });
}
