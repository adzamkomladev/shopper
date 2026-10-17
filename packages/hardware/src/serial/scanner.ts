import type { SerialPort } from "serialport";
import type { Scanner } from "../types";
import type { SerialOptions } from "../types";
import { openPort } from "./port";

/** Keyboard-wedge-free scanner: one barcode per CR or LF terminated line. The port is open only while someone listens. */
export function serialScanner(
  options: SerialOptions & { onError?: (error: Error) => void },
): Scanner {
  const listeners = new Set<(barcode: string) => void>();
  let opening: Promise<SerialPort | undefined> | undefined;
  let released: Promise<unknown> = Promise.resolve();

  const open = () =>
    released
      .then(() => openPort(options))
      .then(
        (port) => {
          let pending = "";
          port.on("data", (chunk: Buffer) => {
            const lines = (pending + chunk.toString("latin1")).split(/[\r\n]/);
            pending = lines.pop() ?? "";
            for (const line of lines) {
              const barcode = line.trim();
              if (barcode) for (const listener of listeners) listener(barcode);
            }
          });
          return port;
        },
        (error: Error) => {
          options.onError?.(error);
          return undefined;
        },
      );

  return {
    onScan(listener) {
      listeners.add(listener);
      opening ??= open();
      return () => {
        listeners.delete(listener);
        if (listeners.size > 0) return;
        const closing = opening;
        opening = undefined;
        released = (closing ?? Promise.resolve(undefined)).then(
          (port) => port && new Promise((resolve) => port.close(resolve)),
        );
      };
    },
  };
}
