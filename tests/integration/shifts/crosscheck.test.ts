// A Z is checked when it is read, against what the server itself holds (nothing is stored, so a late upload corrects
// itself):
//   totals: the register's own sales and refunds between the shift's open and close, summed the way the till sums
//           them, against the Z's sales, refunds and takings per tender -> matched | mismatch naming the fields
//   anchor: the uploaded register chain at the Z's anchor seq -> verified | pending (not uploaded) | mismatch
import { afterEach, expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { readShift, listShifts } from "@shopper/core/shifts";
import { deviceAudit } from "@shopper/db-pg";
import { createAuditUploadWorker, createPushWorker, createShiftUploadWorker } from "@shopper/sync";
import { Client } from "pg";
import { context, databaseConnectionString, databases, deviceId } from "../../support/till/server";
import { createPushFixture, type PushFixture } from "../../support/till/push";
import { closeFixtureShift, freshShift } from "../../support/sync/shifts";
import { postShift, refigure } from "../../support/sales/shifts";

let fixture: PushFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

/** Two sales on a fresh shift, the Z, and the sales, then the Z, uploaded as the till does it, chain left behind. */
async function closedShift() {
  fixture = await createPushFixture();
  await freshShift();
  await fixture.recordSale();
  await fixture.recordSale({ lineCount: 2 });
  const z = await closeFixtureShift();
  const push = createPushWorker(fixture.workerOptions);
  fixture.worker = push;
  await push.trigger();
  const shifts = createShiftUploadWorker(fixture.workerOptions);
  await shifts.trigger();
  await shifts.stop();
  const posted = fixture.upstream.requests.find((r) => r.path === "/sync/shifts")!.body as {
    proof: string;
    shift: { shift: { report: typeof z } };
  };
  return { z, posted };
}

test("a Z that adds up to the server's sales matches, and its anchor verifies once the chain is uploaded", async () => {
  const { z } = await closedShift();
  const before = await readShift(databases().db, context.orgId, z.shiftId);
  expect(before?.checks).toEqual({ totals: { status: "matched" }, anchor: "pending" });

  const audit = createAuditUploadWorker(fixture!.workerOptions);
  await audit.trigger();
  await audit.stop();
  expect((await readShift(databases().db, context.orgId, z.shiftId))?.checks).toEqual({
    totals: { status: "matched" },
    anchor: "verified",
  });
  const listed = (await listShifts(databases().db, context.orgId)).shifts.find(
    (s) => s.id === z.shiftId,
  );
  expect(listed?.checks).toEqual({ totals: { status: "matched" }, anchor: "verified" });
});

test("a Z claiming more cash sales than the server holds is a mismatch naming them", async () => {
  const { z, posted } = await closedShift();
  const inflated = structuredClone(posted.shift);
  const report = inflated.shift.report;
  const extra = 10_000;
  report.shiftId = v7();
  report.sales.count += 1;
  report.sales.gross += extra;
  report.tenders[0]!.sales += extra;
  report.tenders[0]!.expected += extra;
  report.cash.sales += extra;
  report.cash.expected += extra;
  report.declared.cash += extra;
  report.declared.counts = {
    ...report.declared.counts,
    "10000": (report.declared.counts["10000"] ?? 0) + 1,
  };
  inflated.shift.report = refigure(report);
  const accepted = await postShift(inflated, posted.proof);
  expect(accepted.body.accepted, JSON.stringify(accepted.body)).toBeDefined();
  // The real Z and the inflated one cover the same window: only the inflated one disagrees.
  expect((await readShift(databases().db, context.orgId, z.shiftId))?.checks.totals).toEqual({
    status: "matched",
  });
  expect((await readShift(databases().db, context.orgId, report.shiftId))?.checks.totals).toEqual({
    status: "mismatch",
    fields: ["sales.count", "sales.gross", "cash.sales"],
  });
});

test("a Z whose anchor no longer matches the uploaded chain is an anchor mismatch", async () => {
  const { z } = await closedShift();
  const audit = createAuditUploadWorker(fixture!.workerOptions);
  await audit.trigger();
  await audit.stop();
  const [row] = await databases()
    .db.select({ id: deviceAudit.id })
    .from(deviceAudit)
    .where(
      and(
        eq(deviceAudit.orgId, context.orgId),
        eq(deviceAudit.streamId, deviceId),
        eq(deviceAudit.chainSeq, z.anchor.seq),
      ),
    );
  const client = new Client({ connectionString: databaseConnectionString() });
  await client.connect();
  try {
    await client.query("SET session_replication_role = replica");
    await client.query(`UPDATE device_audit SET hash = $1 WHERE id = $2`, [
      "f".repeat(64),
      row!.id,
    ]);
  } finally {
    await client.end();
  }
  expect((await readShift(databases().db, context.orgId, z.shiftId))?.checks.anchor).toBe(
    "mismatch",
  );
});
