// Remote approval over time and for discounts: an unanswered request expires and is pushed as expired, and an
// approved discount lets one sale through with the manager as its approver.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import * as schema from "@shopper/db-pg";
import { tradingDay } from "../../fixtures/sales/golden/day";
import { approvalWorld } from "../../support/approvals/world";
import { ringGolden } from "../../support/sales/golden/run";
import { api as till } from "../../support/till/server";
import { pushEvents } from "../../support/till/requests";

let setup: Awaited<ReturnType<typeof approvalWorld>>;
beforeAll(async () => {
  setup = await approvalWorld();
}, 300_000);
afterAll(async () => {
  await setup?.world.local.close();
});
const now = () => new Date();

test("an unanswered request expires and is pushed as expired; answering it late is refused", async () => {
  const asked = await setup.ask(
    { kind: "discount", amount: 12_000, reason: "Loyal customer" },
    setup.apiWith(200),
  );
  const id = asked.body.id as string;
  await vi.waitFor(async () => expect((await setup.approval(id)).status).toBe("expired"), {
    timeout: 5000,
  });
  await vi.waitFor(() =>
    expect(setup.pushed).toContainEqual(
      expect.objectContaining({
        type: "approval.decided",
        payload: expect.objectContaining({ id, status: "expired" }),
      }),
    ),
  );
  expect(await setup.decide(setup.owner.cookie, id, { decision: "approved" })).toBe(409);
});

test("a discount approved remotely lets the sale through once, the manager as its approver", async () => {
  const scenario = tradingDay.find((s) => s.name === "line discount")!;
  const id = (await setup.ask({ kind: "discount", amount: 12_000, reason: "Dented tin" })).body
    .id as string;
  expect(await setup.decide(setup.owner.cookie, id, { decision: "approved" })).toBe(200);
  const event = (await ringGolden(setup.world, scenario, now()))!;
  const response = await pushEvents(
    till,
    [{ ...event, sale: { ...event.sale, discountApprovalId: id } }],
    [{ sessionId: setup.world.session.id, proof: setup.world.session.proof }],
  );
  expect(await response.json()).toMatchObject({ rejected: [] });
  expect((await setup.approval(id)).consumedAt).not.toBeNull();
  const [audit] = await setup.world.db
    .select()
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.command, "sale.accept"),
        eq(schema.auditLog.entityId, event.sale.localId),
      ),
    );
  expect(audit!.approverId).toBe(setup.owner.principal.userId);

  const second = (await ringGolden(setup.world, scenario, now()))!;
  const reused = await pushEvents(
    till,
    [{ ...second, sale: { ...second.sale, discountApprovalId: id } }],
    [{ sessionId: setup.world.session.id, proof: setup.world.session.proof }],
  );
  expect(await reused.json()).toMatchObject({ rejected: [{ code: "APPROVAL" }] });
});
