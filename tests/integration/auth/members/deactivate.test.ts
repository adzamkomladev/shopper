import { expect, test } from "vite-plus/test";
import { and, eq, gt } from "drizzle-orm";
import { auditLog, cashierSession, session } from "@shopper/db-pg";
import { api, auth, baseURL, context, cookies, db, password, request, signIn } from "../setup";
import { branches, principalOf, register, userOf } from "./support";

const signInStatus = async (email: string) =>
  (
    await auth.handler(
      new Request(`${baseURL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Shopper-Client-IP": "198.51.100.200" },
        body: JSON.stringify({ email, password }),
      }),
    )
  ).status;

test("a deactivated member is refused everywhere at once and can be reactivated", async () => {
  const owner = cookies.get("superadmin")!;
  const [branchId] = await branches("Deactivation branch");
  const till = await register(branchId!);
  const live = await till.pinLogin("inventory");
  const inventory = await userOf("inventory");
  const before = await principalOf("inventory");
  expect(await auth.hasPermission(before, "stock.write")).toBe(true);

  const deactivated = await request(api, owner, `/users/${inventory.id}/deactivate`, "POST");
  expect(deactivated.status).toBe(200);
  expect((await userOf("inventory")).deactivatedAt).not.toBeNull();

  // The portal: the open session is gone, a new sign-in is refused and leaves no session behind.
  expect((await request(api, cookies.get("inventory")!, "/session/permissions")).status).toBe(401);
  expect(await signInStatus("inventory@example.com")).toBe(403);
  expect(await db.select().from(session).where(eq(session.userId, inventory.id))).toEqual([]);
  expect(await auth.hasPermission(before, "stock.write")).toBe(false);

  // The till: both sign-in methods are refused, and the live session ends now, not retroactively.
  // Checked first: assigning a PIN below revokes the member's sessions on its own.
  const [cut] = await db.select().from(cashierSession).where(eq(cashierSession.id, live.id));
  expect(cut!.revokedAt).toBeNull();
  expect(cut!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  expect(cut!.expiresAt.getTime()).toBeGreaterThan(new Date(live.issuedAt).getTime());
  await expect(till.passwordLogin("inventory")).rejects.toMatchObject({ status: 403 });
  await expect(till.pinLogin("inventory")).rejects.toMatchObject({ status: 403 });

  const reactivated = await request(api, owner, `/users/${inventory.id}/reactivate`, "POST");
  expect(reactivated.status).toBe(200);
  expect((await userOf("inventory")).deactivatedAt).toBeNull();
  expect(await signInStatus("inventory@example.com")).toBe(200);
  await expect(till.passwordLogin("inventory")).resolves.toMatchObject({ roleName: "inventory" });
  // The cut session stays ended.
  expect(
    await db
      .select()
      .from(cashierSession)
      .where(and(eq(cashierSession.id, live.id), gt(cashierSession.expiresAt, new Date()))),
  ).toEqual([]);

  const events = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, context.orgId), eq(auditLog.entityId, inventory.id)));
  const ownerId = (await principalOf("superadmin")).userId;
  expect(
    events
      .filter((row) => row.command.startsWith("auth.member."))
      .map((row) => [row.command, row.actorId]),
  ).toEqual([
    ["auth.member.deactivate", ownerId],
    ["auth.member.reactivate", ownerId],
  ]);
});

test("nobody deactivates themselves, the last owner, or someone above their own permissions", async () => {
  const owner = cookies.get("superadmin")!;
  const admin = cookies.get("admin")!;
  const ownerUser = (await principalOf("superadmin")).userId;
  const self = await request(api, owner, `/users/${ownerUser}/deactivate`, "POST");
  expect(self.status).toBe(409);
  expect((await self.json()).error).toBe("You can't deactivate yourself");
  const adminUser = (await principalOf("admin")).userId;
  expect((await request(api, admin, `/users/${adminUser}/deactivate`, "POST")).status).toBe(409);
  // An admin lacks store.write, which the owner role holds: the owner is above them.
  const above = await request(api, admin, `/users/${ownerUser}/deactivate`, "POST");
  expect(above.status).toBe(403);
  // A cashier holds no user.write at all.
  const cashier = cookies.get("cashier")!;
  expect(
    (await request(api, cashier, `/users/${(await userOf("accountant")).id}/deactivate`, "POST"))
      .status,
  ).toBe(403);
  expect((await userOf("accountant")).deactivatedAt).toBeNull();
  // The admin may deactivate the accountant, whose permissions they hold.
  const accountant = (await userOf("accountant")).id;
  expect((await request(api, admin, `/users/${accountant}/deactivate`, "POST")).status).toBe(200);
  expect((await request(api, admin, `/users/${accountant}/reactivate`, "POST")).status).toBe(200);
});

test("the last active owner can't be deactivated, even by another owner who is themselves deactivated", async () => {
  const owner = cookies.get("superadmin")!;
  const ownerUser = (await principalOf("superadmin")).userId;
  const ownerRole = (await principalOf("superadmin")).roleId;
  // A second owner deactivates the first: allowed while another active owner remains.
  const admin = await userOf("admin");
  expect(
    (await request(api, owner, `/users/${admin.id}/role`, "PATCH", { roleId: ownerRole })).status,
  ).toBe(200);
  const secondOwner = await signIn(auth, "admin@example.com");
  expect((await request(api, secondOwner, `/users/${ownerUser}/deactivate`, "POST")).status).toBe(
    200,
  );
  // Now the admin is the only active owner: they can't be deactivated by anyone.
  const last = await request(api, secondOwner, `/users/${admin.id}/deactivate`, "POST");
  expect(last.status).toBe(409);
  expect((await request(api, secondOwner, `/users/${ownerUser}/reactivate`, "POST")).status).toBe(
    200,
  );
  // Deactivation ended the first owner's sessions; signing in again works once reactivated.
  cookies.set("superadmin", await signIn(auth, "same-owner@example.com"));
  expect((await request(api, cookies.get("superadmin")!, "/users")).status).toBe(200);
});
