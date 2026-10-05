import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vite-plus/test";
const exec = promisify(execFile);
test("Worker integration suite passes in workerd via its supported Vitest runner", async () => {
  const { stdout } = await exec("node", ["node_modules/vitest/vitest.mjs", "run"], {
    cwd: new URL("../tooling/worker-tests/", import.meta.url),
    timeout: 50000,
  });
  expect(stdout).toContain("1 passed");
});
