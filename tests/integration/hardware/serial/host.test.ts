import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { serialScanner } from "@shopper/hardware/serial";
import { listPrinters } from "@shopper/adapters-box/till";
import { toDecimal, type Money } from "@shopper/money";
import { registerSettings, startRegister, type Register } from "../../../support/hardware/host";
import { startSerialPair } from "../../../support/hardware/serial";
import { connectBrowser } from "../../../support/till/host/socket";

let register: Register | undefined;
afterEach(async () => {
  await register?.close();
  register = undefined;
});

const text = (value: string) => new TextEncoder().encode(value);
const serial = (path: string) => ({ kind: "serial", path, baudRate: 9600 });
const ghs = (amount: number) => `GHS ${toDecimal(amount as Money)}`;

/** Every `scan` the bridge client receives; the port opens asynchronously, so callers resend. */
async function listen(ready: Register["host"]["ready"]) {
  const client = await connectBrowser(ready);
  const codes: string[] = [];
  client.socket.on("message", (data) => {
    const message = JSON.parse(data.toString());
    if (message.type === "scan") codes.push(message.code);
  });
  return { codes, client };
}
const deliver = (pair: { send(data: Uint8Array): void }, codes: string[], code: string) =>
  expect
    .poll(
      () => {
        pair.send(text(`${code}\n`));
        return codes.includes(code);
      },
      { timeout: 5000 },
    )
    .toBe(true);

test("a serial scan reaches bridge clients as a scan broadcast", async () => {
  register = await startRegister();
  const pair = await startSerialPair();
  try {
    await register.configure(registerSettings(null, { scanner: serial(pair.path) }));
    const { codes, client } = await listen(register.host.ready);
    await deliver(pair, codes, "6001234567890");
    client.socket.close();
  } finally {
    await pair.stop();
  }
});

test("the pole display shows the last line and total after each change and the change due after cash", async () => {
  register = await startRegister();
  const pair = await startSerialPair();
  const has = async (value: string) => (await pair.written()).includes(Buffer.from(value));
  try {
    await register.configure(registerSettings(null, { display: serial(pair.path) }));
    const productId = register.fixture.config.references.products[0].id;
    const added = await register.ask({ type: "add", expectedRevision: 0, productId });
    const name: string = added.view.quote.lines[0].name;
    const total: number = added.view.quote.totals.gross;
    await expect.poll(() => has(name.slice(0, 20))).toBe(true);
    await expect.poll(() => has(`Total ${ghs(total)}`)).toBe(true);

    const { receipt } = await register.sell([{ kind: "cash", amount: total + 5_000 }]);
    expect(receipt.change).toBeGreaterThan(0);
    await expect.poll(() => has(`Change ${ghs(receipt.change)}`)).toBe(true);
  } finally {
    await pair.stop();
  }
});

test("changing the scanner port closes the old port and opens the new one", async () => {
  register = await startRegister();
  const first = await startSerialPair();
  const second = await startSerialPair();
  try {
    await register.configure(registerSettings(null, { scanner: serial(first.path) }));
    const { codes, client } = await listen(register.host.ready);
    await deliver(first, codes, "111");
    await register.configure(registerSettings(null, { scanner: serial(second.path) }));
    await deliver(second, codes, "222");
    first.send(text("333\n"));

    // The old port is free again: a fresh scanner can lock it and hears the probe.
    const heard: string[] = [];
    const off = serialScanner({ path: first.path, baudRate: 9600 }).onScan((c) => heard.push(c));
    await expect
      .poll(
        () => {
          first.send(text("READY\n"));
          return heard.includes("READY");
        },
        { timeout: 5000 },
      )
      .toBe(true);
    off();
    expect(codes).not.toContain("333");
    client.socket.close();
  } finally {
    await first.stop();
    await second.stop();
  }
});

test("printers.list returns serial ports, and spooler names only on Windows", async () => {
  register = await startRegister();
  const reply = await register.ask({ type: "printers.list" });
  expect(reply).toMatchObject({ type: "result", kind: "printers", usb: [] });
  expect(Array.isArray(reply.serial)).toBe(true);
  for (const port of reply.serial) expect(port.path).toEqual(expect.any(String));

  const directory = await mkdtemp(join(tmpdir(), "shopper-printers-"));
  const shell = join(directory, "shell.mjs");
  await writeFile(shell, `#!/usr/bin/env node\nconsole.log("Till A\\r\\n\\r\\nTill B\\r\\n");\n`);
  await chmod(shell, 0o755);
  try {
    expect((await listPrinters({ platform: "win32", shell })).usb).toEqual(["Till A", "Till B"]);
    expect((await listPrinters({ platform: "linux", shell })).usb).toEqual([]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
