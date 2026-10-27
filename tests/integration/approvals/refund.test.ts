// Remote refund approval: a register asks, the branch's managers are texted, a manager answers in the back office,
// the workflow pushes the answer to the register's store, and the refund that uses the approval is accepted once
// with that manager as its approver. Anything that does not match the approval is refused.
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import * as schema from "@shopper/db-pg";
import { money } from "@shopper/money";
import { ids } from "../../fixtures/sales/golden";
import { approvalWorld } from "../../support/approvals/world";
import { postRefund, refundEvent } from "../../support/sales/refunds";
import { portalMember } from "../../support/api/portal";
import { sentMessages } from "../../support/stock/queue";
import { addBranch } from "../../support/stock/seed";

let setup: Awaited<ReturnType<typeof approvalWorld>>;
beforeAll(async () => {
  setup = await approvalWorld();
}, 300_000);
afterAll(async () => {
  await setup?.world.local.close();
});
const now = () => new Date();

test("a refund approved remotely is pushed to the register and accepted once, the manager as approver", async () => {
  const { sale, event } = await setup.refundable();
  const asked = await setup.ask({
    kind: "refund",
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    amount: event.refund.totals.gross,
    reason: "Customer returned goods",
  });
  expect(asked).toMatchObject({ status: 201, body: { status: "pending", kind: "refund" } });
  const id = asked.body.id as string;
  expect((await sentMessages()).filter((m) => m.type === "approval.requested")).toContainEqual(
    expect.objectContaining({ payload: { id } }),
  );
  const [run] = await setup.world.db
    .select()
    .from(schema.workflowRun)
    .where(eq(schema.workflowRun.instanceId, id));
  expect(run).toMatchObject({ type: "approval", status: "waiting" });

  const inbox = await setup.api.request("/approvals?status=pending", {
    headers: { cookie: setup.owner.cookie },
  });
  expect(((await inbox.json()) as any).approvals.map((a: any) => a.id)).toContain(id);
  expect(await setup.decide(setup.owner.cookie, id, { decision: "approved" })).toBe(200);
  await vi.waitFor(() =>
    expect(setup.pushed).toContainEqual(
      expect.objectContaining({
        type: "approval.decided",
        payload: expect.objectContaining({
          id,
          status: "approved",
          deviceId: setup.world.scope.deviceId,
        }),
      }),
    ),
  );
  await vi.waitFor(async () => {
    const [done] = await setup.world.db
      .select()
      .from(schema.workflowRun)
      .where(eq(schema.workflowRun.instanceId, id));
    expect(done!.status).toBe("completed");
  });

  const approved = {
    ...event,
    refund: { ...event.refund, approvalId: id, approverId: setup.owner.principal.userId },
  };
  const accepted = await postRefund(approved, setup.world.session.proof);
  expect(accepted.body.accepted).toBeDefined();
  const [row] = await setup.world.db
    .select()
    .from(schema.refund)
    .where(eq(schema.refund.id, event.refund.id));
  expect(row!.approverId).toBe(setup.owner.principal.userId);
  expect((await setup.approval(id)).consumedAt).not.toBeNull();
  // A lost reply is retried with the identical refund: that is not a second use.
  expect((await postRefund(approved, setup.world.session.proof)).body.accepted).toBeDefined();

  // The same approval cannot carry a second refund.
  const again = refundEvent(setup.world, sale, [{ line: 0, before: 0, after: 1_000 }], {
    approverId: setup.owner.principal.userId,
  });
  again.refund.deviceTime = now().toISOString();
  const reused = await postRefund(
    { ...again, refund: { ...again.refund, approvalId: id } },
    setup.world.session.proof,
  );
  expect(reused.body.rejected).toMatchObject({
    code: "APPROVAL",
    message: expect.stringContaining("already been used"),
  });
});

test("a refund is refused when its approval was declined, or is for another sale, amount or manager", async () => {
  const { sale, event } = await setup.refundable();
  const request = {
    kind: "refund",
    saleId: sale.id,
    amount: event.refund.totals.gross,
    reason: "Damaged",
  };
  const declined = (await setup.ask(request)).body.id as string;
  expect(
    await setup.decide(setup.owner.cookie, declined, {
      decision: "declined",
      reason: "Not damaged",
    }),
  ).toBe(200);
  const other = (await setup.ask({ ...request, amount: event.refund.totals.gross + 100 })).body
    .id as string;
  expect(await setup.decide(setup.owner.cookie, other, { decision: "approved" })).toBe(200);
  const right = (await setup.ask(request)).body.id as string;
  expect(await setup.decide(setup.owner.cookie, right, { decision: "approved" })).toBe(200);

  const send = (approvalId: string, approverId = setup.owner.principal.userId) =>
    postRefund(
      { ...event, refund: { ...event.refund, approvalId, approverId } },
      setup.world.session.proof,
    );
  expect((await send(declined)).body.rejected.message).toContain("declined");
  expect((await send(other)).body.rejected.message).toContain("does not match");
  expect((await send(right, setup.world.session.userId)).body.rejected.message).toContain(
    "different manager",
  );
  expect((await send(v7())).body.rejected.message).toContain("unknown");
  expect((await setup.approval(right)).consumedAt).toBeNull();
  // An answered request cannot be answered again.
  expect(await setup.decide(setup.owner.cookie, right, { decision: "declined" })).toBe(409);
});

test("only a manager with the permission, at the request's branch, and not the asker, may answer", async () => {
  const { sale, event } = await setup.refundable();
  const id = (
    await setup.ask({
      kind: "refund",
      saleId: sale.id,
      amount: event.refund.totals.gross,
      reason: "Wrong size",
    })
  ).body.id as string;
  const cashier = await portalMember(setup.owner, "cashier");
  expect(await setup.decide(cashier, id, { decision: "approved" })).toBe(403);

  const elsewhere = await portalMember(setup.owner, "admin");
  const userId = (await setup.owner.auth.resolvePrincipal(
    new Request("http://localhost", { headers: { cookie: elsewhere } }),
  ))!.userId;
  const [member] = await setup.world.db
    .select()
    .from(schema.member)
    .where(eq(schema.member.userId, userId));
  await setup.world.db
    .insert(schema.memberBranch)
    .values({ orgId: ids.org, memberId: member!.id, branchId: await addBranch(ids.store) });
  expect(await setup.decide(elsewhere, id, { decision: "approved" })).toBe(404);

  // A manager who asked from a register cannot approve their own request.
  const own = v7();
  await setup.world.db.insert(schema.approvalRequest).values({
    id: own,
    orgId: ids.org,
    branchId: setup.world.scope.branchId,
    deviceId: setup.world.scope.deviceId,
    requestedBy: setup.owner.principal.userId,
    kind: "refund",
    subject: { saleId: sale.id, amount: money(1_000), reason: "Mine" },
    expiresAt: new Date(Date.now() + 600_000),
  });
  expect(await setup.decide(setup.owner.cookie, own, { decision: "approved" })).toBe(409);
  expect((await setup.approval(id)).status).toBe("pending");
});
