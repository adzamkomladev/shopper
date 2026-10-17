import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { PrinterOffline } from "@shopper/hardware/network";
import { spoolerPrinter } from "@shopper/hardware/spooler";

// A node script stands in for powershell.exe: it records argv, the printer env var and stdin.
async function fakeShell(exitCode: number, stderr = "") {
  const directory = await mkdtemp(join(tmpdir(), "shopper-spooler-"));
  const record = join(directory, "call.json");
  const shell = join(directory, "shell.mjs");
  await writeFile(
    shell,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
let stdin = "";
process.stdin.on("data", (chunk) => (stdin += chunk));
process.stdin.on("end", () => {
  writeFileSync(${JSON.stringify(record)}, JSON.stringify({ argv: process.argv.slice(2), printer: process.env.SHOPPER_PRINTER_NAME, stdin }));
  process.stderr.write(${JSON.stringify(stderr)});
  process.exit(${exitCode});
});
`,
    { mode: 0o755 },
  );
  return { shell, read: async () => JSON.parse(await readFile(record, "utf8")), directory };
}

test("the spooler driver hands PowerShell the printer name and raw bytes", async () => {
  const fake = await fakeShell(0);
  try {
    const bytes = Uint8Array.from([0x1b, 0x40, 0x00, 0xff, 0x0a]);
    await spoolerPrinter({ printerName: `Till "A'; Remove-Item *`, shell: fake.shell }).print(
      bytes,
    );
    const call = await fake.read();
    expect(call.argv.slice(0, 3)).toEqual(["-NoProfile", "-NonInteractive", "-Command"]);
    expect(call.argv[3]).toContain("WritePrinter");
    expect(call.argv[3]).not.toContain("Remove-Item");
    expect(call.printer).toBe(`Till "A'; Remove-Item *`);
    expect(Buffer.from(call.stdin, "base64")).toEqual(Buffer.from(bytes));
  } finally {
    await rm(fake.directory, { recursive: true, force: true });
  }
});

test("a non-zero exit becomes PrinterOffline with the printer's message", async () => {
  const fake = await fakeShell(1, "The printer name is invalid");
  try {
    const failure = await spoolerPrinter({ printerName: "Nope", shell: fake.shell })
      .print(new Uint8Array([1]))
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrinterOffline);
    expect(((failure as PrinterOffline).cause as Error).message).toContain(
      "The printer name is invalid",
    );
  } finally {
    await rm(fake.directory, { recursive: true, force: true });
  }
});

test.skipIf(process.platform === "win32")(
  "off Windows the default shell reports USB printers need Windows",
  async () => {
    const failure = await spoolerPrinter({ printerName: "Any" })
      .print(new Uint8Array([1]))
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrinterOffline);
    expect(((failure as PrinterOffline).cause as Error).message).toBe("USB printers need Windows");
  },
);
