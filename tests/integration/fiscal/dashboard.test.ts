// Notion Day 19: "Rejected doc appears on the dashboard". The fiscal API lists documents by status with counts and the
// reason each one stopped; reading needs tax.read, retrying a dead-lettered one needs tax.write and puts it back on
// its store's lane. The archive lists each hour's bundle with a download link.
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { createApi } from "@shopper/api";
import { boxBlobs } from "@shopper/adapters-box";
import { archiveFiscalHour, createSdc, fiscalHour, submitFiscalDoc } from "@shopper/core/fiscal";
import type { Lane } from "@shopper/ports";
import { startSdcFake } from "../../../tooling/sdc/server";
import { provisionPendingSale } from "../../support/till/pending/sale";
import { seedFiscalDocs } from "../../support/fiscal/docs";
import { auth, context, cookies, db, request } from "../auth/setup";

const fake = await startSdcFake();
const sdc = createSdc({ url: fake.url, apiKey: fake.apiKey });
const enqueued: string[] = [];
const lane: Lane = { enqueue: async (_org, _store, docId) => void enqueued.push(docId) };
let api: ReturnType<typeof createApi>;
let unwired: ReturnType<typeof createApi>;
let dir: string;
let docs: string[];
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "shopper-fiscal-dashboard-"));
  const blobs = (
    await boxBlobs(dir, { baseUrl: "http://127.0.0.1/blobs", secret: new Uint8Array(32).fill(5) })
  ).blobs;
  api = createApi({ database: db, authentication: auth, lane, blobs });
  unwired = createApi({ database: db, authentication: auth });
  const [store] = await db
    .insert(schema.store)
    .values({ orgId: context.orgId, name: "Fiscal store" })
    .returning();
  const pending = await provisionPendingSale(db, context, store!.id, context.orgId, "test");
  docs = await seedFiscalDocs(db, context, {
    baseLocalId: pending.localId,
    storeId: store!.id,
    prefix: "INV",
    count: 4,
  });
  const ctx = { orgId: context.orgId, appVersion: "test" };
  fake.reject("INV-1", "E_TIN", "Buyer TIN is not registered");
  await submitFiscalDoc(db, ctx, sdc, docs[0]!);
  await submitFiscalDoc(db, ctx, sdc, docs[1]!);
  fake.failNext(10);
  for (let attempt = 0; attempt < 10; attempt++) await submitFiscalDoc(db, ctx, sdc, docs[2]!);
  await archiveFiscalHour(db, ctx, {
    storeId: store!.id,
    hour: fiscalHour(new Date()).toISOString(),
    blobs,
  });
});
afterAll(async () => {
  await fake.stop();
  if (dir) await rm(dir, { recursive: true, force: true });
});

const json = async (who: string, path: string, method = "GET", target = api) => {
  const response = await request(target, cookies.get(who)!, path, method);
  return { status: response.status, body: await response.json() };
};

test("Rejected doc appears on the dashboard", async () => {
  const { status, body } = await json("accountant", "/tax/fiscal?status=rejected");
  expect(status).toBe(200);
  expect(body.connected).toBe(true);
  expect(body.counts).toEqual({ all: 4, pending: 1, accepted: 1, rejected: 1, dead: 1 });
  expect(body.documents).toEqual([
    expect.objectContaining({
      id: docs[0],
      invoiceNumber: "INV-1",
      kind: "invoice",
      status: "rejected",
      reason: "E_TIN: Buyer TIN is not registered",
      branchName: "Conformance branch",
    }),
  ]);
  const detail = await json("accountant", `/tax/fiscal/${docs[0]}`);
  expect(detail.body).toMatchObject({
    branchName: "Conformance branch",
    status: "rejected",
    rejectionCode: "E_TIN",
    rejectionMessage: "Buyer TIN is not registered",
    payload: { invoiceNumber: "INV-1" },
  });
  // Pending means not yet signed: waiting, or being sent right now.
  const pending = await json("accountant", "/tax/fiscal?status=pending");
  expect(pending.body.documents.map((doc: { id: string }) => doc.id)).toEqual([docs[3]]);
  const all = await json("accountant", "/tax/fiscal");
  expect(all.body.documents).toHaveLength(4);
  expect(
    (await json("accountant", "/tax/fiscal?q=inv-2")).body.documents.map(
      (doc: { invoiceNumber: string }) => doc.invoiceNumber,
    ),
  ).toEqual(["INV-2"]);
});

test("reading needs tax.read; retrying a dead-lettered document needs tax.write and queues it again", async () => {
  expect((await json("cashier", "/tax/fiscal")).status).toBe(403);
  expect((await json("cashier", `/tax/fiscal/${docs[2]}`)).status).toBe(403);
  expect((await json("accountant", `/tax/fiscal/${docs[2]}/retry`, "POST")).status).toBe(403);
  expect((await json("superadmin", `/tax/fiscal/${docs[0]}/retry`, "POST")).status).toBe(409);
  const retried = await json("superadmin", `/tax/fiscal/${docs[2]}/retry`, "POST");
  expect(retried.status).toBe(200);
  expect(retried.body).toMatchObject({ id: docs[2], status: "pending", attempts: 0 });
  expect(enqueued).toEqual([docs[2]]);
  const audits = await db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.entityId, docs[2]!));
  expect(audits.map((row) => row.command)).toContain("fiscal.retry");
});

test("without an SDC lane the dashboard says the SDC is not connected", async () => {
  expect((await json("accountant", "/tax/fiscal", "GET", unwired)).body.connected).toBe(false);
});

test("the archive lists each hour's bundle with a link to download it", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const { status, body } = await json("accountant", `/tax/fiscal/archives?date=${today}`);
  expect(status).toBe(200);
  expect(body.archives).toEqual([
    expect.objectContaining({
      storeName: "Fiscal store",
      hour: fiscalHour(new Date()).toISOString(),
      docCount: 1,
      url: expect.stringContaining("http://127.0.0.1/blobs"),
    }),
  ]);
  expect((await json("accountant", "/tax/fiscal/archives?date=nope")).status).toBe(400);
});
