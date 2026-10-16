import { afterAll, afterEach, beforeAll, expect, test } from "vite-plus/test";
import { context } from "../../../support/till/server";
import { auditedSale, startRegister, type Register } from "../../../support/hardware/host";
import {
  MAX_RECEIPT_BYTES,
  auditsOfAsset,
  linkedAsset,
  receiptAssets,
  receiptKey,
  startReceiptApi,
} from "../../../support/sync/receipts";

let server: Awaited<ReturnType<typeof startReceiptApi>>;
let register: Register | undefined;
beforeAll(async () => {
  server = await startReceiptApi();
});
afterEach(async () => {
  await register?.close();
  register = undefined;
});
afterAll(async () => server?.close());

test("an acknowledged sale's receipt PDF is uploaded straight to the receipts bucket and linked to the sale", async () => {
  register = await startRegister({ upstream: server.url });
  const { saleId } = await register.sell([{ kind: "cash", amount: 12_000 }]);

  await expect
    .poll(async () => (await register!.receiptOutput(saleId))?.uploaded_at ?? null, {
      timeout: 30_000,
    })
    .not.toBeNull();
  const output = (await register.receiptOutput(saleId))!;
  const pdf = Buffer.from(output.pdf);

  const assets = await receiptAssets(saleId);
  expect(assets).toHaveLength(1);
  const [asset] = assets;
  expect(asset).toMatchObject({
    purpose: "sale_receipt",
    bucket: "receipts",
    visibility: "private",
    key: receiptKey(saleId),
    content_type: "application/pdf",
    size_bytes: output.pdf_size,
    sha256: output.pdf_sha256,
    expires_at: null,
  });
  expect(output.asset_id).toBe(asset!.id);
  expect(await linkedAsset(saleId)).toBe(asset!.id);

  // Object storage holds exactly the bytes the till stored, under {orgId}/receipts/{saleId}.pdf.
  const uploaded = await server.blobs.get(context.orgId, receiptKey(saleId), MAX_RECEIPT_BYTES);
  expect(uploaded).not.toBeNull();
  expect(Buffer.from(uploaded!).equals(pdf)).toBe(true);

  expect(await auditsOfAsset("asset.receipt.issue", asset!.id)).toHaveLength(1);
  expect(await auditsOfAsset("asset.receipt.confirm", asset!.id)).toHaveLength(1);
  const uploads = auditedSale(await register.audit("receipt.pdf.upload"), saleId);
  expect(uploads).toHaveLength(1);
});

test("two consecutive sales each upload exactly once, one issue and one confirm per sale", async () => {
  register = await startRegister({ upstream: server.url });
  const first = await register.sell([{ kind: "cash", amount: 12_000 }]);
  const second = await register.sell([{ kind: "card", amount: 12_000 }]);

  for (const { saleId } of [first, second])
    await expect
      .poll(async () => (await register!.receiptOutput(saleId))?.uploaded_at ?? null, {
        timeout: 30_000,
      })
      .not.toBeNull();
  for (const { saleId } of [first, second]) {
    const [asset] = await receiptAssets(saleId);
    expect(await linkedAsset(saleId)).toBe(asset!.id);
    // The second acknowledgement finds the first sale already uploaded and does not repeat it.
    expect(await auditsOfAsset("asset.receipt.issue", asset!.id)).toHaveLength(1);
    expect(await auditsOfAsset("asset.receipt.confirm", asset!.id)).toHaveLength(1);
  }
});
