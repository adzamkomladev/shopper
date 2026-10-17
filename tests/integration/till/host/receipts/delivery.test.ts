import { afterEach, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { sql } from "drizzle-orm";
import { bridgeMessage } from "@shopper/sync/bridge";
import {
  freePort,
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../../support/hardware/host";

let register: Register | undefined;
let printer: Printer | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  register = printer = undefined;
});

/** Reads the purchase the way the Purchases screen does, and checks the reply against the bridge schema. */
async function delivery(host: Register, saleId: string) {
  const reply = await host.ask({ type: "sales.read", expectedRevision: 0, saleId });
  expect(v.safeParse(bridgeMessage, reply).success).toBe(true);
  return reply.purchase.delivery;
}

test("delivery follows the receipt from printed to reprinted, with the PDF waiting to upload", async () => {
  register = await startRegister({ permissions: ["register.settings", "sale.create"] });
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);

  await expect
    .poll(async () => (await delivery(register!, saleId))?.printedAt, { timeout: 20_000 })
    .toEqual(expect.any(String));
  await expect
    .poll(async () => (await delivery(register!, saleId))?.pdf, { timeout: 20_000 })
    .toBe("pending");
  expect(await delivery(register, saleId)).toMatchObject({ reprints: 0, printError: null });

  expect(await register.ask({ type: "receipt.print", saleId })).toMatchObject({ type: "result" });
  expect(await delivery(register, saleId)).toMatchObject({
    reprints: 1,
    printError: null,
    pdf: "pending",
  });

  await register.fixture.database.transaction((tx) =>
    tx.run(
      sql`update receipt_output set uploaded_at = '2026-10-15T09:30:00.000Z' where sale_id = ${saleId}`,
    ),
  );
  expect(await delivery(register, saleId)).toMatchObject({ pdf: "uploaded" });
});

test("a printer that is down shows the print error, and a sale never printed has no printed time", async () => {
  register = await startRegister({ permissions: ["register.settings", "sale.create"] });
  const port = await freePort();
  await register.configure(registerSettings(port));
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);

  await expect
    .poll(async () => (await delivery(register!, saleId))?.printError, { timeout: 20_000 })
    .toEqual(expect.any(String));
  expect(await delivery(register, saleId)).toMatchObject({ printedAt: null, reprints: 0 });

  // The printer comes back: the retry is the first copy, so it is not counted as a reprint.
  printer = await startPrinter(port);
  expect(await register.ask({ type: "receipt.print", saleId })).toMatchObject({ type: "result" });
  expect(await delivery(register, saleId)).toMatchObject({ reprints: 0, printError: null });
  expect((await delivery(register, saleId))?.printedAt).toEqual(expect.any(String));
  expect(await register.ask({ type: "receipt.print", saleId })).toMatchObject({ type: "result" });
  expect(await delivery(register, saleId)).toMatchObject({ reprints: 1 });
});

test("a sale on a register with no printer reports nothing delivered", async () => {
  register = await startRegister({ permissions: ["register.settings", "sale.create"] });
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);
  expect(await delivery(register, saleId)).toMatchObject({
    printedAt: null,
    printError: null,
    reprints: 0,
  });
});
