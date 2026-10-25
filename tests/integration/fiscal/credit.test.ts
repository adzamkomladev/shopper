// Credit notes are fiscalised: a refund the server accepts becomes a pending credit-note document that names the
// original invoice, queued on the store's lane after the invoice it reverses.
import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { fiscalDoc } from "@shopper/db-pg";
import { api, databases } from "../../support/till/server";
import { startHostUpstream } from "../../support/till/host/upstream";
import { enqueued } from "../../support/fiscal/lane";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../support/hardware/host";

let register: Register | undefined;
let printer: Printer | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  await upstream?.close();
  register = printer = upstream = undefined;
});

test("a credit note becomes a pending credit-note document against its invoice, queued after it", async () => {
  enqueued.length = 0;
  upstream = await startHostUpstream(api);
  register = await startRegister({ upstream: upstream.url });
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  const sale = await register.sell([{ kind: "cash", amount: 36_000 }], 3_000);
  const invoice = sale.receipt.header.receiptNumber as string;
  const refunded = await register.ask({
    type: "refund.record",
    saleId: sale.saleId,
    lines: [{ lineId: sale.reply.event.sale.lines[0].id, quantityThousandths: 1_000 }],
    reason: "Returned",
    tender: { kind: "cash" },
  });
  await register.ask({ type: "retry" });

  const { db } = databases();
  const note = async () =>
    (await db.select().from(fiscalDoc).where(eq(fiscalDoc.refundId, refunded.refund.id)))[0];
  await expect.poll(note, { timeout: 20_000 }).toBeDefined();
  const [invoiceDoc] = await db.select().from(fiscalDoc).where(eq(fiscalDoc.saleId, sale.saleId));
  expect(await note()).toMatchObject({
    kind: "credit_note",
    saleId: null,
    status: "pending",
    invoiceNumber: refunded.refund.creditNoteNumber,
    payload: {
      type: "credit_note",
      invoiceNumber: refunded.refund.creditNoteNumber,
      originalInvoiceNumber: invoice,
    },
  });
  expect(invoiceDoc).toMatchObject({ kind: "invoice", invoiceNumber: invoice });
  expect(enqueued.map((call) => call.docId)).toEqual([invoiceDoc!.id, (await note())!.id]);
});
