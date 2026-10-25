// Price override over the host bridge: { type: "line.price", expectedRevision, lineId, unitPrice, reason, approval? }
// with approval = { approverId, pin }. A cashier without sale.price_override needs a manager's PIN (APPROVAL_REQUIRED
// without one); the till_audit row names both the cashier (actor_id) and the manager (approver_id).
import { afterEach, expect, it } from "vite-plus/test";
import { v7 } from "uuid";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { setDraftPrice } from "@shopper/core/till";
import { tillAudit } from "@shopper/db-sqlite";
import { manager, startWithManager } from "../../../../support/till/host/approvals";
import { pin as managerPin } from "../../../../support/till/approvers";
import {
  add,
  at,
  ctx,
  priceLabel,
  scope,
  session,
  withTill,
  world,
} from "../../../../support/till/drafts";

let fixture: Awaited<ReturnType<typeof startWithManager>>["fixture"] | undefined;
afterEach(async () => fixture?.close());

const reason = "Damaged pack";

async function start() {
  const started = await startWithManager();
  fixture = started.fixture;
  return started;
}

it("Override without manager PIN is refused; with PIN, audit shows both actor and approver", async () => {
  const { host, lineId } = await start();
  const request = { type: "line.price", expectedRevision: 1, lineId, unitPrice: 9_000, reason };
  expect(await host.request(request)).toMatchObject({
    type: "error",
    code: "APPROVAL_REQUIRED",
  });
  const approved = await host.request({
    ...request,
    approval: { approverId: manager, pin: managerPin },
  });
  expect(approved).toMatchObject({
    kind: "draft",
    view: {
      draft: { revision: 2, lines: [{ id: lineId, override: { unitPrice: 9_000, reason } }] },
      quote: { lines: [{ lineId, listPrice: 12_000, tax: { unitPrice: 9_000, gross: 9_000 } }] },
    },
  });
  const rows = await fixture!.database.read((tx) => tx.select().from(tillAudit));
  const entries = rows.filter((row) => row.command === "till.draft.price");
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    actorId: fixture!.config.session!.userId,
    approverId: manager,
    entity: "product",
    entityId: expect.any(String),
    before: { unitPrice: 12_000 },
    after: { unitPrice: 9_000, reason, lineId },
  });
  expect(JSON.stringify(rows)).not.toContain(managerPin);
  expect(await verifyChain(rows as AuditEntry[])).toMatchObject({ valid: true });
});

it("a wrong manager PIN or a manager who cannot approve is refused and nothing changes", async () => {
  const { host, lineId } = await start();
  const request = { type: "line.price", expectedRevision: 1, lineId, unitPrice: 9_000, reason };
  expect(
    await host.request({ ...request, approval: { approverId: manager, pin: "0000" } }),
  ).toMatchObject({ type: "error", code: "APPROVAL_INVALID" });
  expect(
    await host.request({ ...request, approval: { approverId: v7(), pin: managerPin } }),
  ).toMatchObject({ type: "error", code: "APPROVAL_FORBIDDEN" });
  expect(await host.request({ type: "readDraft" })).toMatchObject({
    view: { draft: { revision: 1, lines: [{ id: lineId }] }, quote: { totals: { gross: 12_000 } } },
  });
});

it("a price-labelled line cannot be overridden, even with an approver", async () => {
  await withTill(async (db) => {
    await world(db);
    const added = await add(db, 0, { code: priceLabel });
    const lineId = added.draft!.lines[0]!.id;
    await expect(
      setDraftPrice(db, ctx, {
        scope,
        at,
        expectedRevision: 1,
        session,
        lineId,
        unitPrice: 5_000,
        reason,
        approverId: manager,
      }),
    ).rejects.toMatchObject({ code: "OVERRIDE_INVALID" });
  });
});
