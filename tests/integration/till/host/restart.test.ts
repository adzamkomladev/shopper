import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { auditLog, sale } from "@shopper/db-pg";
import { api, databases, syncProtocol } from "../../../support/till/server";
import { createFailOnceSequencer, createSyncApi } from "../../../support/till/requests";
import { Database } from "../../../support/till/sqlcipher";
import { createHostFixture } from "../../../support/till/host/fixture";
import { startHostUpstream } from "../../../support/till/host/upstream";

let fixture: Awaited<ReturnType<typeof createHostFixture>> | undefined;
let upstream: Awaited<ReturnType<typeof startHostUpstream>> | undefined;
// Same SQLite build as the host: two builds in one process would drop each other's POSIX file locks.
let heldLock: InstanceType<typeof Database> | undefined;
afterEach(async () => {
  if (heldLock) {
    heldLock.close();
    heldLock = undefined;
  }
  await fixture?.close();
  await upstream?.close();
  fixture = undefined;
  upstream = undefined;
});

describe("till host restart recovery", () => {
  it("replays an accepted sale after sequencing failed before the first response", async () => {
    const failingApi = await createSyncApi(syncProtocol, createFailOnceSequencer());
    upstream = await startHostUpstream(failingApi);
    const gate = upstream.holdNextPush();
    fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
    let host = await fixture.start();
    const event = await recordThroughHost(host, fixture.config.references.products[0].id);
    const first = await upstream.waitForPush(1);
    expect(first.status).toBe(503);
    const { db, context } = databases();
    const pending = await db
      .select()
      .from(sale)
      .where(and(eq(sale.orgId, context.orgId), eq(sale.localId, event.localId)));
    expect(pending).toHaveLength(1);
    expect(pending[0]?.storeSequence).toBeNull();
    expect(await saleAudits(db, context.orgId, event.localId)).toEqual(["sale.accept"]);
    await host.kill();
    gate.release();
    await gate.written;
    expect(await fixture.queued()).toHaveLength(1);

    host = await fixture.start({ ...fixture.config, session: null });
    expect(await upstream.waitForPush(2)).toMatchObject({
      status: 200,
      response: { accepted: [{ localId: event.localId }], rejected: [] },
    });
    await waitForDrained(host);
    await expectAssignedOnce(event.localId);
    expect(await fixture.queued()).toHaveLength(0);
    expect(await fixture.localSales()).toHaveLength(1);
  });

  it("replays an assigned sale after SIGKILL before the server response", async () => {
    upstream = await startHostUpstream(api);
    const gate = upstream.holdNextPush();
    fixture = await createHostFixture({ upstream: upstream.url, freshSession: true });
    let host = await fixture.start();
    const event = await recordThroughHost(host, fixture.config.references.products[0].id);
    await gate.entered;
    expect(upstream.requests.find((request) => request.path === "/sync/push")).toMatchObject({
      status: 200,
      response: { accepted: [{ localId: event.localId }], rejected: [] },
    });
    await host.kill();
    gate.release();
    await gate.written;
    expect(await fixture.queued()).toHaveLength(1);

    host = await fixture.start({ ...fixture.config, session: null });
    expect(await upstream.waitForPush(2)).toMatchObject({
      status: 200,
      response: { accepted: [{ localId: event.localId }], rejected: [] },
    });
    await waitForDrained(host);
    await expectAssignedOnce(event.localId);
    expect(await fixture.queued()).toHaveLength(0);
    expect(await fixture.localSales()).toHaveLength(1);
  });

  it("recovers after the host receives the response but cannot acknowledge under a SQLite writer lock", async () => {
    fixture = await createHostFixture({ upstream: "http://127.0.0.1:1", freshSession: true });
    let host = await fixture.start();
    const event = await recordThroughHost(host, fixture.config.references.products[0].id);
    expect((await host.request({ type: "retry" })).type).toBe("result");
    await host.stop();
    expect(await fixture.queued()).toHaveLength(1);

    upstream = await startHostUpstream(api);
    const gate = upstream.holdNextPush();
    host = await fixture.start({ ...fixture.config, upstream: upstream.url, session: null });
    await gate.entered;
    // The host may be mid-write (its pull worker starts with the push), so wait for the lock briefly.
    heldLock = new Database(fixture.sqlitePath, { timeout: 5_000 });
    heldLock.exec("BEGIN IMMEDIATE");
    expect(upstream.requests.find((request) => request.path === "/sync/push")).toMatchObject({
      status: 200,
      response: { accepted: [{ localId: event.localId }], rejected: [] },
    });
    gate.release();
    await gate.written;
    const storageFailure = await readUntilStorageFailure(host);
    expect(JSON.stringify(storageFailure)).not.toMatch(
      /SQLITE_BUSY|private-cashier-proof|device-token/i,
    );
    expect(await fixture.queued()).toHaveLength(1);
    await host.kill();
    heldLock.exec("ROLLBACK");
    heldLock.close();
    heldLock = undefined;

    host = await fixture.start({ ...fixture.config, upstream: upstream.url, session: null });
    expect(await upstream.waitForPush(2)).toMatchObject({
      status: 200,
      response: { accepted: [{ localId: event.localId }], rejected: [] },
    });
    await waitForDrained(host);
    await expectAssignedOnce(event.localId);
    expect(await fixture.queued()).toHaveLength(0);
    expect(await fixture.localSales()).toHaveLength(1);
  });
});

async function recordThroughHost(
  host: Awaited<ReturnType<Awaited<ReturnType<typeof createHostFixture>>["start"]>>,
  productId: string,
) {
  const reply = await host.request({
    type: "recordSale",
    input: { lines: [{ productId, quantityThousandths: 1_500 }] },
  });
  expect(reply).toMatchObject({ type: "result", kind: "sale" });
  const event = (reply as { event: { sale: { localId: string } } }).event;
  return { localId: event.sale.localId };
}

async function waitForDrained(
  host: Awaited<ReturnType<Awaited<ReturnType<typeof createHostFixture>>["start"]>>,
) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await host.request({ type: "status" });
    if (
      response.type === "result" &&
      response.kind === "status" &&
      isRecord(response.status) &&
      response.status.pendingCount === 0
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("The host outbox did not drain after replay");
}

async function readUntilStorageFailure(
  host: Awaited<ReturnType<Awaited<ReturnType<typeof createHostFixture>>["start"]>>,
) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await host.request({ type: "status" });
    if (
      response.type === "result" &&
      response.kind === "status" &&
      isRecord(response.status) &&
      isRecord(response.status.lastError) &&
      response.status.lastError.code === "STORAGE_FAILED"
    )
      return response;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("The host did not expose the failed local acknowledgement");
}

async function expectAssignedOnce(localId: string) {
  const { db, context } = databases();
  const rows = await db
    .select()
    .from(sale)
    .where(and(eq(sale.orgId, context.orgId), eq(sale.localId, localId)));
  expect(rows).toHaveLength(1);
  expect(rows[0]?.storeSequence).not.toBeNull();
  expect(await saleAudits(db, context.orgId, localId).then((commands) => commands.sort())).toEqual([
    "sale.accept",
    "sale.assign-sequence",
  ]);
}

async function saleAudits(db: ReturnType<typeof databases>["db"], orgId: string, localId: string) {
  const rows = await db
    .select({ command: auditLog.command })
    .from(auditLog)
    .where(
      and(eq(auditLog.orgId, orgId), eq(auditLog.entity, "sale"), eq(auditLog.entityId, localId)),
    );
  return rows.map((row) => row.command);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
