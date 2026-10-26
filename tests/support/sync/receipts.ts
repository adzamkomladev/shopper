import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq, and, sql } from "drizzle-orm";
import { expect } from "vite-plus/test";
import { boxBlobs } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { auditLog } from "@shopper/db-pg";
import { sha256 } from "@shopper/utils";
import { rustfs } from "../../../tooling/storage/buckets";
import { fileBucket } from "../assets/buckets";
import { serveHono } from "../till/http";
import { push, syncHeaders } from "../till/requests";
import { context, databases, devices, recordSale, sequencer } from "../till/server";

export const MAX_RECEIPT_BYTES = 1024 * 1024;
// One pair per test file, made on first import and dropped after the file.
const importsBucket = fileBucket();
const receiptsBucket = fileBucket();
type Target = { request(path: string, init?: RequestInit): Promise<Response> };

/** The box API over the fixture database with RustFS-backed blobs; `s3: false` leaves direct uploads unconfigured. */
export async function startReceiptApi(options: { s3?: boolean } = {}) {
  const bucket = await receiptsBucket;
  const directory = await mkdtemp(join(tmpdir(), "shopper-receipt-api-"));
  const { blobs } = await boxBlobs(directory, {
    baseUrl: "http://127.0.0.1",
    secret: new Uint8Array(32).fill(5),
    ...(options.s3 === false
      ? {}
      : {
          objectStorage: { ...rustfs, bucket: await importsBucket },
          receiptsObjectStorage: { ...rustfs, bucket },
        }),
  });
  const http = await serveHono(createApi({ database: databases().db, devices, sequencer, blobs }));
  return {
    ...http,
    blobs,
    bucket,
    async close() {
      await http.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}

/** Records a sale on the fixture till, pushes it and returns the accepted sale id. */
export async function acceptedSale(target: Target) {
  const captured = await recordSale();
  const response = await push(target, captured.event, captured.proof, captured.sessionId);
  expect(response.status).toBe(200);
  expect((await response.json()).accepted).toHaveLength(1);
  return captured.event.sale.id as string;
}

export const receiptKey = (saleId: string) => `receipts/${saleId}.pdf`;
export const pdfBytes = (text = "receipt") =>
  new TextEncoder().encode(`%PDF-1.4\n% ${text}\n%%EOF\n`);
export const describePdf = async (bytes: Uint8Array) => ({
  size: bytes.length,
  sha256: await sha256(bytes),
});

export function issueReceipt(
  target: Target,
  body: { saleId: string; size: number; sha256: string },
  headers: Record<string, string> = syncHeaders(),
) {
  return target.request("/sync/receipts", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export function confirmReceipt(
  target: Target,
  assetId: string,
  headers: Record<string, string> = syncHeaders(),
) {
  return target.request(`/sync/receipts/${assetId}/confirm`, { method: "POST", headers });
}

/** Issues a grant for `bytes`, expects 200 and returns it. */
export async function grantFor(target: Target, saleId: string, bytes: Uint8Array) {
  const response = await issueReceipt(target, { saleId, ...(await describePdf(bytes)) });
  expect(response.status).toBe(200);
  return (await response.json()) as {
    assetId: string;
    url: string;
    headers: Record<string, string>;
  };
}

export const putReceipt = (
  grant: { url: string; headers: Record<string, string> },
  bytes: Uint8Array,
) => fetch(grant.url, { method: "PUT", headers: grant.headers, body: new Uint8Array(bytes) });

const query = async <T>(statement: ReturnType<typeof sql>) =>
  (await databases().db.execute(statement)).rows as T[];

type AssetRow = {
  id: string;
  purpose: string;
  bucket: string;
  visibility: string;
  key: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  expires_at: Date | null;
};
export const receiptAssets = (saleId: string) =>
  query<AssetRow>(
    sql`select * from asset where org_id = ${context.orgId} and purpose = 'sale_receipt' and key = ${receiptKey(saleId)}`,
  );

export async function linkedAsset(saleId: string) {
  const [row] = await query<{ receipt_asset_id: string | null }>(
    sql`select receipt_asset_id from sale where org_id = ${context.orgId} and id = ${saleId}`,
  );
  return row ? row.receipt_asset_id : "no such sale";
}

/** Audit rows of a command, oldest first. */
export const auditsOf = (command: string) =>
  databases()
    .db.select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, context.orgId), eq(auditLog.command, command)))
    .orderBy(asc(auditLog.chainSeq));

/** Rows of `command` that concern the asset, named either by their entity or in their payload. */
export async function auditsOfAsset(command: string, assetId: string) {
  return (await auditsOf(command)).filter(
    (row) => row.entityId === assetId || row.payload.assetId === assetId,
  );
}
