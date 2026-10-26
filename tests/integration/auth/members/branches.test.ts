import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { v7 } from "uuid";
import { auditLog, cashierSession } from "@shopper/db-pg";
import { api, context, cookies, db, request, signIn, auth } from "../setup";
import { branches, principalOf, register, userOf } from "./support";

const scope = (who: string, branchIds: string[], as = "superadmin") =>
  userOf(who).then(({ id }) =>
    request(api, cookies.get(as)!, `/users/${id}/branches`, "PUT", { branchIds }),
  );

test("a member scoped to a branch signs in only on that branch's registers, until the scope is lifted", async () => {
  const [a, b] = await branches("Scoped A", "Scoped B");
  const [atA, atB] = [await register(a!), await register(b!)];
  const liveAtB = await atB.passwordLogin("inventory");
  const scoped = await scope("inventory", [a!]);
  expect(scoped.status).toBe(200);
  // The session already open at B ends now (cut, not revoked, so its earlier sales still upload).
  const [cut] = await db.select().from(cashierSession).where(eq(cashierSession.id, liveAtB.id));
  expect(cut!.revokedAt).toBeNull();
  expect(cut!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now());
  expect((await userOf("inventory")).branchIds).toEqual([a]);
  expect((await principalOf("inventory")).branchIds).toEqual([a]);

  await expect(atA.passwordLogin("inventory")).resolves.toMatchObject({ roleName: "inventory" });
  await expect(atB.passwordLogin("inventory")).rejects.toMatchObject({
    status: 403,
    message: "Not allowed at this branch",
  });
  await expect(atB.pinLogin("inventory")).rejects.toMatchObject({ status: 403 });

  expect((await scope("inventory", [])).status).toBe(200);
  expect((await userOf("inventory")).branchIds).toEqual([]);
  expect((await principalOf("inventory")).branchIds).toBeNull();
  await expect(atB.passwordLogin("inventory")).resolves.toMatchObject({ roleName: "inventory" });

  const { id } = await userOf("inventory");
  const changes = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, context.orgId),
        eq(auditLog.command, "auth.member.branches.set"),
        eq(auditLog.entityId, id),
      ),
    );
  expect(changes.map((row) => [row.before, row.after])).toEqual([
    [{ branchIds: [] }, { branchIds: [a] }],
    [{ branchIds: [a] }, { branchIds: [] }],
  ]);
});

test("the owner stays org-wide, unknown branches are refused, and a cashier can't scope anyone", async () => {
  const [a] = await branches("Owner check");
  expect((await scope("same-owner", [a!])).status).toBe(409);
  expect((await scope("accountant", [v7()])).status).toBe(404);
  expect((await scope("accountant", [a!], "cashier")).status).toBe(403);
  expect((await userOf("accountant")).branchIds).toEqual([]);
});

test("a scoped admin grants only within their own branches and never manages a wider member", async () => {
  const [a, b] = await branches("Ceiling A", "Ceiling B");
  expect((await scope("admin", [a!])).status).toBe(200);
  const admin = await signIn(auth, "admin@example.com");
  cookies.set("admin", admin);
  // The accountant is org-wide, wider than the admin: hands off, their role included.
  expect((await scope("accountant", [a!], "admin")).status).toBe(403);
  const accountant = await userOf("accountant");
  const roleChange = await request(api, admin, `/users/${accountant.id}/role`, "PATCH", {
    roleId: accountant.roleId,
  });
  expect(roleChange.status).toBe(403);
  expect((await scope("accountant", [a!])).status).toBe(200);
  expect((await scope("accountant", [b!], "admin")).status).toBe(403);
  expect((await scope("accountant", [], "admin")).status).toBe(403);
  expect((await scope("accountant", [a!], "admin")).status).toBe(200);
  // Deactivating someone outside the admin's branches is managing them too.
  expect((await scope("inventory", [b!])).status).toBe(200);
  const inventory = (await userOf("inventory")).id;
  expect((await request(api, admin, `/users/${inventory}/deactivate`, "POST")).status).toBe(403);
  expect((await userOf("accountant")).branchIds).toEqual([a]);
  // Reset for the other suites in this file's database.
  for (const who of ["admin", "accountant", "inventory"]) await scope(who, []);
});
