import type { SerialPort } from "serialport";
import type { Scanner, SerialOptions } from "../types";
import { openPort } from "./port";

const RETRY_MS = 2000;
const MAX_LINE = 256;

/**
 * One barcode per CR or LF terminated line. The port is open only while someone listens; after an
 * open failure or an unplug it is reopened every 2 s while listeners remain.
 */
export function serialScanner(
  options: SerialOptions & { onError?: (error: Error) => void },
): Scanner {
  const listeners = new Set<(barcode: string) => void>();
  let current: Promise<SerialPort | undefined> | undefined;
  let released: Promise<unknown> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const lost = (attempt: typeof current, error: Error) => {
    if (current !== attempt) return;
    current = undefined;
    options.onError?.(error);
    timer = setTimeout(() => listeners.size > 0 && !current && connect(), RETRY_MS);
  };

  const wire = (port: SerialPort) => {
    let pending = "";
    port.on("data", (chunk: Buffer) => {
      const lines = (pending + chunk.toString("latin1")).split(/[\r\n]/);
      pending = (lines.pop() ?? "").slice(0, MAX_LINE);
      for (const line of lines) {
        const barcode = line.trim();
        if (!barcode) continue;
        for (const listener of listeners) {
          try {
            listener(barcode);
          } catch (error) {
            options.onError?.(error as Error);
          }
        }
      }
    });
    return port;
  };

  function connect() {
    const attempt: Promise<SerialPort | undefined> = released
      .then(() => openPort(options, (error) => lost(attempt, error)))
      .then(
        (port) => {
          if (current === attempt) return wire(port);
          port.close(() => undefined);
          return undefined;
        },
        (error: Error) => {
          lost(attempt, error);
          return undefined;
        },
      );
    current = attempt;
  }

  return {
    onScan(listener) {
      listeners.add(listener);
      if (!current) {
        clearTimeout(timer);
        connect();
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        clearTimeout(timer);
        const closing = current;
        current = undefined;
        released = (closing ?? Promise.resolve(undefined)).then(
          (port) => port && new Promise((resolve) => port.close(resolve)),
        );
      };
    },
  };
}
