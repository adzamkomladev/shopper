// POST /sync/audit: a till uploads its own hash chain after the server's head, {requestId, entries} → {requestId,
// accepted: {head}} or {requestId, rejected: {code, message}}. The server re-checks every hash and link, stores the rows
// verbatim per register and only ever appends; a replay is free, and a forged, forked or foreign chain is refused.
import { afterEach, expect, test } from "vite-plus/test";
import { and, asc, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { auditLog, deviceAudit } from "@shopper/db-pg";
import { tillAudit, tillState } from "@shopper/db-sqlite";
import { createAuditUploadWorker, createPushWorker } from "@shopper/sync";
import { verifyStream } from "@shopper/core/audit";
import { Client } from "pg";
import {
  api,
  context,
  databaseConnectionString,
  databases,
  deviceId,
} from "../../support/till/server";
import { syncHeaders } from "../../support/till/requests";
import { createPushFixture, type PushFixture } from "../../support/till/push";

let fixture: PushFixture | undefined;
let worker: ReturnType<typeof createAuditUploadWorker> | undefined;
afterEach(async () => {
  await worker?.stop();
  await fixture?.close();
  fixture = worker = undefined;
});

const tillChain = () =>
  fixture!.database.read((tx) => tx.select().from(tillAudit).orderBy(asc(tillAudit.chainSeq)));
const serverChain = (stream = deviceId) =>
  databases()
    .db.select()
    .from(deviceAudit)
    .where(and(eq(deviceAudit.orgId, context.orgId), eq(deviceAudit.streamId, stream)))
    .orderBy(asc(deviceAudit.chainSeq));
const uploads = () =>
  databases()
    .db.select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, context.orgId), eq(auditLog.command, "device.audit.upload")))
    .orderBy(asc(auditLog.chainSeq));
const post = async (entries: unknown[], headers = syncHeaders()) => {
  const response = await api.request("/sync/audit", {
    method: "POST",
    headers,
    body: JSON.stringify({ requestId: v7(), entries }),
  });
  return { status: response.status, body: await response.json() };
};
const wire = (rows: Awaited<ReturnType<typeof tillChain>>) => JSON.parse(JSON.stringify(rows));

/** A till with a sale acknowledged, so its chain has the provisioning, sale and push rows. */
async function tillWithSale() {
  fixture = await createPushFixture();
  await fixture.recordSale();
  const push = createPushWorker(fixture.workerOptions);
  fixture.worker = push;
  await push.trigger();
  return tillChain();
}

test("the chain uploads in order in batches, is stored row for row and verifies as the register's stream", async () => {
  const chain = await tillWithSale();
  expect(chain.length).toBeGreaterThan(4);
  worker = createAuditUploadWorker({ ...fixture!.workerOptions, batch: 2 });
  await worker.trigger();
  const posts = fixture!.upstream.requests.filter((r) => r.path === "/sync/audit");
  expect(posts).toHaveLength(Math.ceil(chain.length / 2));
  const stored = await serverChain();
  expect(stored.map((r) => [r.id, r.chainSeq, r.prevHash, r.hash, r.deviceId])).toEqual(
    chain.map((r) => [r.id, r.chainSeq, r.prevHash, r.hash, r.deviceId]),
  );
  expect(await verifyStream(databases().db, context.orgId, deviceId)).toEqual({
    valid: true,
    count: chain.length,
    head: { seq: chain.at(-1)!.chainSeq, hash: chain.at(-1)!.hash },
  });
  // Each stored batch is anchored in the org chain by the head it reached.
  expect((await uploads()).map((row) => row.payload)).toEqual(
    stored
      .filter((_, i) => i % 2 === 1 || i === stored.length - 1)
      .map((row) => expect.objectContaining({ to: row.chainSeq, head: row.hash })),
  );
  const [state] = await fixture!.database.read((tx) => tx.select().from(tillState));
  expect(state).toMatchObject({ auditUploadedSeq: chain.at(-1)!.chainSeq, auditBlockedCode: null });

  await worker.trigger(true);
  expect(fixture!.upstream.requests.filter((r) => r.path === "/sync/audit")).toHaveLength(
    posts.length,
  );
});

