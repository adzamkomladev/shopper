import { SerialPort } from "serialport";
import type { SerialOptions } from "../types";

export function openPort({ path, baudRate }: SerialOptions) {
  const port = new SerialPort({ path, baudRate, autoOpen: false });
  return new Promise<SerialPort>((resolve, reject) =>
    port.open((error) => (error ? reject(error) : resolve(port))),
  );
}

/** Opens, writes, waits until the bytes left the OS buffer, then closes. Close errors are ignored: the bytes are out. */
export async function writeOnce(options: SerialOptions, bytes: Uint8Array) {
  const port = await openPort(options);
  try {
    await new Promise<void>((resolve, reject) => {
      port.write(bytes, (error) =>
        error ? reject(error) : port.drain((e) => (e ? reject(e) : resolve())),
      );
    });
  } finally {
    port.close(() => undefined);
  }
}
