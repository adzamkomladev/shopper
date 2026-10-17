import { connect, createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { expect, test } from "vite-plus/test";
import { encodeReceipt, printerProfiles } from "@shopper/hardware";
import { PrinterOffline, networkPrinter } from "@shopper/hardware/network";
import { goldenReceipt } from "../../../support/hardware/receipt";

const bytes = () =>
  encodeReceipt(goldenReceipt(), {
    profile: printerProfiles.epson,
    paperMm: 80,
    reprint: false,
    openDrawer: true,
  });

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test("a network print delivers the exact receipt bytes to the printer", async () => {
  const directory = await mkdtemp(join(tmpdir(), "shopper-printer-"));
  const port = await freePort();
  const server = spawn("node", ["tooling/printer/server.mjs"], {
    env: { ...process.env, CAPTURE_DIR: directory, PORT: String(port) },
    stdio: "pipe",
  });
  try {
    await expect
      .poll(
        () =>
          new Promise<boolean>((resolve) => {
            const socket = connect(port, "127.0.0.1");
            socket.once("error", () => resolve(false));
            socket.once("connect", () => {
              socket.end();
              resolve(true);
            });
          }),
      )
      .toBe(true);
    const expected = bytes();
    await networkPrinter({ host: "127.0.0.1", port, timeoutMs: 2000 }).print(expected);
    await expect
      .poll(async () => {
        for (const file of await readdir(directory))
          if ((await readFile(join(directory, file))).equals(Buffer.from(expected))) return true;
        return false;
      })
      .toBe(true);
  } finally {
    server.kill();
    await new Promise<void>((resolve) => server.once("close", () => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});

test("printing to a port nobody listens on rejects with PrinterOffline within the timeout", async () => {
  const port = await freePort();
  const timeoutMs = 1500;
  const started = Date.now();
  const outcome = networkPrinter({ host: "127.0.0.1", port, timeoutMs }).print(bytes());
  await expect(outcome).rejects.toBeInstanceOf(PrinterOffline);
  expect(Date.now() - started).toBeLessThanOrEqual(timeoutMs);
});

test("a printer that keeps the socket open still completes once every byte is flushed", async () => {
  const received: Buffer[] = [];
  const server = createServer((socket) => socket.on("data", (chunk) => received.push(chunk)));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  try {
    const expected = bytes();
    await networkPrinter({ host: "127.0.0.1", port, timeoutMs: 300 }).print(expected);
    expect(Buffer.concat(received).equals(Buffer.from(expected))).toBe(true);
  } finally {
    server.close();
  }
});
