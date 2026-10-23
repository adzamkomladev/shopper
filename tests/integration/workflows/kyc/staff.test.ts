// Staff KYC: a member case (purpose "role") asks for a role; approval grants it through grantMemberRole.
import { expect, test } from "vite-plus/test";
import {
  as,
  caseRow,
  expectChainValid,
  otpFor,
  phone,
  roleIds,
  roleOf,
  userIdOf,
  waitForRun,
} from "../../../support/kyc/world";

/** Open a role case for the member holding `who`'s role, verified and with the ID skipped: waiting in `review`. */
async function roleCase(who: string, requested: string, opener = "admin") {
  const number = phone();
  const opened = await as(opener).open({
    subject: { userId: await userIdOf(who) },
    purpose: "role",
    requestedRoleId: roleIds.get(requested),
    phone: number,
  });
  return { opened, id: opened.body.id as string, number, userId: await userIdOf(who) };
}
async function inReview(who: string, requested: string) {
  const made = await roleCase(who, requested);
  expect(made.opened.status).toBe(201);
  expect((await as("admin").verify(made.id, await otpFor(made.number))).status).toBe(200);
  expect((await as("admin").skipId(made.id)).status).toBe(200);
  return made;
}

test("opening a member case needs role.write", async () => {
  for (const who of ["accountant", "cashier"]) {
    expect((await roleCase("admin", "cashier", who)).opened.status, who).toBe(403);
  }
  const opened = (await roleCase("admin", "cashier")).opened;
  expect(opened.status).toBe(201);
  expect(opened.body).toMatchObject({
    purpose: "role",
    status: "otp_sent",
    requestedRoleId: roleIds.get("cashier"),
  });
  // One open case per member, and the role must exist.
  expect((await roleCase("admin", "cashier")).opened.status).toBe(409);
  expect(
    (
      await as("admin").open({
        subject: { userId: await userIdOf("accountant") },
        purpose: "role",
        requestedRoleId: "00000000-0000-7000-8000-000000000000",
        phone: phone(),
      })
    ).status,
  ).toBeGreaterThanOrEqual(400);
});

test("approval grants the requested role and completes the workflow", async () => {
  const made = await inReview("cashier", "inventory");
  expect(await roleOf(made.userId)).toBe(roleIds.get("cashier"));
  const approved = await as("admin").decide(made.id, {
    approve: true,
    roleId: roleIds.get("inventory"),
    note: "Moves to stock",
  });
  expect(approved.status).toBe(200);
  expect(approved.body).toMatchObject({
    status: "approved",
    approvedRoleId: roleIds.get("inventory"),
  });
  expect(await roleOf(made.userId)).toBe(roleIds.get("inventory"));
  expect(await caseRow(made.id)).toMatchObject({ status: "approved", memberId: made.userId });
  await waitForRun(made.id, "completed");
  await expectChainValid();
});

test("rejection leaves the member's role alone", async () => {
  const made = await inReview("inventory", "cashier");
  const before = await roleOf(made.userId);
  const rejected = await as("admin").decide(made.id, { approve: false, note: "Not yet" });
  expect(rejected.status).toBe(200);
  expect(rejected.body.status).toBe("rejected");
  expect(await roleOf(made.userId)).toBe(before);
  expect((await caseRow(made.id)).approvedRoleId).toBeNull();
  await waitForRun(made.id, "completed");
});

test("deciding without kyc.approve is 403, and an approver cannot grant a role above their own", async () => {
  const made = await roleCase("accountant", "superadmin", "superadmin");
  expect(made.opened.status).toBe(201);
  expect((await as("admin").verify(made.id, await otpFor(made.number))).status).toBe(200);
  expect((await as("admin").skipId(made.id)).status).toBe(200);
  const approval = { approve: true, roleId: roleIds.get("superadmin"), note: "Promote" };
  for (const who of ["cashier", "accountant"])
    expect((await as(who).decide(made.id, approval)).status, who).toBe(403);
  // An admin holds kyc.approve but not every permission of the owner role.
  const escalation = await as("admin").decide(made.id, approval);
  expect(escalation.status).toBe(403);
  expect(escalation.body.error).toMatch(/grant permissions you do not hold/);
  expect(await roleOf(made.userId)).toBe(roleIds.get("accountant"));
  expect((await caseRow(made.id)).status).toBe("review");
  expect((await as("superadmin").decide(made.id, { approve: false, note: "No" })).status).toBe(200);
});

test("the last-owner rule still holds: approving the sole owner's demotion is refused", async () => {
  const made = await inReview("superadmin", "cashier");
  const refused = await as("admin").decide(made.id, {
    approve: true,
    roleId: roleIds.get("cashier"),
    note: "Step down",
  });
  expect(refused.status).toBe(409);
  expect(refused.body.error).toMatch(/last owner cannot be demoted/i);
  expect(await roleOf(made.userId)).toBe(roleIds.get("superadmin"));
  expect((await caseRow(made.id)).status).toBe("review");
  expect((await as("superadmin").decide(made.id, { approve: false, note: "Stay" })).status).toBe(
    200,
  );
});
