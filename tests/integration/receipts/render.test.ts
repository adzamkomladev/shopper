// Online-order receipts are rendered once, when the order is paid, stored beside till PDFs and never rendered again.
//   renderSaleReceipt({ db, blobs, renderer, appVersion }, orgId, saleId)   (@shopper/assets)
//     -> { assetId, key, rendered }   rendered is false when the sale already had a verified, linked PDF
//   Each render writes its own object (receipts/<saleId>/<assetId>.pdf), so a racing render can never overwrite
//   the bytes another one recorded.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { verifyChain } from "@shopper/audit";
import { renderSaleReceipt } from "@shopper/assets";
import { asset, auditLog, sale } from "@shopper/db-pg";
import type { Blobs, Renderer } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { goldenWorld } from "../../support/sales/golden/setup";
import { addCustomer } from "../../support/customers/seed";
import { freshSale, pushSale, sameTillSale } from "../../support/customers/credit";
import { cashSaleEvent } from "../../support/customers/loyalty";
import { ids } from "../../support/till/sales";
import { databases } from "../../support/till/server";

let world: Awaited<ReturnType<typeof goldenWorld>>;
const stored = new Map<string, Uint8Array>();
const renders: { receipt: unknown; options: unknown; format: string }[] = [];
const blobs = {
  put: async (orgId: string, key: string, value: Uint8Array) =>
    void stored.set(`${orgId}/${key}`, value),
  get: async (orgId: string, key: string) => stored.get(`${orgId}/${key}`) ?? null,
} as unknown as Blobs;
const renderer = {
  receipt: async (receipt: unknown, options: unknown, format: string) => {
    renders.push({ receipt, options, format });
    return new TextEncoder().encode(`%PDF-1.7 rendered ${renders.length}`);
  },
} as unknown as Renderer;
const deps = () => ({ db: databases().db, blobs, renderer, appVersion: "test" });
let customer: string;

beforeAll(async () => {
  world = await goldenWorld();
  customer = await addCustomer({ phone: "0277400001" });
}, 120_000);
afterAll(async () => world?.local.close());

async function paidSale(first = false) {
  const created = first ? await freshSale() : await sameTillSale();
  expect((await pushSale(created, cashSaleEvent(created, customer))).body.accepted).toHaveLength(1);
  return created.event.sale.id as string;
}

test("the first call renders the stored receipt to a PDF, keeps it and links a verified asset", async () => {
  const saleId = await paidSale(true);
  const result = await renderSaleReceipt(deps(), ids.org, saleId);

  expect(result).toMatchObject({ key: `receipts/${saleId}/${result.assetId}.pdf`, rendered: true });
  expect(renders).toHaveLength(1);
  expect(renders[0]!.format).toBe("pdf");
  expect(renders[0]!.options).toEqual({ paperMm: 80, reprint: false });
  expect(renders[0]!.receipt).toMatchObject({ kind: "sale" });
  const bytes = stored.get(`${ids.org}/${result.key}`)!;
  expect(new TextDecoder().decode(bytes)).toBe("%PDF-1.7 rendered 1");

  const db = databases().db;
  const [row] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.orgId, ids.org), eq(asset.id, result.assetId)));
  expect(row).toMatchObject({
    purpose: "sale_receipt",
    bucket: "receipts",
    contentType: "application/pdf",
    sizeBytes: bytes.byteLength,
    sha256: await sha256(bytes),
    verifiedSha256: await sha256(bytes),
  });
  const [linked] = await db
    .select({ receiptAssetId: sale.receiptAssetId })
    .from(sale)
    .where(and(eq(sale.orgId, ids.org), eq(sale.id, saleId)));
  expect(linked!.receiptAssetId).toBe(result.assetId);
  const chain = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.orgId, ids.org))
    .orderBy(auditLog.chainSeq);
  expect(chain.some((entry) => entry.command === "asset.receipt.render")).toBe(true);
  expect(await verifyChain(chain)).toMatchObject({ valid: true });
});

test("a second call renders nothing and returns the same asset", async () => {
  const saleId = await paidSale();
  const first = await renderSaleReceipt(deps(), ids.org, saleId);
  const before = renders.length;
  const again = await renderSaleReceipt(deps(), ids.org, saleId);
  expect(again).toEqual({ ...first, rendered: false });
  expect(renders).toHaveLength(before);
});

test("a sale whose till uploaded its own PDF is never rendered over", async () => {
  const saleId = await paidSale();
  const db = databases().db;
  const id = v7();
  await db.insert(asset).values({
    id,
    orgId: ids.org,
    purpose: "sale_receipt",
    bucket: "receipts",
    visibility: "private",
    key: `receipts/${saleId}.pdf`,
    fileName: `${saleId}.pdf`,
    contentType: "application/pdf",
    sizeBytes: 900,
    sha256: "b".repeat(64),
    verifiedSha256: "b".repeat(64),
  });
  await db
    .update(sale)
    .set({ receiptAssetId: id })
    .where(and(eq(sale.orgId, ids.org), eq(sale.id, saleId)));
  const before = renders.length;

  expect(await renderSaleReceipt(deps(), ids.org, saleId)).toEqual({
    assetId: id,
    key: `receipts/${saleId}.pdf`,
    rendered: false,
  });
  expect(renders).toHaveLength(before);
  expect(stored.has(`${ids.org}/receipts/${saleId}.pdf`)).toBe(false);
});

test("racing renders agree on one asset whose digest is the bytes stored under its key", async () => {
  const saleId = await paidSale();
  // A writes its bytes, then is held until B has rendered, written and committed; only then does A commit.
  let putCalled!: () => void;
  const aPut = new Promise<void>((resolve) => (putCalled = resolve));
  let releaseA!: () => void;
  const aHeld = new Promise<void>((resolve) => (releaseA = resolve));
  const held = {
    ...blobs,
    put: async (orgId: string, key: string, value: Uint8Array) => {
      stored.set(`${orgId}/${key}`, value);
      putCalled();
      await aHeld;
    },
  } as unknown as Blobs;
  const a = renderSaleReceipt({ ...deps(), blobs: held }, ids.org, saleId);
  await aPut;
  const b = await renderSaleReceipt(deps(), ids.org, saleId);
  releaseA();
  expect((await a).assetId).toBe(b.assetId);

  const db = databases().db;
  const [row] = await db
    .select()
    .from(asset)
    .where(and(eq(asset.orgId, ids.org), eq(asset.id, b.assetId)));
  expect(row!.verifiedSha256).toBe(await sha256(stored.get(`${ids.org}/${row!.key}`)!));
  const [linked] = await db
    .select({ receiptAssetId: sale.receiptAssetId })
    .from(sale)
    .where(and(eq(sale.orgId, ids.org), eq(sale.id, saleId)));
  expect(linked!.receiptAssetId).toBe(b.assetId);
});

test("a sale of another shop, or none at all, is not found", async () => {
  await expect(renderSaleReceipt(deps(), ids.org, v7())).rejects.toMatchObject({ status: 404 });
});
