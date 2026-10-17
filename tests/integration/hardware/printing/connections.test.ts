import { afterEach, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { bridgeRequest } from "@shopper/sync/bridge";
import * as v from "valibot";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";
import { decodeEscPos } from "../../../support/hardware/escpos";
import { startSerialPair } from "../../../support/hardware/serial";

let register: Register | undefined;
let printer: Printer | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  register = printer = undefined;
});

const withConnection = (connection: unknown, model = "epson") =>
  registerSettings(null, { printer: { model, connection } });

test("settings save accepts usb and serial printers and rejects malformed ones", async () => {
  register = await startRegister();
  const usb = withConnection({ kind: "usb", printerName: "EPSON TM-T20III Receipt" });
  expect(await register.save(usb, 0)).toMatchObject({ type: "result" });
  expect((await register.status()).settings).toMatchObject({ revision: 1, value: usb });
  const serial = withConnection({ kind: "serial", path: "COM3", baudRate: 115200 }, "xprinter");
  expect(await register.save(serial, 1)).toMatchObject({ type: "result" });
  expect((await register.status()).settings).toMatchObject({ revision: 2, value: serial });

  for (const connection of [
    { kind: "usb", printerName: "" },
    { kind: "usb", printerName: "x".repeat(129) },
    { kind: "usb" },
    { kind: "usb", printerName: "Till", host: "127.0.0.1" },
    { kind: "serial", path: "COM3", baudRate: 1234 },
    { kind: "serial", path: "", baudRate: 9600 },
    { kind: "serial", baudRate: 9600 },
    { kind: "bluetooth", address: "00:11" },
  ])
    expect(await register.save(withConnection(connection), 2)).toMatchObject({
      type: "error",
      code: "INVALID_MESSAGE",
    });
  expect((await register.status()).settings.revision).toBe(2);

  const scanner = { kind: "serial", path: "COM4", baudRate: 9600 };
  expect(
    v.safeParse(bridgeRequest, {
      id: v7(),
      type: "settings.save",
      expectedRevision: 0,
      settings: registerSettings(null, { scanner, display: scanner }),
    }).success,
  ).toBe(true);
  for (const bad of [
    { kind: "network", host: "x", port: 1 },
    { ...scanner, baudRate: 1 },
  ])
    expect(
      v.safeParse(bridgeRequest, {
        id: v7(),
        type: "settings.save",
        expectedRevision: 0,
        settings: registerSettings(null, { scanner: bad }),
      }).success,
    ).toBe(false);
});

test("a cash sale on a serial printer prints the golden receipt and kicks once", async () => {
  register = await startRegister();
  const pair = await startSerialPair();
  try {
    await register.configure(withConnection({ kind: "serial", path: pair.path, baudRate: 115200 }));
    const { receipt } = await register.sell([{ kind: "cash", amount: 15_000 }]);
    await expect.poll(async () => (await pair.written()).length).toBeGreaterThan(0);
    const { text, commands } = decodeEscPos(await pair.written());
    expect(text.some((line) => line.includes(receipt.header.receiptNumber))).toBe(true);
    expect(text.some((line) => line.startsWith("TOTAL"))).toBe(true);
    expect(commands.filter((command) => command.name === "drawer")).toHaveLength(1);
    await expect
      .poll(async () => (await register!.status()).printer, { timeout: 15_000 })
      .toMatchObject({ state: "ready", lastJob: { kind: "receipt", outcome: "printed" } });
  } finally {
    await pair.stop();
  }
});

test("a USB printer off Windows fails the print, not the sale", async () => {
  register = await startRegister();
  await register.configure(withConnection({ kind: "usb", printerName: "Till printer" }));
  const { saleId } = await register.sell([{ kind: "cash", amount: 15_000 }]);
  expect(await register.fixture.localSales()).toHaveLength(1);
  await expect.poll(async () => (await register!.status()).printer.state).toBe("offline");
  const { lastJob } = (await register.status()).printer;
  expect(lastJob).toMatchObject({ kind: "receipt", saleId, outcome: "failed" });
  expect(lastJob.message).toContain("USB printers need Windows");
  expect(await register.receiptOutput(saleId)).toMatchObject({ printed_at: null });
  // A test print reports the same failure to the caller instead of throwing the host over.
  expect(await register.ask({ type: "printer.test" })).toMatchObject({
    type: "error",
    code: "PRINTER_OFFLINE",
  });
});
