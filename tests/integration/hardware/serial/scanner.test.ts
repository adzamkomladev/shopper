import { expect, test } from "vite-plus/test";
import { serialScanner } from "@shopper/hardware/serial";
import { startSerialPair } from "../../../support/hardware/serial";

const text = (value: string) => new TextEncoder().encode(value);

test("one trimmed barcode per CR or LF line", async () => {
  const pair = await startSerialPair();
  const scanner = serialScanner({ path: pair.path, baudRate: 9600 });
  const scans: string[] = [];
  const off = scanner.onScan((code) => scans.push(code));
  try {
    await new Promise((resolve) => setTimeout(resolve, 300)); // let the port open
    pair.send(text(" 6001234567890 \r5449000000996\n\r\n0123"));
    pair.send(text("45\r\n"));
    await expect.poll(() => scans).toEqual(["6001234567890", "5449000000996", "012345"]);
  } finally {
    off();
    await pair.stop();
  }
});

test("close releases the port", async () => {
  const pair = await startSerialPair();
  try {
    const first = serialScanner({ path: pair.path, baudRate: 9600 });
    const off = first.onScan(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 200));
    off();
    const second = serialScanner({ path: pair.path, baudRate: 9600 });
    const scans: string[] = [];
    const offSecond = second.onScan((code) => scans.push(code));
    await new Promise((resolve) => setTimeout(resolve, 200));
    pair.send(text("42\n"));
    await expect.poll(() => scans).toEqual(["42"]);
    offSecond();
  } finally {
    await pair.stop();
  }
});
