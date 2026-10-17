import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { context, resetLocalTill } from "../../../support/till/server";
import { syncHeaders } from "../../../support/till/requests";
import {
  MAX_RECEIPT_BYTES,
  RECEIPTS_BUCKET,
  acceptedSale,
  auditsOfAsset,
  confirmReceipt,
  describePdf,
  grantFor,
  issueReceipt,
  linkedAsset,
  pdfBytes,
  putReceipt,
  receiptAssets,
  receiptKey,
  startReceiptApi,
} from "../../../support/sync/receipts";

type ReceiptApi = Awaited<ReturnType<typeof startReceiptApi>>;
let server: ReceiptApi;
let withoutStorage: ReceiptApi;
beforeAll(async () => {
  server = await startReceiptApi();
  withoutStorage = await startReceiptApi({ s3: false });
});
afterAll(async () => {
  await server?.close();
  await withoutStorage?.close();
});

const sha = "a".repeat(64);

test("issuing and confirming need a device credential and a sale of this device", async () => {
  const saleId = await acceptedSale(server);
  const bytes = pdfBytes();
  const body = { saleId, ...(await describePdf(bytes)) };
  expect((await issueReceipt(server, body, { "content-type": "application/json" })).status).toBe(
    401,
  );
  const grant = await grantFor(server, saleId, bytes);
  expect(
    (await confirmReceipt(server, grant.assetId, { "content-type": "application/json" })).status,
  ).toBe(401);
  // A header naming another org does not match the device's own org.
  expect((await issueReceipt(server, body, syncHeaders(v7()))).status).toBe(401);

  // The same credential for a sale nobody has recorded.
  expect((await issueReceipt(server, { ...body, saleId: v7() })).status).toBe(404);

  // Another register of the same org cannot issue for, or confirm, this sale's receipt.
  await resetLocalTill();
  expect((await issueReceipt(server, body)).status).toBe(404);
  expect((await confirmReceipt(server, grant.assetId)).status).toBe(404);
  expect((await receiptAssets(saleId)).map((row) => row.id)).toEqual([grant.assetId]);
  expect(await linkedAsset(saleId)).toBeNull();
});

test("a PDF over 1 MiB is refused with 413 and nothing is issued, while exactly 1 MiB is accepted", async () => {
  const saleId = await acceptedSale(server);
  const refused = await issueReceipt(server, {
    saleId,
    size: MAX_RECEIPT_BYTES + 1,
    sha256: sha,
  });
  expect(refused.status).toBe(413);
  expect(await receiptAssets(saleId)).toHaveLength(0);
  const allowed = await issueReceipt(server, { saleId, size: MAX_RECEIPT_BYTES, sha256: sha });
  expect(allowed.status).toBe(200);
});

test("issuing twice for one sale returns the same asset and a PUT URL in the receipts bucket", async () => {
  const saleId = await acceptedSale(server);
  const bytes = pdfBytes();
  const first = await grantFor(server, saleId, bytes);
  const second = await grantFor(server, saleId, bytes);
  expect(second.assetId).toBe(first.assetId);
  expect(await receiptAssets(saleId)).toHaveLength(1);
  expect(new URL(first.url).pathname).toBe(
    `/${RECEIPTS_BUCKET}/${context.orgId}/${receiptKey(saleId)}`,
  );
  expect(first.headers).toMatchObject({ "Content-Type": "application/pdf" });
  expect(await auditsOfAsset("asset.receipt.issue", first.assetId)).not.toHaveLength(0);
});

test("confirm refuses bytes that differ from the registered size or digest and links nothing, then accepts the right bytes", async () => {
  const saleId = await acceptedSale(server);
  const bytes = pdfBytes("original");
  const grant = await grantFor(server, saleId, bytes);

  // Nothing uploaded yet.
  expect((await confirmReceipt(server, grant.assetId)).status).toBe(409);

  // Same length, different content; then a different length.
  const sameSize = pdfBytes("tampered");
  expect(sameSize.length).toBe(bytes.length);
  for (const tampered of [sameSize, pdfBytes("a much longer replacement receipt")]) {
    expect((await putReceipt(grant, tampered)).status).toBe(200);
    expect((await confirmReceipt(server, grant.assetId)).status).toBe(409);
    expect(await linkedAsset(saleId)).toBeNull();
    expect(await auditsOfAsset("asset.receipt.confirm", grant.assetId)).toHaveLength(0);
    // The rejected object does not linger in storage.
    expect(await server.blobs.get(context.orgId, receiptKey(saleId))).toBeNull();
  }

  expect((await putReceipt(grant, bytes)).status).toBe(200);
  expect((await confirmReceipt(server, grant.assetId)).status).toBe(200);
  expect(await linkedAsset(saleId)).toBe(grant.assetId);
  expect(await auditsOfAsset("asset.receipt.confirm", grant.assetId)).toHaveLength(1);

  // A retry after a lost response is a no-op: still linked, still one audit.
  expect((await confirmReceipt(server, grant.assetId)).status).toBe(200);
  expect(await linkedAsset(saleId)).toBe(grant.assetId);
  expect(await auditsOfAsset("asset.receipt.confirm", grant.assetId)).toHaveLength(1);

  // A linked receipt is final: reissuing mints no grant and records no new audit.
  const reissued = await issueReceipt(server, { saleId, ...(await describePdf(bytes)) });
  expect(reissued.status).toBe(200);
  expect(await reissued.json()).toEqual({ assetId: grant.assetId, linked: true });
  expect(await auditsOfAsset("asset.receipt.issue", grant.assetId)).toHaveLength(1);
});

test("without object storage issuing answers 503 and records no asset", async () => {
  const saleId = await acceptedSale(withoutStorage);
  const response = await issueReceipt(withoutStorage, {
    saleId,
    ...(await describePdf(pdfBytes())),
  });
  expect(response.status).toBe(503);
  expect(await receiptAssets(saleId)).toHaveLength(0);
  expect(await linkedAsset(saleId)).toBeNull();
});
