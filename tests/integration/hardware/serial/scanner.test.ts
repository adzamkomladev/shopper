import { symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { serialScanner } from "@shopper/hardware/serial";
import { startSerialPair } from "../../../support/hardware/serial";

const text = (value: string) => new TextEncoder().encode(value);

const PROBE = "READY";

/** Collects scans, hiding the connection probe. */
const collect = (scans: string[], seen = { probe: false }) => ({
  seen,
  listener: (code: string) => (code === PROBE ? (seen.probe = true) : scans.push(code)),
});

/** The port opens asynchronously; resend a probe until it arrives, then the device is really connected. */
async function connected(
  pair: { send(data: Uint8Array): void },
  seen: { probe: boolean },
  timeout = 1000,
) {
  await expect
    .poll(
      () => {
        pair.send(text(`${PROBE}\n`));
        return seen.probe;
      },
      { timeout },
    )
    .toBe(true);
}

test("one trimmed barcode per CR or LF line", async () => {
  const pair = await startSerialPair();
  const scans: string[] = [];
  const { seen, listener } = collect(scans);
  const off = serialScanner({ path: pair.path, baudRate: 9600 }).onScan(listener);
  try {
    await connected(pair, seen);
    pair.send(text(" 6001234567890 \r5449000000996\n\r\n0123"));
    pair.send(text("45\r\n"));
    await expect
      .poll(() => scans.slice(0, 3))
      .toEqual(["6001234567890", "5449000000996", "012345"]);
  } finally {
    off();
    await pair.stop();
  }
});

test("a throwing listener does not stop the others", async () => {
  const pair = await startSerialPair();
  const scans: string[] = [];
  const scanner = serialScanner({ path: pair.path, baudRate: 9600, onError: () => undefined });
  const offBad = scanner.onScan(() => {
    throw new Error("boom");
  });
  const { seen, listener } = collect(scans);
  const off = scanner.onScan(listener);
  try {
    await connected(pair, seen);
    pair.send(text("42\n"));
    await expect.poll(() => scans).toEqual(["42"]);
  } finally {
    offBad();
    off();
    await pair.stop();
  }
});

test("close releases the port", async () => {
  const pair = await startSerialPair();
  try {
    const scans: string[] = [];
    const scanner = serialScanner({ path: pair.path, baudRate: 9600 });
    const one = collect(scans);
    const first = scanner.onScan(one.listener);
    await connected(pair, one.seen);
    first();
    const two = collect(scans);
    const second = scanner.onScan(two.listener);
    await connected(pair, two.seen);
    pair.send(text("42\n"));
    await expect.poll(() => scans).toEqual(["42"]);
    second();
  } finally {
    await pair.stop();
  }
});

test("a scanner plugged in after the open failed is picked up again", async () => {
  const pair = await startSerialPair();
  const link = join(tmpdir(), `shopper-scanner-${process.pid}-${Date.now()}`);
  const errors: Error[] = [];
  const scans: string[] = [];
  const { seen, listener } = collect(scans);
  const off = serialScanner({ path: link, baudRate: 9600, onError: (e) => errors.push(e) }).onScan(
    listener,
  );
  try {
    await expect.poll(() => errors.length).toBeGreaterThan(0);
    await symlink(pair.path, link);
    await connected(pair, seen, 8000);
    pair.send(text("42\n"));
    await expect.poll(() => scans).toEqual(["42"]);
  } finally {
    off();
    await pair.stop();
  }
}, 20_000);
