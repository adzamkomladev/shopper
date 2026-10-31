import { spawn, spawnSync } from "node:child_process";
import { e2eRun } from "../../../tooling/e2e/run";

const ui = "apps/till/ui";
const outDir = `${e2eRun.outDir}/till-harness`;
const port = e2eRun.port(5188);
export const productionHarnessUrl = e2eRun.url(5188);

/**
 * Builds the till UI with its sale harness for production and serves it, for checks that must measure
 * what a cashier runs (production React), not the dev server.
 */
export async function startProductionHarness() {
  const env = { ...process.env, SHOPPER_TILL_HARNESS_BUILD: "1" };
  const built = spawnSync("vp", ["build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: ui,
    env,
    shell: true,
    encoding: "utf8",
  });
  if (built.status !== 0)
    throw new Error(`till harness build failed:\n${built.stdout}${built.stderr}`);
  const server = spawn(
    "vp",
    ["preview", "--outDir", outDir, "--port", String(port), "--strictPort"],
    {
      cwd: ui,
      env,
      shell: true,
      stdio: "ignore",
    },
  );
  for (let attempt = 0; attempt < 60; attempt++) {
    if (
      await fetch(productionHarnessUrl).then(
        (response) => response.ok,
        () => false,
      )
    )
      break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return {
    close: () => {
      if (process.platform === "win32")
        spawnSync("C:/Windows/System32/taskkill.exe", ["/pid", String(server.pid), "/t", "/f"]);
      else server.kill();
    },
  };
}
