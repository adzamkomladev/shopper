import { afterEach, expect, test } from "vite-plus/test";
import { toDecimal, type Money } from "@shopper/money";
import {
  DRAWER_KICK,
  auditedSale,
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

const ghs = (amount: Money | number) => `GHS ${toDecimal(amount as Money)}`;
const hasRow = (text: string[], label: string, amount: Money | number) =>
  text.some((line) => line.startsWith(label) && line.endsWith(ghs(amount)));

async function splitSale() {
  register = await startRegister();
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  const sale = await register.sell([
    { kind: "card", amount: 7_000 },
    { kind: "cash", amount: 8_000 },
  ]);
  const [job, ...rest] = await printer.waitForJobs(1);
  if (!job) throw new Error("Expected one captured job");
  return { ...sale, job, rest };
}

test("a split cash and card sale prints the full receipt with the store name override", async () => {
  const { receipt, job, rest } = await splitSale();
  const { text } = job;
  expect(rest).toHaveLength(0);
  expect(text).toContain(receipt.header.org);
  expect(text).toContain(`TIN ${receipt.header.tin}`);
  // The register's store name replaces the branch line.
  expect(text).toContain("Osu Mart");
  expect(job.page).not.toContain("Osu branch");
  expect(
    text.some((line) => line.startsWith("Receipt") && line.endsWith(receipt.header.receiptNumber)),
  ).toBe(true);
  expect(text.some((line) => line.startsWith("Cashier") && line.endsWith("Ama Mensah"))).toBe(true);
  for (const line of receipt.lines) {
    expect(text).toContain(line.name);
    expect(hasRow(text, "  ", line.gross)).toBe(true);
  }
  for (const [label, amount] of [
    ["Net", receipt.taxSummary.net],
    ["NHIL", receipt.taxSummary.nhil],
    ["GETFund", receipt.taxSummary.getfund],
    ["VAT", receipt.taxSummary.vat],
  ] as const)
    expect(hasRow(text, label, amount), `${label} row`).toBe(true);
  expect(hasRow(text, "TOTAL", receipt.total)).toBe(true);
  expect(hasRow(text, "Card", 7_000)).toBe(true);
  expect(text).toContain("  ABC123");
  expect(hasRow(text, "Cash", 8_000)).toBe(true);
  expect(receipt.change).toBeGreaterThan(0);
  expect(hasRow(text, "Change", receipt.change)).toBe(true);
});

test("the receipt carries the E-VAT QR payload and the drawer kicks exactly once", async () => {
  const { receipt, saleId, job } = await splitSale();
  expect(job.commands).toContainEqual({
    name: "qrStore",
    payload: `${receipt.header.receiptNumber}|${saleId}`,
  });
  expect(job.commands.filter((command) => command.name === "drawer")).toEqual([DRAWER_KICK]);
  expect(job.page).not.toContain("REPRINT");
});

test("the first print is audited, marks the receipt printed and reports the job on the status", async () => {
  const { saleId, receipt } = await splitSale();
  await expect.poll(async () => (await register!.receiptOutput(saleId))?.printed_at).toBeTruthy();
  expect(await register!.receiptOutput(saleId)).toMatchObject({ reprints: 0, print_error: null });
  expect(auditedSale(await register!.audit("receipt.print"), saleId)).toHaveLength(1);
  expect(await register!.audit("receipt.reprint")).toHaveLength(0);
  const status = await register!.status();
  expect(status.printer).toMatchObject({ state: "ready", lastJob: { saleId, outcome: "printed" } });
  expect(receipt.header.receiptNumber).toContain(status.registerCode);
});
