import { afterEach, expect, test } from "vite-plus/test";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";

let register: Register | undefined;
let printer: Printer | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  register = printer = undefined;
});

test("two sales back to back print two whole receipts in order", async () => {
  register = await startRegister();
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  const first = await register.sell([{ kind: "cash", amount: 15_000 }]);
  const second = await register.sell([{ kind: "card", amount: 12_000 }]);
  const [one, two] = await printer.waitForJobs(2);
  expect(one?.page).toContain(first.receipt.header.receiptNumber);
  expect(one?.page).not.toContain(second.receipt.header.receiptNumber);
  expect(two?.page).toContain(second.receipt.header.receiptNumber);
  expect(two?.page).not.toContain(first.receipt.header.receiptNumber);
  expect([one?.kicks, two?.kicks]).toEqual([1, 0]);
  await expect
    .poll(async () => (await register!.status()).printer.lastJob)
    .toMatchObject({ saleId: second.saleId, outcome: "printed" });
});
