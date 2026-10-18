import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vite-plus/test";

// A pty pair: the driver opens `path` (the slave) like a COM port; the test reads what it wrote and
// can send bytes as if it were the device. Line 1 of stdout is the slave path; each stdin line is hex to send.
const SCRIPT = `
import os, sys, tty, threading
master, slave = os.openpty()
tty.setraw(slave)
print(os.ttyname(slave), flush=True)
out = open(sys.argv[1], "ab", buffering=0)
def pump():
    while True:
        try: data = os.read(master, 4096)
        except OSError: return
        out.write(data)
threading.Thread(target=pump, daemon=True).start()
for line in sys.stdin:
    os.write(master, bytes.fromhex(line.strip()))
`;

/** Python has no pty on Windows; real COM ports are proven by hand there (Day 13 Windows handoff, step 7). */
export const ptyTest = test.skipIf(process.platform === "win32");

export async function startSerialPair() {
  const directory = await mkdtemp(join(tmpdir(), "shopper-serial-"));
  const record = join(directory, "written.bin");
  const child = spawn("python3", ["-c", SCRIPT, record], { stdio: ["pipe", "pipe", "inherit"] });
  const path = await new Promise<string>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", () => reject(new Error("python3 exited before opening a pty")));
    child.stdout.once("data", (chunk: Buffer) => resolve(chunk.toString().trim()));
  }).catch(async (error: unknown) => {
    child.kill();
    await rm(directory, { recursive: true, force: true });
    throw error;
  });
  return {
    path,
    written: () => readFile(record).catch(() => Buffer.alloc(0)),
    send: (data: Uint8Array) => child.stdin.write(`${Buffer.from(data).toString("hex")}\n`),
    async stop() {
      child.kill();
      await new Promise((resolve) => child.once("close", resolve));
      await rm(directory, { recursive: true, force: true });
    },
  };
}
