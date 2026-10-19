// shift.declare / shift.close over the bridge. Within the threshold (GHS 5 by default) the declare closes the shift at
// once, prints the Z and triggers the upload; over it the shift stays counted until a manager's PIN (shift.approve)
// arrives with shift.close. The Z is saved even when the printer is down or missing.
import { afterEach, expect, test } from "vite-plus/test";
import * as v from "valibot";
import { tillAudit } from "@shopper/db-sqlite";
import { bridgeMessage } from "@shopper/sync/bridge";
import { manager, pin, startShifter, type Shifter } from "../../../../../support/till/host/shifts";

let shifter: Shifter | undefined;
afterEach(async () => {
  await shifter?.close();
  shifter = undefined;
});

const float = 2_000_000;
const threshold = 50_000;
const balanced = [
  { tender: "cash", expected: float, declared: float, variance: 0 },
  { tender: "card", expected: 0, declared: 0, variance: 0 },
  { tender: "momo", expected: 0, declared: 0, variance: 0 },
];

test("a count within the threshold closes the shift at once, prints the Z and queues the upload", async () => {
  shifter = await startShifter();
  const { register, printer } = shifter;
  const declared = await shifter.declare(float - 3_000);
  expect(declared).toMatchObject({
    type: "result",
    kind: "shiftDeclared",
    variances: [
      { tender: "cash", expected: float, declared: float - 3_000, variance: -3_000 },
      balanced[1],
      balanced[2],
    ],
    threshold,
    approvalRequired: false,
    closed: { printed: true, report: { kind: "z", approverId: null } },
  });
  expect(v.safeParse(bridgeMessage, declared).success).toBe(true);
  const [job, ...rest] = await printer.waitForJobs(1);
  expect(rest).toHaveLength(0);
  expect(job?.page).toContain("Z REPORT");
  expect(job?.page).toContain("Audit anchor");
  const { shift } = await register.status();
  expect(shift.current).toBeNull();
  expect(shift.last).toMatchObject({
    id: declared.closed.report.shiftId,
    upload: "pending",
    blockedReason: null,
  });
  expect(await register.audit("shift.close")).toHaveLength(1);
});

test("a count over the threshold waits: closed is null, nothing prints and the shift is counted", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  const declared = await shifter.declare(float - threshold - 100);
  expect(declared).toMatchObject({
    type: "result",
    kind: "shiftDeclared",
    threshold,
    approvalRequired: true,
    closed: null,
  });
  expect(v.safeParse(bridgeMessage, declared).success).toBe(true);
  expect(await shifter.jobs()).toHaveLength(0);
  expect((await register.status()).shift).toMatchObject({
    current: { status: "declared" },
    last: null,
  });
  expect(await register.audit("shift.close")).toHaveLength(0);
});

test("a counted shift refuses a second count, a drop and a sale with SHIFT_COUNTED", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  await shifter.declare(float - threshold - 100);
  expect(await shifter.declare(float)).toMatchObject({ type: "error", code: "SHIFT_COUNTED" });
  expect(
    await register.ask({ type: "shift.drop", amount: 100_000, reason: "Safe run" }),
  ).toMatchObject({ type: "error", code: "SHIFT_COUNTED" });
  await register.ask({
    type: "add",
    expectedRevision: 0,
    productId: register.fixture.config.references.products[0].id,
  });
  expect(
    await register.ask({ type: "tender.add", expectedRevision: 1, kind: "cash", amount: 20_000 }),
  ).toMatchObject({ type: "error", code: "SHIFT_COUNTED" });
});

test("closing a counted shift without a manager is APPROVAL_REQUIRED and it stays counted", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  await shifter.declare(float - threshold - 100);
  expect(await register.ask({ type: "shift.close" })).toMatchObject({
    type: "error",
    code: "APPROVAL_REQUIRED",
  });
  expect((await register.status()).shift.current).toMatchObject({ status: "declared" });
  expect(await shifter.jobs()).toHaveLength(0);
});

test("a wrong PIN, or a manager who cannot approve shifts, does not close it", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  await shifter.syncApprover(["sale.void"]);
  await shifter.declare(float - threshold - 100);
  expect(
    await register.ask({ type: "shift.close", approval: { approverId: manager, pin } }),
  ).toMatchObject({ type: "error", code: "APPROVAL_FORBIDDEN" });
  await shifter.syncApprover();
  expect(
    await register.ask({ type: "shift.close", approval: { approverId: manager, pin: "0000" } }),
  ).toMatchObject({ type: "error", code: "APPROVAL_INVALID" });
  expect((await register.status()).shift.current).toMatchObject({ status: "declared" });
  expect(await register.audit("shift.close")).toHaveLength(0);
  expect(await shifter.jobs()).toHaveLength(0);
});

test("the manager's PIN closes a counted shift: the Z names the approver, prints and the audit names both", async () => {
  shifter = await startShifter();
  const { register, printer } = shifter;
  await shifter.syncApprover();
  await shifter.declare(float - threshold - 100);
  const closed = await register.ask({
    type: "shift.close",
    approval: { approverId: manager, pin },
  });
  expect(closed).toMatchObject({
    type: "result",
    kind: "shiftClosed",
    printed: true,
    report: { kind: "z", approverId: manager },
  });
  expect(v.safeParse(bridgeMessage, closed).success).toBe(true);
  const [job] = await printer.waitForJobs(1);
  expect(job?.page).toContain("Z REPORT");
  expect(job?.page).toContain("Audit anchor");
  expect((await register.status()).shift).toMatchObject({
    current: null,
    last: { id: closed.report.shiftId, upload: "pending" },
  });
  const rows = await register.fixture.database.read((tx) => tx.select().from(tillAudit));
  expect(rows.filter((row) => row.command === "shift.close")).toMatchObject([
    { actorId: register.fixture.config.session!.userId, approverId: manager },
  ]);
  expect(JSON.stringify(rows)).not.toContain(pin);
});

test("a close after a declare that already closed the shift is SHIFT_REQUIRED", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  expect(await shifter.declare(float)).toMatchObject({ closed: { report: { kind: "z" } } });
  expect(await register.ask({ type: "shift.close" })).toMatchObject({
    type: "error",
    code: "SHIFT_REQUIRED",
  });
  expect(await register.audit("shift.close")).toHaveLength(1);
});

test("after the close the register refuses sales until a new shift opens", async () => {
  shifter = await startShifter();
  const { register } = shifter;
  await shifter.declare(float);
  await register.ask({
    type: "add",
    expectedRevision: 0,
    productId: register.fixture.config.references.products[0].id,
  });
  expect(
    await register.ask({ type: "tender.add", expectedRevision: 1, kind: "cash", amount: 20_000 }),
  ).toMatchObject({ type: "error", code: "SHIFT_REQUIRED" });
  expect(await register.ask({ type: "shift.open", float })).toMatchObject({
    status: { shift: { current: { status: "open" }, last: { upload: "pending" } } },
  });
});

test("a declare or a close on a register with no shift is SHIFT_REQUIRED", async () => {
  shifter = await startShifter({ shift: false });
  expect(await shifter.declare(float)).toMatchObject({ type: "error", code: "SHIFT_REQUIRED" });
  expect(await shifter.register.ask({ type: "shift.close" })).toMatchObject({
    type: "error",
    code: "SHIFT_REQUIRED",
  });
});
