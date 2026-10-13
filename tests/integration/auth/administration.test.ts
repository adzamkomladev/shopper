import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shopper/db-pg";
import { expect, test } from "vite-plus/test";
import { and, eq } from "drizzle-orm";
import { assignMemberRole, seedAuthRoles } from "@shopper/auth";
import { defineCommand } from "@shopper/audit";
import { permission, rolePermission } from "@shopper/db-pg";
import { auth, baseURL, cookies, db, context, commandContext, roleIds, fixture } from "./setup";

const removeOrdinaryGrant = defineCommand({
  name: "auth.test.remove-grant",
  async run(tx, ctx, input: { roleId: string; code: string }) {
    const [grant] = await tx
      .select({ id: permission.id })
      .from(permission)
      .where(and(eq(permission.orgId, ctx.orgId), eq(permission.code, input.code)));
    await tx
      .delete(rolePermission)
      .where(
        and(
          eq(rolePermission.orgId, ctx.orgId),
          eq(rolePermission.roleId, input.roleId),
          eq(rolePermission.permissionId, grant!.id),
        ),
      );
    return input;
  },
  audit: (_input, output) => output,
});

test("reseed preserves an ordinary role's removed grants", async () => {
  await removeOrdinaryGrant(db, context, {
    roleId: roleIds.get("inventory")!,
    code: "product.read",
  });
  await removeOrdinaryGrant(db, context, { roleId: roleIds.get("admin")!, code: "user.read" });
  await seedAuthRoles(db, context, undefined);
  const inventory = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("inventory")! } }),
  );
  expect(await auth.hasPermission(inventory!, "product.read")).toBe(false);
  const admin = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("admin")! } }),
  );
  expect(await auth.hasPermission(admin!, "user.read")).toBe(false);
});

test("the sole protected owner cannot demote themselves", async () => {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  await expect(
    assignMemberRole(db, commandContext(context.orgId, owner!), {
      userId: owner!.userId,
      roleId: roleIds.get("cashier")!,
    }),
  ).rejects.toThrow("The last owner cannot be demoted");
});

test("protected owner role name and matrix are immutable", async () => {
  const { updateRole } = await import("@shopper/auth");
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  for (const data of [{ name: "renamed" }, { permissionCodes: [] }]) {
    await expect(
      updateRole(db, commandContext(context.orgId, owner!), {
        id: roleIds.get("superadmin")!,
        data,
      }),
    ).rejects.toThrow("The owner role cannot be edited");
  }
});

test("role edits enforce current and requested grant ceilings and a fixed catalog", async () => {
  const { createRole, updateRole } = await import("@shopper/auth");
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  const admin = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("admin")! } }),
  );
  const high = await createRole(db, commandContext(context.orgId, owner!), {
    name: "tax-officer",
    permissionCodes: ["tax.write"],
  });
  await expect(
    updateRole(db, commandContext(context.orgId, admin!), {
      id: high.after.id,
      data: { permissionCodes: [] },
    }),
  ).rejects.toThrow("Cannot grant permissions you do not hold");
  await expect(
    createRole(db, commandContext(context.orgId, admin!), {
      name: "escalation",
      permissionCodes: ["tax.write"],
    }),
  ).rejects.toThrow("Cannot grant permissions you do not hold");
  await expect(
    createRole(db, commandContext(context.orgId, owner!), {
      name: "unknown",
      permissionCodes: ["arbitrary.right"],
    }),
  ).rejects.toThrow();
});

test("only protected owners grant owner even when another role has the full catalog", async () => {
  const { createRole, updateRole, listPermissions } = await import("@shopper/auth");
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  const full = await createRole(db, commandContext(context.orgId, owner!), {
    name: "full-catalog",
    permissionCodes: (await listPermissions(db, context.orgId)).map(({ code }) => code),
  });
  const admin = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("admin")! } }),
  );
  await assignMemberRole(db, commandContext(context.orgId, owner!), {
    userId: admin!.userId,
    roleId: full.after.id,
  });
  await expect(
    assignMemberRole(db, commandContext(context.orgId, admin!), {
      userId: admin!.userId,
      roleId: roleIds.get("superadmin")!,
    }),
  ).rejects.toThrow("Only an owner can grant the owner role");
  await updateRole(db, commandContext(context.orgId, owner!), {
    id: full.after.id,
    data: { permissionCodes: ["role.write"] },
  });
  await assignMemberRole(db, commandContext(context.orgId, owner!), {
    userId: admin!.userId,
    roleId: roleIds.get("admin")!,
  });
});

test("concurrent owner demotions leave exactly one owner and preserve live sessions", async () => {
  const owner = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("superadmin")! } }),
  );
  const admin = await auth.resolvePrincipal(
    new Request(baseURL, { headers: { cookie: cookies.get("admin")! } }),
  );
  await assignMemberRole(db, commandContext(context.orgId, owner!), {
    userId: admin!.userId,
    roleId: roleIds.get("superadmin")!,
  });
  const pool = new Pool({ connectionString: fixture.connectionString });
  try {
    const parallel = drizzle(pool, { schema });
    const results = await Promise.allSettled(
      [owner!, admin!].map((actor) =>
        assignMemberRole(parallel, commandContext(context.orgId, actor), {
          userId: actor.userId,
          roleId: roleIds.get("admin")!,
        }),
      ),
    );
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  } finally {
    await pool.end();
  }
  const refreshed = await Promise.all(
    ["superadmin", "admin"].map((name) =>
      auth.resolvePrincipal(new Request(baseURL, { headers: { cookie: cookies.get(name)! } })),
    ),
  );
  expect(refreshed.filter((actor) => actor?.roleId === roleIds.get("superadmin"))).toHaveLength(1);
});
