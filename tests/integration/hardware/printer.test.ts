import { connect } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { expect, test } from "vite-plus/test";
test("virtual TCP printer captures the exact receipt bytes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shopper-printer-"));
  const receipt = Buffer.from([0x1b, 0x40, ...Buffer.from("Shopper\n"), 0x1d, 0x56, 0]);
  // Use a dedicated port by starting this listener in an isolated process.
  const process = spawn("node", ["tooling/printer/server.mjs"], {
    env: { ...globalThis.process.env, CAPTURE_DIR: directory, PORT: "19100" },
    stdio: "pipe",
  });
  try {
    await expect
      .poll(async () => {
        try {
          await new Promise<void>((resolve, reject) => {
            const socket = connect(19100, "127.0.0.1");
            socket.once("error", reject);
            socket.once("connect", () => {
              socket.end();
              resolve();
            });
          });
          return true;
        } catch {
          return false;
        }
      })
      .toBe(true);
    await new Promise<void>((resolve, reject) => {
      const socket = connect(19100, "127.0.0.1");
      socket.once("error", reject);
      socket.once("connect", () => socket.end(receipt));
      socket.once("close", () => resolve());
    });
    await expect
      .poll(async () => {
        for (const file of await readdir(directory)) {
          if ((await readFile(join(directory, file))).equals(receipt)) return true;
        }
        return false;
      })
      .toBe(true);
  } finally {
    process.kill();
    await new Promise<void>((resolve) => process.once("close", () => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
