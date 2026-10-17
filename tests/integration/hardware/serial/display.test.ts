import { expect, test } from "vite-plus/test";
import { serialDisplay } from "@shopper/hardware/serial";
import { startSerialPair } from "../../../support/hardware/serial";

test("clear plus two 20-column lines, padded, truncated and transliterated", async () => {
  const pair = await startSerialPair();
  try {
    await serialDisplay({ path: pair.path, baudRate: 9600 }).show([
      "Café ₵5.00",
      "Total of everything on the till",
    ]);
    const expected = Buffer.concat([
      Buffer.from([0x1b, 0x40, 0x0c]),
      Buffer.from([0x1f, 0x24, 1, 1]),
      Buffer.from("Cafe GHS5.00".padEnd(20)),
      Buffer.from([0x1f, 0x24, 1, 2]),
      Buffer.from("Total of everything "),
    ]);
    await expect.poll(async () => (await pair.written()).equals(expected)).toBe(true);
  } finally {
    await pair.stop();
  }
});
