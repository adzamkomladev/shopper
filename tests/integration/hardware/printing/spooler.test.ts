import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { encodeReceipt, printerProfiles } from "@shopper/hardware";
import { PrinterOffline, PrinterUncertain } from "@shopper/hardware/network";
import { spoolerPrinter } from "@shopper/hardware/spooler";
import { goldenReceipt } from "../../../support/hardware/receipt";

// A node script stands in for powershell.exe: it records argv, the printer env var and stdin.
async function fakeShell(exitCode: number, stderr = "", hang = false) {
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
  if (${hang}) return setTimeout(() => undefined, 60_000);
  process.exit(${exitCode});
});
`,
    { mode: 0o755 },
  );
  return { shell, read: async () => JSON.parse(await readFile(record, "utf8")), directory };
}
// Windows cannot spawn a shebang script; the real PowerShell test at the end runs there instead.
const fakeShellTest = test.skipIf(process.platform === "win32");

fakeShellTest("the spooler driver hands PowerShell the printer name and raw bytes", async () => {
  const fake = await fakeShell(0);
  try {
    const bytes = Uint8Array.from([0x1b, 0x40, 0x00, 0xff, 0x0a]);
    await spoolerPrinter({ printerName: `Till "A'; Remove-Item *`, shell: fake.shell }).print(
      bytes,
    );
    const call = await fake.read();
    expect(call.argv.slice(0, 5)).toEqual([
      "-NoProfile",
      "-NonInteractive",
      "-OutputFormat",
      "Text",
      "-EncodedCommand",
    ]);
    const script = Buffer.from(call.argv[5], "base64").toString("utf16le");
    expect(script).toContain("WritePrinter");
    expect(script).toContain("AbortPrinter");
    expect(script).not.toContain("Remove-Item");
    expect(call.printer).toBe(`Till "A'; Remove-Item *`);
    expect(Buffer.from(call.stdin, "base64")).toEqual(Buffer.from(bytes));
  } finally {
    await rm(fake.directory, { recursive: true, force: true });
  }
});

fakeShellTest("a non-zero exit becomes PrinterOffline with the printer's message", async () => {
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

fakeShellTest(
  "a failure after the job started is PrinterUncertain, never a retry-safe offline",
  async () => {
    const fake = await fakeShell(3, "Write to printer failed");
    try {
      await expect(
        spoolerPrinter({ printerName: "Till", shell: fake.shell }).print(new Uint8Array([1])),
      ).rejects.toBeInstanceOf(PrinterUncertain);
    } finally {
      await rm(fake.directory, { recursive: true, force: true });
    }
  },
);

fakeShellTest("a hung shell times out as PrinterUncertain", async () => {
  const fake = await fakeShell(0, "", true);
  try {
    await expect(
      spoolerPrinter({ printerName: "Till", shell: fake.shell, timeoutMs: 500 }).print(
        new Uint8Array([1]),
      ),
    ).rejects.toBeInstanceOf(PrinterUncertain);
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

test.runIf(process.platform === "win32")(
  "on Windows the real script compiles and a printer that is not installed is PrinterOffline",
  async () => {
    const failure = await spoolerPrinter({ printerName: "Shopper missing printer" })
      .print(new Uint8Array([1]))
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PrinterOffline);
    expect(((failure as PrinterOffline).cause as Error).message).toContain(
      "Cannot open printer 'Shopper missing printer'",
    );
  },
  30_000,
);

// Opt-in on a Windows till: a Generic / Text Only printer whose local port is a file (handoff step 5).
const raw = {
  printer: process.env.SHOPPER_TEST_RAW_PRINTER,
  file: process.env.SHOPPER_TEST_RAW_FILE,
};
test.runIf(process.platform === "win32" && raw.printer && raw.file)(
  "a RAW spooler queue receives the golden receipt bytes unchanged",
  async () => {
    const bytes = encodeReceipt(goldenReceipt(), {
      profile: printerProfiles.epson,
      paperMm: 80,
      reprint: false,
      openDrawer: true,
    });
    await rm(raw.file!, { force: true });
    await spoolerPrinter({ printerName: raw.printer! }).print(bytes);
    await expect
      .poll(
        async () =>
          (await readFile(raw.file!).catch(() => Buffer.alloc(0))).equals(Buffer.from(bytes)),
        {
          timeout: 15_000,
        },
      )
      .toBe(true);
  },
  30_000,
);
