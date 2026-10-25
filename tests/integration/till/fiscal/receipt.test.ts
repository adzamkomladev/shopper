// A sale prints provisionally and never waits for the SDC. Once the SDC signs it, the till pulls the signature: a
// reprint is the definitive receipt with the E-VAT QR, and the digital PDF is rendered (and uploaded) again.
import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { fiscalDoc } from "@shopper/db-pg";
import { boxLane } from "@shopper/adapters-box";
import { createSdc } from "@shopper/core/fiscal";
import { storeReceiptPdf } from "@shopper/core/till";
import { api, appVersion, databases } from "../../../support/till/server";
import { startHostUpstream } from "../../../support/till/host/upstream";
import { useLane } from "../../../support/fiscal/lane";
import { bulkRows } from "../../../support/till/pull";
import { startSdcFake } from "../../../../tooling/sdc/server";
import {
  registerSettings,
  startPrinter,
  startRegister,
  type Printer,
  type Register,
} from "../../../support/hardware/host";

const fake = await startSdcFake();
let lane: ReturnType<typeof boxLane>;
let register: Register | undefined;
let printer: Printer | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
beforeAll(() => {
  lane = boxLane({
    db: databases().db,
    sdc: createSdc({ url: fake.url, apiKey: fake.apiKey }),
    appVersion,
  });
  useLane(lane);
});
afterEach(async () => {
  await register?.close();
  await printer?.stop();
  await upstream?.close();
  register = printer = upstream = undefined;
});
afterAll(async () => {
  useLane(undefined);
  lane.close();
  await fake.stop();
});

const docOf = async (saleId: string) =>
  (await databases().db.select().from(fiscalDoc).where(eq(fiscalDoc.saleId, saleId)))[0];

test("once the SDC signs a sale, a reprint carries its E-VAT QR and the digital PDF is rendered again", async () => {
  upstream = await startHostUpstream(api);
  register = await startRegister({ upstream: upstream.url });
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  // The SDC is down at the sale: the sale completes and prints provisionally all the same.
  fake.down();
  const sale = await register.sell([{ kind: "cash", amount: 36_000 }], 3_000);
  const [first] = await printer.waitForJobs(1);
  expect(first!.page).toContain("PROVISIONAL - E-VAT signature pending");
  await register.ask({ type: "retry" });
  await expect
    .poll(async () => (await docOf(sale.saleId))?.status, { timeout: 20_000 })
    .toBe("pending");
  await expect
    .poll(async () => (await register!.receiptOutput(sale.saleId))?.pdf_sha256, { timeout: 20_000 })
    .toBeTruthy();
  const provisionalPdf = (await register.receiptOutput(sale.saleId))!.pdf_sha256;

  fake.up();
  await lane.wake(sale.reply.event.sale.orgId, sale.reply.event.sale.storeId);
  const signed = (await docOf(sale.saleId))!;
  expect(signed.status).toBe("accepted");

  await register.ask({ type: "retry" });
  await expect
    .poll(async () => (await register!.receiptOutput(sale.saleId))?.pdf_sha256, { timeout: 20_000 })
    .not.toBe(provisionalPdf);
  expect((await register.receiptOutput(sale.saleId))!.pdf_stale).toBe(0);

  expect(await register.ask({ type: "receipt.print", saleId: sale.saleId })).toMatchObject({
    type: "result",
  });
  const jobs = await printer.waitForJobs(2);
  const reprint = jobs[1]!;
  expect(reprint.page).toContain(`E-VAT ${fake.sdcId} #${signed.sdcCounter}`);
  expect(reprint.page).not.toContain("PROVISIONAL");
  expect(reprint.commands).toContainEqual({ name: "qrStore", payload: signed.qr });

  // A provisional copy whose render finished after the signature arrived is stored stale, to be rendered again.
  await storeReceiptPdf(
    register.fixture.database,
    { orgId: signed.orgId, appVersion },
    { saleId: sale.saleId, pdf: new Uint8Array([37, 80, 68, 70]), signed: false },
  );
  expect((await register.receiptOutput(sale.saleId))!.pdf_stale).toBe(1);
});

// Codex review of Day 19: a till far enough behind to take a snapshot skips the feed rows that carried its signatures.
// It asks for the signatures of the receipts it still holds as provisional and applies them with the snapshot.
test("a till that catches up through a snapshot still gets the signatures it skipped", async () => {
  upstream = await startHostUpstream(api);
  register = await startRegister({ upstream: upstream.url });
  printer = await startPrinter();
  await register.configure(registerSettings(printer.port));
  fake.down();
  const sale = await register.sell([{ kind: "cash", amount: 36_000 }], 3_000);
  await printer.waitForJobs(1);
  await register.ask({ type: "retry" });
  await expect
    .poll(async () => (await docOf(sale.saleId))?.status, { timeout: 20_000 })
    .toBe("pending");
  fake.up();
  const scope = sale.reply.event.sale;
  await lane.wake(scope.orgId, scope.storeId);
  const signed = (await docOf(sale.saleId))!;
  expect(signed.status).toBe("accepted");
  // More than 50,000 changes behind the signature: the next pull is a snapshot, not the feed row.
  await bulkRows(50_001, scope.storeId, scope.orgId);

  await register.ask({ type: "retry" });
  await expect
    .poll(async () => (await register!.receiptOutput(sale.saleId))?.pdf_stale, { timeout: 30_000 })
    .toBe(0);
  expect(await register.ask({ type: "receipt.print", saleId: sale.saleId })).toMatchObject({
    type: "result",
  });
  const reprint = (await printer.waitForJobs(2))[1]!;
  expect(reprint.page).toContain(`E-VAT ${fake.sdcId} #${signed.sdcCounter}`);
  expect(reprint.page).not.toContain("PROVISIONAL");
});
