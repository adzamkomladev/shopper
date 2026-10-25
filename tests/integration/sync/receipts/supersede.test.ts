// Once the SDC signs a sale, the till renders the definitive receipt and uploads it again. The same PDF stays final
// (no new grant), but a PDF with another digest supersedes the linked one under the same asset, served once its
// bytes are confirmed.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { context, resetLocalTill } from "../../../support/till/server";
import {
  acceptedSale,
  auditsOfAsset,
  confirmReceipt,
  describePdf,
  grantFor,
  issueReceipt,
  linkedAsset,
  pdfBytes,
  putReceipt,
  receiptKey,
  startReceiptApi,
} from "../../../support/sync/receipts";

let server: Awaited<ReturnType<typeof startReceiptApi>>;
beforeAll(async () => {
  server = await startReceiptApi();
});
afterAll(async () => {
  await server?.close();
  await resetLocalTill();
});

test("a definitive receipt with a new digest supersedes the linked provisional one", async () => {
  const saleId = await acceptedSale(server);
  const provisional = pdfBytes("provisional receipt");
  const first = await grantFor(server, saleId, provisional);
  expect((await putReceipt(first, provisional)).status).toBe(200);
  expect((await confirmReceipt(server, first.assetId)).status).toBe(200);

  const definitive = pdfBytes("definitive receipt with the E-VAT QR");
  const reissued = await issueReceipt(server, { saleId, ...(await describePdf(definitive)) });
  expect(reissued.status).toBe(200);
  const grant = await reissued.json();
  expect(grant).toMatchObject({ assetId: first.assetId, method: "PUT" });
  expect(grant.linked).toBeUndefined();

  expect((await putReceipt(grant, definitive)).status).toBe(200);
  expect((await confirmReceipt(server, grant.assetId)).status).toBe(200);
  expect(await linkedAsset(saleId)).toBe(first.assetId);
  expect(await server.blobs.get(context.orgId, receiptKey(saleId))).toEqual(definitive);
  expect(await auditsOfAsset("asset.receipt.confirm", first.assetId)).toHaveLength(2);

  // The definitive copy is now final in its turn.
  const again = await issueReceipt(server, { saleId, ...(await describePdf(definitive)) });
  expect(await again.json()).toEqual({ assetId: first.assetId, linked: true });
});
