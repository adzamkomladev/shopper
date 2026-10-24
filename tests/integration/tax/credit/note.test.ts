// Notion Day 18: "Credit note reverses tax exactly". A refund is issued as a credit note: it takes its own number
// from the register's receipt block, prints as CREDIT NOTE against the original invoice, reverses exactly the
// sold line's tax (two partial credit notes sum to the line), and its fiscal payload is a credit note.
import { afterEach, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { refund as serverRefund } from "@shopper/db-pg";
import { fiscalPayload } from "@shopper/core/receipts";
import { receiptDocument } from "@shopper/core/schemas";
import { api, databases } from "../../../support/till/server";
import { startHostUpstream } from "../../../support/till/host/upstream";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";

let register: Register | undefined;
let printer: Printer | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  await upstream?.close();
  register = printer = upstream = undefined;
});

const parts = ["base", "vat", "nhil", "getfund", "covid", "gross"] as const;
const refunds = (saleId: string) =>
  databases().db.select().from(serverRefund).where(eq(serverRefund.originalSaleId, saleId));

test("Credit note reverses tax exactly", async () => {
  upstream = await startHostUpstream(api);
  register = await startRegister({ upstream: upstream.url });
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  const sale = await register.sell([{ kind: "cash", amount: 36_000 }], 3_000);
  await printer.waitForJobs(1);
  const sold = sale.reply.event.sale.lines[0];
  const invoice = sale.receipt.header.receiptNumber as string;

  const refund = (quantityThousandths: number) =>
    register!.ask({
      type: "refund.record",
      saleId: sale.saleId,
      lines: [{ lineId: sold.id, quantityThousandths }],
      reason: "Returned",
      tender: { kind: "cash" },
    });
  const first = await refund(1_000);
  const second = await refund(2_000);

  const notes = [first.receipt, second.receipt];
  for (const note of notes)
    expect(note).toMatchObject({ kind: "refund", refundOf: invoice, header: { vatInvoice: true } });
  const numbers = notes.map((note) => note.header.receiptNumber as string);
  expect(numbers[0]).toMatch(/^BR[0-9]+-T[0-9]+-X?[0-9]{6,}$/);
  expect(new Set([invoice, ...numbers]).size).toBe(3);
  expect([first.refund.creditNoteNumber, second.refund.creditNoteNumber]).toEqual(numbers);

  // Every tax part of the two credit notes together is exactly the sold line's.
  for (const part of parts)
    expect(first.refund.lines[0].tax[part] + second.refund.lines[0].tax[part], part).toBe(
      sold.tax[part],
    );
  expect(notes[0].taxSummary.vat + notes[1].taxSummary.vat).toBe(sold.tax.vat);

  const jobs = await printer.waitForJobs(3);
  expect(jobs[1]!.page).toContain("CREDIT NOTE");
  expect(jobs[1]!.page).toContain(`Credit note for ${invoice}`);
  expect(jobs[1]!.page).toContain(numbers[0]);

  // On the server each credit note keeps its number, and its fiscal payload is a credit note against the invoice.
  await register.ask({ type: "retry" });
  await expect.poll(async () => (await refunds(sale.saleId)).length, { timeout: 20_000 }).toBe(2);
  const saved = (await refunds(sale.saleId)).find((row) => row.id === first.refund.id)!;
  expect(saved.creditNoteNumber).toBe(numbers[0]);
  expect(fiscalPayload(v.parse(receiptDocument, saved.receipt))).toMatchObject({
    type: "credit_note",
    invoiceNumber: numbers[0],
    originalInvoiceNumber: invoice,
    totals: { vat: first.refund.lines[0].tax.vat, total: first.refund.total },
  });
});
