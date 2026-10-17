import { spawn, type ChildProcess } from "node:child_process";
import { connect, createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decodeEscPos } from "./escpos";

// Free of vitest and the till packages so Playwright specs can start a printer too.

async function poll<T>(read: () => Promise<T>, done: (value: T) => boolean, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) throw new Error("Timed out waiting for the virtual printer");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** The virtual ESC/POS printer on `port` (a fresh free port by default); every connection is one captured job. */
export async function startPrinter(port?: number) {
  const listenOn = port ?? (await freePort());
  const directory = await mkdtemp(join(tmpdir(), "shopper-printer-"));
  const server: ChildProcess = spawn("node", ["tooling/printer/server.mjs"], {
    env: { ...process.env, CAPTURE_DIR: directory, PORT: String(listenOn) },
    stdio: "pipe",
  });
  await poll(
    () =>
      new Promise<boolean>((resolve) => {
        const socket = connect(listenOn, "127.0.0.1");
        socket.once("error", () => resolve(false));
        socket.once("connect", () => {
          socket.end();
          resolve(true);
        });
      }),
    Boolean,
  );
  const printer = {
    port: listenOn,
    /** Captured jobs in arrival order, decoded the way a printer would read them. */
    async jobs() {
      const files = await Promise.all(
        (await readdir(directory)).map(async (name) => ({
          name,
          at: (await stat(join(directory, name), { bigint: true })).mtimeNs,
        })),
      );
      files.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      const captured = await Promise.all(
        files.map(async ({ name }) => new Uint8Array(await readFile(join(directory, name)))),
      );
      // The readiness probe connects and hangs up, which the virtual printer captures as an empty file.
      return captured
        .filter((bytes) => bytes.length > 0)
        .map((bytes) => {
          const { text, commands } = decodeEscPos(bytes);
          return {
            bytes,
            text,
            commands,
            page: text.join("\n"),
            kicks: commands.filter((command) => command.name === "drawer").length,
          };
        });
    },
    async waitForJobs(count: number) {
      await poll(
        async () => (await printer.jobs()).length,
        (length) => length === count,
      );
      return printer.jobs();
    },
    async stop() {
      server.kill();
      await new Promise<void>((resolve) => server.once("close", () => resolve()));
      await rm(directory, { recursive: true, force: true });
    },
  };
  return printer;
}

export type Printer = Awaited<ReturnType<typeof startPrinter>>;
