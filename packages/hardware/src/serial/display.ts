import { ascii } from "../escpos/encoder";
import type { CustomerDisplay, SerialOptions } from "../types";
import { writeOnce } from "./port";

const COLUMNS = 20;
const ESC_INIT = [0x1b, 0x40];
const CLEAR = [0x0c];
const cursorTo = (row: 1 | 2) => [0x1f, 0x24, 1, row]; // US $ x y

const fit = (line: string) => Buffer.from(ascii(line).slice(0, COLUMNS).padEnd(COLUMNS));

/**
 * Epson DM-D (DM-D110/D210 in native DM-D mode): ESC @, clear (0x0C), then `US $ 1 y` before each
 * 20-column row. Lines are ASCII-only so data can never inject commands.
 * ponytail: command set is per model (Bixolon BCD, Logic Controls and others differ), calibrate on the real pole display.
 */
export function serialDisplay(options: SerialOptions): CustomerDisplay {
  return {
    show: ([first, second]) =>
      writeOnce(
        options,
        Buffer.concat([
          Buffer.from([...ESC_INIT, ...CLEAR, ...cursorTo(1)]),
          fit(first),
          Buffer.from(cursorTo(2)),
          fit(second),
        ]),
      ),
  };
}
