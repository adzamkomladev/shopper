import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { auditLog } from "@shopper/db-pg";
import { verifyChain } from "@shopper/audit";
import { api, otherApi, cookies, request, db, context, otherContext, roleIds } from "../setup";

test("administration reads require data permissions and remain tenant scoped", async () => {
  for (const path of ["/users", "/roles", "/permissions"]) {
    expect((await request(api, "", path)).status).toBe(401);
    expect((await request(api, cookies.get("cashier")!, path)).status).toBe(403);
    const own = await request(api, cookies.get("admin")!, path);
    expect(own.status).toBe(200);
    const rows = await own.json();
    expect(rows.length).toBeGreaterThan(0);
    const other = await request(otherApi, cookies.get("other")!, path);
    expect(other.status).toBe(200);
    const otherIds = new Set((await other.json()).map((row: { id: string }) => row.id));
    expect(rows.every((row: { id: string }) => !otherIds.has(row.id))).toBe(true);
  }
});

test("role API edits persist without exposing secrets and existing sessions see changes", async () => {
  const cookie = cookies.get("superadmin")!;
  const created = await request(api, cookie, "/roles", "POST", {
    name: "api-reader",
    permissionCodes: ["product.read"],
  });
  expect(created.status).toBe(201);
  const role = await created.json();
  expect(role).toMatchObject({
    name: "api-reader",
    protectedOwner: false,
    permissionCodes: ["product.read"],
  });
  const users = await (await request(api, cookie, "/users")).json();
  const inventory = users.find(
    (row: { roleId: string }) => row.roleId === roleIds.get("inventory"),
  );
  expect(
    (await request(api, cookie, `/users/${inventory.id}/role`, "PATCH", { roleId: role.id }))
      .status,
  ).toBe(200);
  expect(
    await (await request(api, cookies.get("inventory")!, "/session/permissions")).json(),
  ).toEqual(["product.read"]);
  expect(
    (await request(api, cookie, `/roles/${role.id}`, "PATCH", { permissionCodes: ["tax.read"] }))
      .status,
  ).toBe(200);
  expect(
    await (await request(api, cookies.get("inventory")!, "/session/permissions")).json(),
  ).toEqual(["tax.read"]);
  const events = await db
    .select()
    .from(auditLog)
    .where(and(eq(auditLog.orgId, context.orgId), eq(auditLog.command, "auth.role.update")));
  expect(events.at(-1)?.before).toMatchObject({ permissionCodes: ["product.read"] });
  expect(events.at(-1)?.after).toMatchObject({ permissionCodes: ["tax.read"] });
  expect(
    await verifyChain(
      await db
        .select()
        .from(auditLog)
        .where(eq(auditLog.orgId, context.orgId))
        .orderBy(auditLog.chainSeq),
    ),
  ).toMatchObject({ valid: true });
});

test("role API rejects invalid inputs, immutable owners and cross-tenant edits", async () => {
  const cookie = cookies.get("superadmin")!;
  expect(
    (await request(api, cookie, "/roles", "POST", { name: "bad", permissionCodes: ["unknown"] }))
      .status,
  ).toBe(400);
  expect(
    (
      await request(api, cookie, `/roles/${roleIds.get("superadmin")}`, "PATCH", {
        name: "owner-renamed",
      })
    ).status,
  ).toBe(403);
  const otherRoles = await (await request(otherApi, cookies.get("other")!, "/roles")).json();
  expect(
    (await request(api, cookie, `/roles/${otherRoles[0].id}`, "PATCH", { name: "cross-tenant" }))
      .status,
  ).toBe(404);
  expect((await request(api, cookie, `/roles/${otherRoles[0].id}`, "DELETE")).status).toBe(404);
  expect(context.orgId).not.toBe(otherContext.orgId);
});
