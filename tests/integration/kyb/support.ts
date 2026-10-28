// A cloud shop verifying its business for payouts: the shared API with the KYB routes, RustFS for the documents,
// the Paystack fake for banks and subaccounts, a captured Maileroo, and the notification queue that starts the
// KYB workflow on the box engine. Importing it registers the auth tenants and sessions.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { boxBlobs, boxKybFlows, boxQueue } from "@shopper/adapters-box";
import { createApi } from "@shopper/api";
import { createMaileroo } from "@shopper/auth";
import { deliverNotification } from "@shopper/core/notifications";
import { createPaystack } from "@shopper/core/payments/paystack";
import { NOTIFICATION_RETRY, type Blobs, type Envelope } from "@shopper/ports";
import { sha256 } from "@shopper/utils";
import { rustfs } from "../../../tooling/storage/buckets";
import { startPaystackFake } from "../../../tooling/paystack/server";
import { fileBucket } from "../../support/assets/buckets";
import { mailerooFixture } from "../../support/workflows/maileroo";
import { auth, context, cookies, db, otherAuth, request } from "../auth/setup";

export { context, cookies, db } from "../auth/setup";

const bucket = fileBucket();
const baseUrl = "http://shopper.test";
export const delivered: Envelope[] = [];
export let mail: Awaited<ReturnType<typeof mailerooFixture>>;
export let paystack: Awaited<ReturnType<typeof startPaystackFake>>;
export let blobs: Blobs;
export let api: ReturnType<typeof createApi>;
export let otherApi: ReturnType<typeof createApi>;
let directory: string;
let flows: ReturnType<typeof boxKybFlows>;
let flowDeps: Parameters<typeof boxKybFlows>[0];

/** A launcher with no memory of earlier runs, as after a box restart or a Cloudflare instance restart. */
export const freshKybFlows = () => boxKybFlows(flowDeps);

export const queue = boxQueue(NOTIFICATION_RETRY, async (delivery) => {
  delivered.push(delivery.message);
  await deliverNotification(
    {
      db,
      appVersion: "test",
      baseUrl,
      mail: createMaileroo({
        apiKey: mail.apiKey,
        from: "noreply@shopper.test",
        endpoint: mail.endpoint,
      }),
      kyb: flows,
    },
    delivery,
  );
});

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "shopper-kyb-"));
  ({ blobs } = await boxBlobs(directory, {
    baseUrl: "http://127.0.0.1",
    secret: new Uint8Array(32).fill(7),
    receiptsObjectStorage: { ...rustfs, bucket: await bucket },
  }));
  mail = await mailerooFixture();
  paystack = await startPaystackFake();
  const client = createPaystack({ secretKey: paystack.secretKey, baseUrl: paystack.baseUrl });
  flowDeps = { withDatabase: (run) => run(db), appVersion: "test", queue, blobs, paystack: client };
  flows = boxKybFlows(flowDeps);
  const kyb = { banks: () => client.banks() };
  api = createApi({ database: db, authentication: auth, notifications: queue, blobs, kyb });
  otherApi = createApi({
    database: db,
    authentication: otherAuth,
    notifications: queue,
    blobs,
    kyb,
  });
});
afterAll(async () => {
  await paystack?.stop();
  await mail?.close();
  await rm(directory, { recursive: true, force: true });
});

export const call = (path: string, method = "GET", body?: unknown, role = "superadmin") =>
  request(api, cookies.get(role)!, path, method, body);

/** Uploads a document as the browser would: a grant from the API, then the bytes straight to object storage. */
export async function upload(text = `scan ${crypto.randomUUID()}`, fileName = "scan.pdf") {
  const bytes = new TextEncoder().encode(text);
  const granted = await call("/kyb/documents", "POST", {
    fileName,
    contentType: "application/pdf",
    sizeBytes: bytes.byteLength,
    sha256: await sha256(bytes),
  });
  expect(granted.status).toBe(201);
  const grant = (await granted.json()) as {
    assetId: string;
    url: string;
    headers: Record<string, string>;
  };
  const put = await fetch(grant.url, { method: "PUT", headers: grant.headers, body: bytes });
  expect(put.ok).toBe(true);
  return grant.assetId;
}

const inYears = (years: number) => {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
};

/** A complete, valid case; `extra` overrides any part of it. */
export async function validCase(extra: Record<string, unknown> = {}) {
  return {
    businessName: "Ama Mart Limited",
    registrationNumber: "CS123456789",
    tin: "C0012345678",
    settlementBank: "040",
    settlementAccount: "1234567890123",
    directors: [
      {
        name: "Ama Mensah",
        ghanaCard: "GHA-123456789-0",
        cardExpiresOn: inYears(5),
        cardAssetId: await upload(),
      },
    ],
    documents: [
      { kind: "registration_certificate", assetId: await upload(), expiresOn: null },
      { kind: "tin_certificate", assetId: await upload(), expiresOn: null },
    ],
    ...extra,
  };
}

export async function caseRow(orgId = context.orgId) {
  const [row] = await db.select().from(schema.kybCase).where(eq(schema.kybCase.orgId, orgId));
  return row;
}

export async function waitForStatus(status: string, orgId = context.orgId) {
  await vi.waitFor(async () => expect((await caseRow(orgId))?.status).toBe(status), {
    timeout: 10_000,
    interval: 50,
  });
}

export const kybEmails = () => mail.requests.filter((sent) => /verification/i.test(sent.subject));