test("a replay answers the head without a new org row; a batch past a gap answers the head and stores nothing", async () => {
  const chain = wire(await tillWithSale());
  expect((await post(chain.slice(0, 3))).body).toMatchObject({
    accepted: { head: { seq: 3, hash: chain[2].hash } },
  });
  const before = (await uploads()).length;
  expect((await post(chain.slice(0, 3))).body).toMatchObject({
    accepted: { head: { seq: 3, hash: chain[2].hash } },
  });
  expect((await post(chain.slice(4))).body).toMatchObject({
    accepted: { head: { seq: 3, hash: chain[2].hash } },
  });
  expect(await uploads()).toHaveLength(before);
  expect(await serverChain()).toHaveLength(3);
  expect((await post(chain.slice(1))).body).toMatchObject({
    accepted: { head: { seq: chain.length } },
  });
});

test("a forged entry, a fork from the stored chain or another organisation is refused for good and audited", async () => {
  const chain = wire(await tillWithSale());
  expect((await post(chain.slice(0, 2))).status).toBe(200);

  const forged = chain
    .slice(2)
    .map((row: { payload: object }, i: number) =>
      i === 1 ? { ...row, payload: { ...row.payload, forged: true } } : row,
    );
  expect((await post(forged)).body).toMatchObject({ rejected: { code: "HASH" } });
  const fork = [{ ...chain[1], hash: "a".repeat(64) }, ...chain.slice(2)];
  expect((await post(fork)).body).toMatchObject({ rejected: { code: "FORK" } });
  const foreign = chain.slice(2).map((row: object) => ({ ...row, orgId: v7() }));
  expect((await post(foreign)).body).toMatchObject({ rejected: { code: "SCOPE" } });
  expect((await post([{ id: "not-an-entry" }])).body).toMatchObject({
    rejected: { code: "INVALID_EVENT" },
  });
  expect((await post(chain, { "content-type": "application/json" })).status).toBe(401);

  expect(await serverChain()).toHaveLength(2);
  expect(
    (await uploads()).filter((row) => row.payload.outcome === "rejected").map((r) => r.payload),
  ).toEqual([
    expect.objectContaining({ code: "HASH" }),
    expect.objectContaining({ code: "FORK" }),
    expect.objectContaining({ code: "SCOPE" }),
  ]);
});

test("a till whose own chain was edited is blocked at the first upload and stops sending", async () => {
  const chain = await tillWithSale();
  await fixture!.database.transaction((tx) =>
    tx
      .update(tillAudit)
      .set({ reason: "edited after the fact" })
      .where(eq(tillAudit.id, chain[1]!.id)),
  );
  worker = createAuditUploadWorker(fixture!.workerOptions);
  await worker.trigger();
  const [state] = await fixture!.database.read((tx) => tx.select().from(tillState));
  expect(state).toMatchObject({ auditUploadedSeq: 0, auditBlockedCode: "HASH" });
  await worker.trigger(true);
  expect(fixture!.upstream.requests.filter((r) => r.path === "/sync/audit")).toHaveLength(1);
  expect(await serverChain()).toHaveLength(0);
});

test("a stored device row edited in the database is flagged by the register's verification", async () => {
  const chain = await tillWithSale();
  worker = createAuditUploadWorker(fixture!.workerOptions);
  await worker.trigger();
  const target = (await serverChain())[2]!;
  const client = new Client({ connectionString: databaseConnectionString() });
  await client.connect();
  try {
    await client.query("SET session_replication_role = replica");
    await client.query(`UPDATE device_audit SET command = 'sale.forged' WHERE id = $1`, [
      target.id,
    ]);
  } finally {
    await client.end();
  }
  expect(await verifyStream(databases().db, context.orgId, deviceId)).toEqual({
    valid: false,
    entryId: target.id,
    seq: target.chainSeq,
    reason: "hash",
  });
  expect(chain.length).toBeGreaterThan(2);
  await expect(
    databases().db.delete(deviceAudit).where(eq(deviceAudit.id, target.id)),
  ).rejects.toThrow();
});
