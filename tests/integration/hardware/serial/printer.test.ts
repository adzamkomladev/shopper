import { expect, test } from "vite-plus/test";
import { encodeReceipt, printerProfiles } from "@shopper/hardware";
import { PrinterOffline } from "@shopper/hardware/network";
import { serialPrinter } from "@shopper/hardware/serial";
import { goldenReceipt } from "../../../support/hardware/receipt";
import { ptyTest, startSerialPair } from "../../../support/hardware/serial";

ptyTest("a serial printer receives the exact receipt bytes", async () => {
  const pair = await startSerialPair();
  try {
    const bytes = encodeReceipt(goldenReceipt(), {
      profile: printerProfiles.epson,
      paperMm: 80,
      reprint: false,
      openDrawer: true,
    });
    await serialPrinter({ path: pair.path, baudRate: 115200 }).print(bytes);
    await expect.poll(async () => (await pair.written()).equals(Buffer.from(bytes))).toBe(true);
  } finally {
    await pair.stop();
  }
});

test("a missing port is PrinterOffline", async () => {
  await expect(
    serialPrinter({ path: "/dev/shopper-missing", baudRate: 9600 }).print(new Uint8Array([1])),
  ).rejects.toBeInstanceOf(PrinterOffline);
});
