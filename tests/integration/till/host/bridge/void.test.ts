// Voiding after a card tender over the host bridge: { type: "sale.void", expectedRevision, reason, approval? }.
// The host verifies the manager PIN; the till_audit row names the cashier (actor_id) and the manager (approver_id).
import { afterEach, expect, it } from "vite-plus/test";
import { verifyChain, type AuditEntry } from "@shopper/audit";
import { tillAudit } from "@shopper/db-sqlite";
import { auditText, pin } from "../../../../support/till/approvers";
import { manager, startWithManager } from "../../../../support/till/host/approvals";

let fixture: Awaited<ReturnType<typeof startWithManager>>["fixture"] | undefined;
afterEach(async () => fixture?.close());

async function tendered() {
  const started = await startWithManager();
  fixture = started.fixture;
  await started.host.request({
    type: "tender.add",
    expectedRevision: 1,
    kind: "card",
    amount: 5_000,
    approvalCode: "AB12CD",
    last4: "4242",
  });
  return started.host;
}
const voidRequest = { type: "sale.void", expectedRevision: 2, reason: "Customer left" };

it("voiding after a card tender without a manager is refused and the basket stays open", async () => {
  const host = await tendered();
  expect(await host.request(voidRequest)).toMatchObject({
    type: "error",
    code: "APPROVAL_REQUIRED",
  });
  expect(await host.request({ type: "readDraft" })).toMatchObject({
    view: { draft: { status: "open", revision: 2 } },
  });
});

it("a wrong manager PIN refuses the void", async () => {
  const host = await tendered();
  expect(
    await host.request({ ...voidRequest, approval: { approverId: manager, pin: "0000" } }),
  ).toMatchObject({ type: "error", code: "APPROVAL_INVALID" });
});

it("the manager's PIN voids it and the audit names the cashier and the manager", async () => {
  const host = await tendered();
  const voided = await host.request({
    ...voidRequest,
    approval: { approverId: manager, pin },
  });
  expect(voided).toMatchObject({
    kind: "draft",
    view: { draft: { status: "voided", voidReason: "Customer left" } },
  });
  const rows = await fixture!.database.read((tx) => tx.select().from(tillAudit));
  const entries = rows.filter((row) => row.command === "till.draft.void");
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    actorId: fixture!.config.session!.userId,
    approverId: manager,
  });
  expect(auditText(rows)).not.toContain(pin);
  expect(await verifyChain(rows as AuditEntry[])).toMatchObject({ valid: true });
});
