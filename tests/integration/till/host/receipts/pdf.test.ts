import { createHash } from "node:crypto";
import { afterEach, expect, test } from "vite-plus/test";
import { api } from "../../../../support/till/server";
import { startHostUpstream } from "../../../../support/till/host/upstream";
import {
  auditedSale,
  freePort,
  registerSettings,
  startRegister,
  type Register,
} from "../../../../support/hardware/host";

let register: Register | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
afterEach(async () => {
  await register?.close();
  await upstream?.close();
  register = upstream = undefined;
});

/** Waits for the host to render and store the sale's PDF, then returns the stored row. */
async function storedOutput(host: Register, saleId: string) {
  await expect
    .poll(async () => (await host.receiptOutput(saleId))?.pdf_size ?? null, { timeout: 20_000 })
    .not.toBeNull();
  const output = await host.receiptOutput(saleId);
  if (!output) throw new Error("Expected a receipt_output row");
  return output;
}

function expectStoredPdf(output: Record<string, any>) {
  const pdf = Buffer.from(output.pdf);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdf.subarray(-32).toString("latin1")).toContain("%%EOF");
  expect(output.pdf_size).toBe(pdf.length);
  expect(output.pdf_sha256).toBe(createHash("sha256").update(pdf).digest("hex"));
}

test("a host without Electron renders the receipt PDF after the sale and stores it with its digest and audit", async () => {
  register = await startRegister();
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);

  const output = await storedOutput(register, saleId);
  expectStoredPdf(output);
  const stored = auditedSale(await register.audit("receipt.pdf.store"), saleId);
  expect(stored).toHaveLength(1);
  expect(stored[0]?.payload).toMatchObject({ saleId });
});

test("the PDF is stored even when the printer is down", async () => {
  register = await startRegister();
  await register.configure(registerSettings(await freePort()));
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);

  await expect.poll(async () => (await register!.status()).printer.state).toBe("offline");
  const output = await storedOutput(register, saleId);
  expect(output.print_error).toEqual(expect.any(String));
  expect(output.print_error).not.toBe("");
  expect(output.printed_at).toBeNull();
  expectStoredPdf(output);
  expect(auditedSale(await register.audit("receipt.pdf.store"), saleId)).toHaveLength(1);
});

test("the PDF stays pending and no upload is attempted while the sale is unacknowledged", async () => {
  upstream = await startHostUpstream(api);
  upstream.setAvailable(false);
  register = await startRegister({ upstream: upstream.url });
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);

  const output = await storedOutput(register, saleId);
  expectStoredPdf(output);
  // Two refused pushes: the host kept trying after the PDF existed and never got an acknowledgement.
  await upstream.waitForPush(2);
  expect(await register.receiptOutput(saleId)).toMatchObject({
    asset_id: null,
    uploaded_at: null,
    upload_attempts: 0,
  });
  expect(upstream.requests.filter((request) => request.path.startsWith("/sync/receipts"))).toEqual(
    [],
  );
  expect(await register.audit("receipt.pdf.upload")).toHaveLength(0);
});
