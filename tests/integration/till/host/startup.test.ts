import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createHostFixture } from "../../../support/till/host/fixture";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let child: ChildProcess | undefined;

afterEach(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await waitForExit(child);
  }
  child = undefined;
  await fixture?.close();
  fixture = undefined;
});

describe("till host startup lifecycle", () => {
  it("closes its listener cleanly when the parent disconnects during startup", async () => {
    fixture = await createHostFixture({ freshSession: true });
    const started = spawn(process.execPath, [resolve("apps/till/host/dist/server.js")], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    child = started;
    const stdout: string[] = [];
    const stderr: string[] = [];
    started.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk.toString()));
    started.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk.toString()));
    const exited = waitForExit(started);
    started.send({ type: "start", config: fixture.config }, (error) => {
      expect(error).toBeNull();
      started.disconnect();
    });

    const result = await Promise.race([
      exited,
      new Promise<undefined>((resolveExit) => setTimeout(() => resolveExit(undefined), 3_000)),
    ]);
    expect(result).toBeDefined();
    expect(stderr.join("").includes("EPIPE")).toBe(false);
    expect(stdout.join("").includes('"capability"')).toBe(false);
    expect(result?.code).toBe(0);
  });
});

function waitForExit(process: ChildProcess) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolveExit) => {
    process.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
}
