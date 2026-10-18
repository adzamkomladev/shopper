import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChildProcess } from "node:child_process";
import { afterEach, expect, test } from "vite-plus/test";
import { register } from "../../../support/hardware/register";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

/** Collects stdout and stderr until the process tree closes. */
async function failure(child: ChildProcess) {
  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  const code = await new Promise<number | null>((done) => child.once("close", done));
  return { code, output: output.join("") };
}

test("a register.json the host rejects exits non-zero and reports the cause without secrets", async () => {
  const { userData, start } = await register(cleanup);
  const configPath = join(userData, "register.json");
  // Uppercase fails the host's token format; loadSecrets still seals it with a fresh database key.
  const token = "A".repeat(64);
  const config = JSON.parse(await readFile(configPath, "utf8"));
  await writeFile(configPath, JSON.stringify({ ...config, deviceToken: token }));
  const { code, output } = await failure(await start());
  expect(code, output).not.toBe(0);
  const log = join(userData, "register.log");
  expect(output).toContain("Register could not start");
  expect(output).toContain("deviceToken");
  expect(output).toContain(log);
  const logged = await readFile(log, "utf8");
  expect(logged).toContain("deviceToken");
  for (const text of [output, logged]) {
    expect(text).not.toContain(token);
    // The sealed databaseKey is 64 hex characters.
    expect(text).not.toMatch(/[0-9a-f]{64}/i);
  }
}, 120_000);

test("a secrets failure exits non-zero and logs the cause", async () => {
  const { userData, start } = await register(cleanup);
  const { code, output } = await failure(await start([], { SHOPPER_TEST_NO_ENCRYPTION: "1" }));
  expect(code, output).not.toBe(0);
  expect(output).toContain("Register could not start");
  expect(await readFile(join(userData, "register.log"), "utf8")).toContain(
    "OS encryption is unavailable",
  );
}, 90_000);
