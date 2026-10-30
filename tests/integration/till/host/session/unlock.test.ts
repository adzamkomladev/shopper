// Day 26 S2: a manager's PIN at the register lifts a cashier's sign-in lockout, offline and online.
import { afterEach, expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { hashPin } from "@shopper/auth/devices";
import { refreshApprovers } from "@shopper/core/till";
import { ama, startStaffHost, type StaffHost } from "../../../../support/till/host/staff";
import { auditRows, auditText } from "../../../../support/till/approvers";

let ctx: StaffHost | undefined;
afterEach(async () => ctx?.close());

const manager = v7();
const supervisor = v7();

/** A register that knows a manager who may unlock (PIN 2468) and a supervisor who may only void. */
async function lockedHost(offline: boolean) {
  const c = (ctx = await startStaffHost([ama]));
  const { identity } = c.fixture.config;
  await refreshApprovers(
    c.fixture.database,
    { orgId: identity.orgId, deviceId: identity.deviceId, appVersion: "0.0.0-test" },
    {
      approvers: [
        {
          userId: manager,
          name: "Esi Manager",
          pinHash: await hashPin("2468"),
          permissions: ["staff.unlock"],
        },
        {
          userId: supervisor,
          name: "Yaw Supervisor",
          pinHash: await hashPin("1357"),
          permissions: ["sale.void"],
        },
      ],
      at: new Date(),
    },
  );
  await c.signIn(ama.email, ama.password);
  await c.signOut();
  if (offline) {
    c.upstream.state.mode = "down";
    for (let attempt = 0; attempt < 5; attempt++) await c.signIn(ama.email, "wrong password");
  } else c.upstream.state.mode = "locked";
  return c;
}
const unlock = (c: StaffHost, approverId: string, pin: string) =>
  c.host.request({ type: "session.unlock", email: ama.email, approverId, pin });

test("offline: only an approver holding staff.unlock with the right PIN lifts the register's lock", async () => {
  const c = await lockedHost(true);
  const locked = await c.signIn(ama.email, ama.password);
  expect(locked).toMatchObject({ type: "error", code: "SIGN_IN_LOCKED" });
  expect((locked as { message: string }).message).toMatch(
    /^Too many attempts\. Try again at \d\d:\d\d\.$/,
  );

  expect(
    await c.host.request({ type: "approvers.list", permission: "staff.unlock" }),
  ).toMatchObject({
    kind: "approvers",
    approvers: [{ userId: manager, name: "Esi Manager" }],
  });
  expect(await unlock(c, supervisor, "1357")).toMatchObject({ code: "APPROVAL_FORBIDDEN" });
  expect(await unlock(c, manager, "0000")).toMatchObject({ code: "APPROVAL_INVALID" });
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({ code: "SIGN_IN_LOCKED" });

  expect(await unlock(c, manager, "2468")).toMatchObject({ kind: "status" });
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({
    kind: "status",
    status: { user: { userId: ama.userId, offline: true } },
  });
  const audits = (await auditRows(c.fixture.database)).filter(
    (row) => row.command === "session.unlock",
  );
  expect(audits).toHaveLength(1);
  expect(audits[0]).toMatchObject({
    actorId: manager,
    payload: { userId: ama.userId, online: false },
  });
  expect(auditText(audits)).not.toContain("2468");
});

test("online: the server checks the manager's PIN and lifts its own lock, then sign-in goes through", async () => {
  const c = await lockedHost(false);
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({ code: "SIGN_IN_LOCKED" });
  c.upstream.state.unlockPin = "9999";
  expect(await unlock(c, manager, "2468")).toMatchObject({ code: "APPROVAL_INVALID" });
  expect(c.upstream.state.unlocks).toEqual([]);
  c.upstream.state.unlockPin = "2468";
  expect(await unlock(c, manager, "2468")).toMatchObject({ kind: "status" });
  expect(c.upstream.state.unlocks).toEqual([{ email: ama.email, approverId: manager }]);
  expect(await c.signIn(ama.email, ama.password)).toMatchObject({
    status: { user: { userId: ama.userId, offline: false } },
  });
});
