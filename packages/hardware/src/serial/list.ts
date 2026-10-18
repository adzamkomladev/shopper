import { SerialPort } from "serialport";

/** Serial ports the OS reports, for a settings picker. */
export async function listSerialPorts() {
  const ports = await SerialPort.list();
  return ports.map(({ path, manufacturer }) => ({
    path,
    ...(manufacturer ? { manufacturer } : {}),
  }));
}
