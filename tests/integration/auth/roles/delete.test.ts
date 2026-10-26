import { expect, test } from "vite-plus/test";
import { v7 } from "uuid";
import { and, eq } from "drizzle-orm";
import { auditLog, invitation, role } from "@shopper/db-pg";
import { createInvitations } from "@shopper/auth";
import { api, auth, baseURL, context, cookies, db, request, roleIds } from "../setup";

async function createRole(cookie: string, name: string, permissionCodes: string[]) {
  const response = await request(api, cookie, "/roles", "POST", { name, permissionCodes });
  expect(response.status).toBe(201);
  return (await response.json()) as { id: string };
}

async function invite(roleId: string, now = Date.now()) {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  const invitations = createInvitations({
    database: db,
    linkSecret: "integration link secret that is long enough to sign",
    baseURL,
    launcher: { start: async () => {} } as never,
    now: () => now,
  });
  const issued = await invitations.issue(owner!, {
    email: `${v7()}@example.com`,
    roleId,
    channel: "email",
  });
  return issued.id as string;
}

/** Whether the role is still offered: listed by the API (archived roles are kept for history but hidden). */
const listed = async (id: string) =>
  (
    (await (await request(api, cookies.get("superadmin")!, "/roles")).json()) as { id: string }[]
  ).some((row) => row.id === id);

test("an unused custom role is deleted with an audit row holding what it was", async () => {
  const owner = cookies.get("superadmin")!;
  const created = await createRole(owner, "Night shift", ["product.read", "stock.read"]);
  const roles = await (await request(api, owner, "/roles")).json();
  expect(roles.find((row: { id: string }) => row.id === created.id)).toMatchObject({
    memberCount: 0,
  });

  const deleted = await request(api, owner, `/roles/${created.id}`, "DELETE");
  expect(deleted.status).toBe(204);
  expect(await listed(created.id)).toBe(false);
  // The row stays for the sessions, KYC cases and invitations that name it, but it can't be granted.
  const [kept] = await db
    .select()
    .from(role)
    .where(and(eq(role.orgId, context.orgId), eq(role.id, created.id)));
  expect(kept?.archivedAt).toBeInstanceOf(Date);
  const users = await (await request(api, owner, "/users")).json();
  const inventory = users.find((row: { roleName: string }) => row.roleName === "inventory");
  expect(
    (await request(api, owner, `/users/${inventory.id}/role`, "PATCH", { roleId: created.id }))
      .status,
  ).toBe(404);
  expect(
    (await request(api, owner, `/roles/${created.id}`, "PATCH", { name: "Revived" })).status,
  ).toBe(404);
  expect((await request(api, owner, `/roles/${created.id}`, "DELETE")).status).toBe(404);
  // Its name is free again.
  await createRole(owner, "Night shift", ["product.read"]);
  const [event] = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.orgId, context.orgId),
        eq(auditLog.command, "auth.role.delete"),
        eq(auditLog.entityId, created.id),
      ),
    );
  expect(event?.before).toMatchObject({
    name: "Night shift",
    permissionCodes: ["product.read", "stock.read"],
  });
  expect(event?.after).toBeNull();
});

test("a role still held by a member or a pending invitation is not deleted", async () => {
  const owner = cookies.get("superadmin")!;
  const cashier = roleIds.get("cashier")!;
  const inUse = await request(api, owner, `/roles/${cashier}`, "DELETE");
  expect(inUse.status).toBe(409);
  expect((await inUse.json()).error).toBe("Used by 1 member");
  expect(await listed(cashier)).toBe(true);

  const invited = await createRole(owner, "Invited only", ["product.read"]);
  await invite(invited.id);
  const pending = await request(api, owner, `/roles/${invited.id}`, "DELETE");
  expect(pending.status).toBe(409);
  expect((await pending.json()).error).toBe("Used by 1 pending invitation");

  // A lapsed invitation no longer holds the role; it keeps naming it as history.
  const lapsed = await createRole(owner, "Lapsed invite", ["product.read"]);
  const lapsedId = await invite(lapsed.id, Date.now() - 8 * 86_400_000);
  expect((await request(api, owner, `/roles/${lapsed.id}`, "DELETE")).status).toBe(204);
  const [kept] = await db
    .select()
    .from(invitation)
    .where(and(eq(invitation.orgId, context.orgId), eq(invitation.id, lapsedId)));
  expect(kept).toMatchObject({ roleId: lapsed.id, status: "pending" });
});

test("the owner role and roles above the actor's own permissions cannot be deleted", async () => {
  const owner = cookies.get("superadmin")!;
  const admin = cookies.get("admin")!;
  expect((await request(api, owner, `/roles/${roleIds.get("superadmin")}`, "DELETE")).status).toBe(
    403,
  );
  const above = await createRole(owner, "Store keeper", ["store.write"]);
  const refused = await request(api, admin, `/roles/${above.id}`, "DELETE");
  expect(refused.status).toBe(403);
  expect(await listed(above.id)).toBe(true);
  expect((await request(api, cookies.get("cashier")!, `/roles/${above.id}`, "DELETE")).status).toBe(
    403,
  );
  expect((await request(api, owner, `/roles/${v7()}`, "DELETE")).status).toBe(404);
});
