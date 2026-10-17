import { afterEach, expect, test } from "vite-plus/test";
import {
  auditedSale,
  freePort,
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

test("a sale still commits when the printer is down, and the retry after it returns is the first copy", async () => {
  register = await startRegister();
  const port = await freePort();
  await register.configure(registerSettings(port));

  const { saleId, receipt } = await register.sell([{ kind: "cash", amount: 12_000 }]);
  expect(await register.fixture.localSales()).toHaveLength(1);
  expect(await register.fixture.queued()).toHaveLength(1);

  await expect
    .poll(async () => (await register!.status()).printer.state, { timeout: 20_000 })
    .toBe("offline");
  const down = await register.status();
  expect(down.printer.lastJob).toMatchObject({ kind: "receipt", saleId, outcome: "failed" });
  expect(down.printer.lastJob.message).toEqual(expect.any(String));
  const output = await register.receiptOutput(saleId);
  expect(output).toMatchObject({ printed_at: null, reprints: 0 });
  expect(output?.print_error).toEqual(expect.any(String));
  expect(output?.print_error).not.toBe("");

  printer = await startPrinter(port);
  expect(await register.ask({ type: "receipt.print", saleId })).toMatchObject({ type: "result" });
  const [job, ...rest] = await printer.waitForJobs(1);
  expect(rest).toHaveLength(0);
  // No copy had printed yet, so this one is the original: no banner, audited as the first print.
  expect(job?.page).not.toContain("REPRINT");
  expect(job?.page).toContain(receipt.header.receiptNumber);
  expect(job?.kicks).toBe(0);
  expect(auditedSale(await register.audit("receipt.print"), saleId)).toHaveLength(1);
  expect(await register.audit("receipt.reprint")).toHaveLength(0);
  expect(await register.receiptOutput(saleId)).toMatchObject({ reprints: 0, print_error: null });
  expect((await register.receiptOutput(saleId))?.printed_at).toEqual(expect.any(String));
  expect((await register.status()).printer).toMatchObject({
    state: "ready",
    lastJob: { kind: "receipt", saleId, outcome: "printed" },
  });

  // From here on a copy is a reprint.
  expect(await register.ask({ type: "receipt.print", saleId })).toMatchObject({ type: "result" });
  const [, second] = await printer.waitForJobs(2);
  expect(second?.page).toContain("*** REPRINT ***");
  expect(auditedSale(await register.audit("receipt.reprint"), saleId)).toHaveLength(1);
  expect(await register.receiptOutput(saleId)).toMatchObject({ reprints: 1 });
});
