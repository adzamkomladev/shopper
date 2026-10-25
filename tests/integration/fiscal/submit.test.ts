// One submission of one fiscal document: an accepted document keeps the SDC's signature, a rejection is final, and
// an SDC that is down leaves the document pending for the lane to retry until the tenth failure dead-letters it.
// Every transition is an audited command.
import { afterAll, beforeAll, beforeEach, expect, test } from "vite-plus/test";
import { asc, eq } from "drizzle-orm";
import { auditLog, fiscalDoc } from "@shopper/db-pg";
import { verifyChain } from "@shopper/audit";
import {
  createSdc,
  retryFiscalDoc,
  submitFiscalDoc,
  FISCAL_MAX_ATTEMPTS,
} from "@shopper/core/fiscal";
import type { GoldenSale } from "../../fixtures/sales/golden/types";
import { goldenWorld } from "../../support/sales/golden/setup";
import { runGolden } from "../../support/sales/golden/run";
import { startSdcFake } from "../../../tooling/sdc/server";

const scenario: GoldenSale = {
  name: "fiscal submit",
  lines: [{ product: "standard", quantity: 1_000 }],
  tenders: [{ kind: "cash", amount: 500_000 }],
};
const fake = await startSdcFake();
const sdc = createSdc({ url: fake.url, apiKey: fake.apiKey });
let world: Awaited<ReturnType<typeof goldenWorld>>;
beforeAll(async () => {
  world = await goldenWorld();
});
afterAll(async () => {
  await world?.local.close();
  await fake.stop();
});
beforeEach(() => fake.reset());

const ctx = () => ({ orgId: world.config.orgId, appVersion: world.config.appVersion });
async function pendingDoc() {
  const sold = (await runGolden(world, scenario))!;
  const [doc] = await world.db.select().from(fiscalDoc).where(eq(fiscalDoc.saleId, sold.id));
  return doc!;
}
const reload = async (id: string) =>
  (await world.db.select().from(fiscalDoc).where(eq(fiscalDoc.id, id)))[0]!;
const audits = async (id: string) =>
  (await world.db.select().from(auditLog).orderBy(asc(auditLog.chainSeq))).filter(
    (row) => row.entityId === id,
  );

test("an accepted document keeps the SDC's signature and QR, and each step is audited", async () => {
  const doc = await pendingDoc();
  expect(await submitFiscalDoc(world.db, ctx(), sdc, doc.id)).toBe("done");
  const [arrival] = fake.arrivals;
  expect(arrival).toEqual({ invoiceNumber: doc.invoiceNumber, payload: doc.payload });
  const saved = await reload(doc.id);
  expect(saved).toMatchObject({
    status: "accepted",
    attempts: 1,
    sdcId: fake.sdcId,
    sdcCounter: 1,
  });
  expect(saved.qr).toContain(saved.signature!);
  expect(saved.acceptedAt).toBeInstanceOf(Date);
  expect((await audits(doc.id)).map((row) => row.command)).toEqual([
    "fiscal.submit",
    "fiscal.settle",
  ]);
  const chain = await world.db.select().from(auditLog).orderBy(asc(auditLog.chainSeq));
  expect(await verifyChain(chain.filter((row) => row.orgId === doc.orgId))).toMatchObject({
    valid: true,
  });
  // Settled documents are never sent again.
  expect(await submitFiscalDoc(world.db, ctx(), sdc, doc.id)).toBe("done");
  expect(fake.arrivals).toHaveLength(1);
});

test("a rejection is final: the code and message are kept and the document is not retried", async () => {
  const doc = await pendingDoc();
  fake.reject(doc.invoiceNumber, "E_TIN", "Buyer TIN is not registered");
  expect(await submitFiscalDoc(world.db, ctx(), sdc, doc.id)).toBe("done");
  expect(await reload(doc.id)).toMatchObject({
    status: "rejected",
    rejectionCode: "E_TIN",
    rejectionMessage: "Buyer TIN is not registered",
    signature: null,
  });
  expect(await submitFiscalDoc(world.db, ctx(), sdc, doc.id)).toBe("done");
  expect(fake.arrivals).toHaveLength(1);
});

test("an SDC that is down leaves the document pending, and the tenth failure dead-letters it", async () => {
  const doc = await pendingDoc();
  fake.down();
  for (let attempt = 1; attempt < FISCAL_MAX_ATTEMPTS; attempt++) {
    expect(await submitFiscalDoc(world.db, ctx(), sdc, doc.id)).toBe("retry");
    expect(await reload(doc.id)).toMatchObject({ status: "pending", attempts: attempt });
  }
  expect((await reload(doc.id)).lastError).toMatch(/SDC/);
  expect(await submitFiscalDoc(world.db, ctx(), sdc, doc.id)).toBe("done");
  expect(await reload(doc.id)).toMatchObject({ status: "dead", attempts: FISCAL_MAX_ATTEMPTS });

  // A manual retry puts it back as pending with a fresh count; the next submission is accepted.
  await expect(
    retryFiscalDoc(world.db, { ...ctx(), actorId: world.session.userId }, { docId: doc.id }),
  ).resolves.toMatchObject({ storeId: doc.storeId });
  expect(await reload(doc.id)).toMatchObject({ status: "pending", attempts: 0 });
  fake.up();
  expect(await submitFiscalDoc(world.db, ctx(), sdc, doc.id)).toBe("done");
  expect(await reload(doc.id)).toMatchObject({ status: "accepted", attempts: 1 });
  expect((await audits(doc.id)).map((row) => row.command)).toContain("fiscal.retry");
});

test("only a dead-lettered document can be retried by hand", async () => {
  const doc = await pendingDoc();
  await expect(
    retryFiscalDoc(world.db, { ...ctx(), actorId: world.session.userId }, { docId: doc.id }),
  ).rejects.toThrow(/dead-lettered/);
});
