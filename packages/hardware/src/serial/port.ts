import { SerialPort } from "serialport";
import { PrinterOffline, PrinterUncertain } from "../errors";
import type { SerialOptions } from "../types";

const DRAIN_TIMEOUT_MS = 5000;

/** `onError` receives port faults and unplugs after opening; without a listener Node would crash the host. */
export function openPort({ path, baudRate }: SerialOptions, onError: (error: Error) => void) {
  const port = new SerialPort({ path, baudRate, autoOpen: false });
  port.on("error", onError);
  port.on("close", (error?: Error) => error && onError(error));
  return new Promise<SerialPort>((resolve, reject) =>
    port.open((error) => (error ? reject(error) : resolve(port))),
  );
}

/**
 * Opens, writes, waits until the bytes left the OS buffer, then closes. A failure to open is
 * `PrinterOffline` (nothing was sent); a fault or timeout after that is `PrinterUncertain`.
 */
export async function writeOnce(options: SerialOptions, bytes: Uint8Array) {
  let fail: (error: Error) => void = () => undefined;
  const port = await openPort(options, (error) => fail(error)).catch((cause: unknown) => {
    throw new PrinterOffline(cause);
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      fail = reject;
      timer = setTimeout(
        () => reject(new Error(`No drain in ${DRAIN_TIMEOUT_MS} ms`)),
        DRAIN_TIMEOUT_MS,
      );
      port.write(bytes, (error) =>
        error ? reject(error) : port.drain((e) => (e ? reject(e) : resolve())),
      );
    });
  } catch (cause) {
    throw new PrinterUncertain(cause);
  } finally {
    clearTimeout(timer);
    port.close(() => undefined);
  }
}
