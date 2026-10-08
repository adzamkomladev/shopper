import { and, eq, sql } from "drizzle-orm";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import type { DBAdapter, BetterAuthOptions, Where } from "better-auth";
import { organization } from "better-auth/plugins/organization";
import { hashPassword } from "better-auth/crypto";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import {
  account,
  invitation,
  member,
  org,
  permission,
  role,
  rolePermission,
  session,
  user,
  verification,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";

export interface AuthPrincipal {
  orgId: string;
  userId: string;
  roleId: string;
  roleName: string;
  deviceId?: string;
  branchId?: string;
}

export interface CreateAuthOptions {
  database: ShopperDatabase;
  orgId: string;
  secret: string;
  baseURL: string;
  bootstrapToken?: string;
}

const permissionNames = [
  "sale.create",
  "refund.approve",
  "refund.request",
  "shift.read",
  "shift.write",
  "stock.read",
  "stock.write",
  "product.write",
  "product.propose",
  "tax.read",
  "tax.write",
  "report.read",
  "audit.read",
  "user.write",
  "role.write",
  "store.read",
  "store.write",
  "branch.read",
  "branch.write",
  "device.enroll",
  "device.revoke",
  "cashier.pin.assign",
] as const;

const rolePermissions: Record<string, readonly string[]> = {
  superadmin: permissionNames,
  admin: permissionNames.filter(
    (code) => !code.startsWith("store.") && !code.startsWith("branch.") && code !== "tax.write",
  ),
  accountant: ["shift.read", "stock.read", "tax.read", "report.read", "audit.read"],
  inventory: ["stock.read", "stock.write", "product.propose"],
  cashier: ["sale.create", "refund.request", "shift.read", "shift.write"],
};
const tillPermissions = new Set([
  "sale.create",
  "refund.approve",
  "refund.request",
  "shift.read",
  "shift.write",
]);

async function seedRoleRows(tx: ShopperTransaction, orgId: string) {
  await tx
    .insert(permission)
    .values(
      permissionNames.map((code) => ({ orgId, code, tillAllowed: tillPermissions.has(code) })),
    )
    .onConflictDoUpdate({
      target: [permission.orgId, permission.code],
      set: { tillAllowed: sql`excluded.till_allowed` },
    });
  await tx
    .insert(role)
    .values(Object.keys(rolePermissions).map((name) => ({ orgId, name })))
    .onConflictDoNothing();
  const [permissionRows, roleRows] = await Promise.all([
    tx
      .select({ id: permission.id, code: permission.code })
      .from(permission)
      .where(eq(permission.orgId, orgId)),
    tx.select({ id: role.id, name: role.name }).from(role).where(eq(role.orgId, orgId)),
  ]);
  const permissionIds = new Map(permissionRows.map((row) => [row.code, row.id]));
  const roleIds = new Map(roleRows.map((row) => [row.name, row.id]));
  const links = Object.entries(rolePermissions).flatMap(([roleName, codes]) =>
    codes.flatMap((code) => {
      const permissionId = permissionIds.get(code);
      const roleId = roleIds.get(roleName);
      return permissionId && roleId ? [{ orgId, roleId, permissionId }] : [];
    }),
  );
  if (links.length) await tx.insert(rolePermission).values(links).onConflictDoNothing();
  return {
    roleCount: Object.keys(rolePermissions).length,
    permissionCount: permissionNames.length,
  };
}

export const seedAuthRoles = defineCommand({
  name: "auth.roles.seed",
  run: (tx, context) => seedRoleRows(tx, context.orgId),
  audit: (_input, output) => output,
});

const assignRoleInput = v.strictObject({ userId: uuidV7Schema, roleId: uuidV7Schema });
async function assertHasPermission(
  tx: ShopperTransaction,
  orgId: string,
  userId: string,
  code: string,
  deviceId?: string,
) {
  const conditions = [
    eq(member.orgId, orgId),
    eq(member.userId, userId),
    eq(permission.code, code),
  ];
  if (deviceId) conditions.push(eq(permission.tillAllowed, true));
  const [found] = await tx
    .select({ id: permission.id })
    .from(member)
    .innerJoin(
      rolePermission,
      and(eq(rolePermission.orgId, member.orgId), eq(rolePermission.roleId, member.roleId)),
    )
    .innerJoin(
      permission,
      and(
        eq(permission.orgId, rolePermission.orgId),
        eq(permission.id, rolePermission.permissionId),
      ),
    )
    .where(and(...conditions))
    .limit(1);
  if (!found) throw new Error("Permission denied");
}
async function assertCanGrantRole(
  tx: ShopperTransaction,
  context: CommandContext,
  targetRoleId: string,
) {
  const actorConditions = [eq(member.orgId, context.orgId), eq(member.userId, context.actorId!)];
  const grantConditions = [
    eq(rolePermission.orgId, context.orgId),
    eq(rolePermission.roleId, targetRoleId),
  ];
  const actorQuery = tx
    .select({ code: permission.code })
    .from(member)
    .innerJoin(
      rolePermission,
      and(eq(rolePermission.orgId, member.orgId), eq(rolePermission.roleId, member.roleId)),
    )
    .innerJoin(
      permission,
      and(
        eq(permission.orgId, rolePermission.orgId),
        eq(permission.id, rolePermission.permissionId),
      ),
    )
    .where(
      and(...actorConditions, ...(context.deviceId ? [eq(permission.tillAllowed, true)] : [])),
    );
  const grantQuery = tx
    .select({ code: permission.code })
    .from(rolePermission)
    .innerJoin(
      permission,
      and(
        eq(permission.orgId, rolePermission.orgId),
        eq(permission.id, rolePermission.permissionId),
      ),
    )
    .where(and(...grantConditions));
  const [actorRows, grantRows] = await Promise.all([actorQuery, grantQuery]);
  const actorCodes = new Set(actorRows.map(({ code }) => code));
  if (grantRows.some(({ code }) => !actorCodes.has(code)))
    throw new Error("Cannot grant permissions you do not hold");
}

export const assignMemberRole = defineCommand({
  name: "auth.member.assign-role",
  async run(tx, context, rawInput: unknown) {
    const input = v.parse(assignRoleInput, rawInput);
    if (!context.actorId) throw new Error("An authenticated actor is required");
    await assertHasPermission(tx, context.orgId, context.actorId, "role.write", context.deviceId);
    const [targetUser] = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.orgId, context.orgId), eq(user.id, input.userId)))
      .limit(1);
    const [targetRole] = await tx
      .select({ id: role.id, name: role.name })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.id, input.roleId)))
      .limit(1);
    if (!targetUser || !targetRole) throw new Error("User or role not found in this organization");
    await assertCanGrantRole(tx, context, targetRole.id);
    const [assigned] = await tx
      .insert(member)
      .values({
        orgId: context.orgId,
        organizationId: context.orgId,
        userId: input.userId,
        role: "member",
        roleId: input.roleId,
      })
      .onConflictDoUpdate({
        target: [member.orgId, member.organizationId, member.userId],
        set: { role: "member", roleId: input.roleId },
      })
      .returning({ id: member.id });
    return {
      memberId: assigned!.id,
      userId: input.userId,
      roleId: targetRole.id,
      roleName: targetRole.name,
    };
  },
  audit: (input, output) => ({ userId: output.userId, roleId: output.roleId }),
  details: (_input, output) => ({ entity: "member", entityId: output.memberId, after: output }),
});

const registerUserInput = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(200)),
  email: v.pipe(v.string(), v.trim(), v.email()),
  password: v.pipe(v.string(), v.minLength(8), v.maxLength(128)),
  roleId: uuidV7Schema,
});
export const registerOrganizationUser = defineCommand({
  name: "auth.user.register",
  async run(tx, context, rawInput: unknown) {
    if (!context.actorId) throw new Error("An authenticated actor is required");
    const input = v.parse(registerUserInput, rawInput);
    await assertHasPermission(tx, context.orgId, context.actorId, "user.write", context.deviceId);
    await assertHasPermission(tx, context.orgId, context.actorId, "role.write", context.deviceId);
    const [targetRole] = await tx
      .select({ id: role.id })
      .from(role)
      .where(and(eq(role.orgId, context.orgId), eq(role.id, input.roleId)))
      .limit(1);
    if (!targetRole) throw new Error("Role not found in this organization");
    await assertCanGrantRole(tx, context, targetRole.id);
    const [created] = await tx
      .insert(user)
      .values({
        orgId: context.orgId,
        name: input.name,
        email: input.email.toLowerCase(),
      })
      .returning({ id: user.id });
    await tx.insert(account).values({
      orgId: context.orgId,
      accountId: created!.id,
      providerId: "credential",
      userId: created!.id,
      password: await hashPassword(input.password),
    });
    const [assigned] = await tx
      .insert(member)
      .values({
        orgId: context.orgId,
        organizationId: context.orgId,
        userId: created!.id,
        role: "member",
        roleId: targetRole.id,
      })
      .returning({ id: member.id });
    return { userId: created!.id, memberId: assigned!.id, roleId: targetRole.id };
  },
  audit: (_input, output) => ({ userId: output.userId, roleId: output.roleId }),
  details: (_input, output) => ({ entity: "user", entityId: output.userId, after: output }),
});

const authModels = new Set([
  "user",
  "session",
  "account",
  "verification",
  "organization",
  "member",
  "invitation",
]);
const authSchema = { user, session, account, verification, organization: org, member, invitation };
function tenantAdapter(
  database: unknown,
  orgId: string,
  options: BetterAuthOptions,
  readOnly = false,
): DBAdapter {
  const adapter = drizzleAdapter(database as ShopperDatabase, {
    provider: "pg",
    schema: authSchema,
    transaction: false,
  })(options);
  const scoped = (model: string, where?: Where[]) =>
    authModels.has(model)
      ? [...(where ?? []), { field: "orgId", value: orgId } satisfies Where]
      : where;
  let scopedAdapter: DBAdapter;
  scopedAdapter = {
    ...adapter,
    transaction: (callback) => callback(scopedAdapter),
    create: (input) => {
      if (readOnly) throw new Error("Read-only auth request");
      if (input.model === "organization")
        throw new Error("Organizations are provisioned by Shopper");
      return adapter.create({ ...input, data: { ...input.data, orgId } });
    },
    findOne: (input) => adapter.findOne({ ...input, where: scoped(input.model, input.where)! }),
    findMany: (input) => adapter.findMany({ ...input, where: scoped(input.model, input.where) }),
    count: (input) => adapter.count({ ...input, where: scoped(input.model, input.where) }),
    update: async (input) => {
      if (readOnly) return null;
      const { orgId: _ignored, ...update } = input.update;
      return adapter.update({ ...input, where: scoped(input.model, input.where)!, update });
    },
    updateMany: async (input) => {
      if (readOnly) return 0;
      const { orgId: _ignored, ...update } = input.update;
      return adapter.updateMany({ ...input, where: scoped(input.model, input.where)!, update });
    },
    delete: (input) =>
      readOnly
        ? Promise.resolve()
        : adapter.delete({ ...input, where: scoped(input.model, input.where)! }),
    deleteMany: (input) =>
      readOnly
        ? Promise.resolve(0)
        : adapter.deleteMany({ ...input, where: scoped(input.model, input.where)! }),
    consumeOne: (input) =>
      readOnly
        ? Promise.resolve(null)
        : adapter.consumeOne({ ...input, where: scoped(input.model, input.where)! }),
    incrementOne: (input) =>
      readOnly
        ? Promise.resolve(null)
        : adapter.incrementOne({ ...input, where: scoped(input.model, input.where)! }),
  };
  return scopedAdapter;
}

class AuthRollback extends Error {
  constructor(public readonly response: Response) {
    super("Authentication request rolled back");
  }
}

const mutating = defineCommand({
  name: "auth.request",
  async run(
    tx,
    context,
    input: { request: Request; orgId: string; baseURL: string; secret: string },
  ) {
    const path = new URL(input.request.url).pathname;
    if (path.endsWith("/sign-up/email")) {
      // Serialize first-user bootstrap attempts even when they use different emails.
      await tx.execute(sql`select id from ${org} where id = ${context.orgId} for update`);
      const [existing] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.orgId, context.orgId))
        .limit(1);
      if (existing) throw new AuthRollback(response({ error: "Registration is closed" }, 403));
      await seedRoleRows(tx, context.orgId);
    }
    const auth = buildAuth(tx, context.orgId, input.secret, input.baseURL);
    const result = await auth.handler(input.request);
    if (result.status >= 400) throw new AuthRollback(result);
    if (path.endsWith("/sign-in/email") || path.endsWith("/sign-up/email")) {
      let responseUserId: unknown;
      try {
        responseUserId = (await result.clone().json())?.user?.id;
      } catch {
        // Keep the successful auth response; only enrich audit context when its shape is verified.
      }
      if (typeof responseUserId === "string" && v.safeParse(uuidV7Schema, responseUserId).success) {
        const [membership] = await tx
          .select({ userId: member.userId, roleName: role.name })
          .from(member)
          .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
          .where(and(eq(member.orgId, context.orgId), eq(member.userId, responseUserId)))
          .limit(1);
        if (membership) {
          context.actorId = membership.userId;
          context.role = membership.roleName;
        }
      }
    }
    return { response: result, status: result.status, actorId: context.actorId };
  },
  audit: (input, result) => ({
    method: input.request.method,
    path: new URL(input.request.url).pathname,
    status: result.status,
    ...(result.actorId ? { userId: result.actorId } : {}),
  }),
  details: (_input, result) => (result.actorId ? { entity: "user", entityId: result.actorId } : {}),
});

function response(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

function constantTimeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
  return difference === 0;
}

function buildAuth(
  database: ShopperDatabase | ShopperTransaction,
  orgId: string,
  secret: string,
  baseURL: string,
  readOnly = false,
) {
  return betterAuth({
    baseURL,
    basePath: "/api/auth",
    secret,
    database: (options: BetterAuthOptions) => tenantAdapter(database, orgId, options, readOnly),
    advanced: {
      database: { generateId: () => v7(), joins: false },
      ipAddress: { ipAddressHeaders: ["x-shopper-client-ip"] },
    },
    // ponytail: per-isolate limiter; use distributed RateLimiter when traffic spans isolates.
    rateLimit: { enabled: true, storage: "memory" },
    user: {
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    account: {
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    session: {
      disableSessionRefresh: true,
      deferSessionRefresh: true,
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    verification: {
      storeInDatabase: true,
      disableCleanup: true,
      additionalFields: {
        orgId: { type: "string", required: true, defaultValue: orgId, input: false },
      },
    },
    emailAndPassword: { enabled: true, requireEmailVerification: false },
    databaseHooks: {
      user: {
        create: {
          before: async (newUser) => ({ data: { ...newUser, orgId } }),
          after: async (newUser) => {
            const [superadmin] = await database
              .select({ id: role.id })
              .from(role)
              .where(and(eq(role.orgId, orgId), eq(role.name, "superadmin")))
              .limit(1);
            if (!superadmin) throw new Error("Default roles have not been seeded");
            await database.insert(member).values({
              orgId,
              organizationId: orgId,
              userId: newUser.id,
              role: "owner",
              roleId: superadmin.id,
            });
          },
        },
      },
      session: {
        create: {
          before: async (newSession) => ({
            data: { ...newSession, orgId, activeOrganizationId: orgId },
          }),
        },
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: false,
        schema: {
          organization: {
            additionalFields: {
              orgId: { type: "string", required: true, defaultValue: orgId, input: false },
            },
          },
          member: {
            additionalFields: {
              orgId: { type: "string", required: true, defaultValue: orgId, input: false },
              roleId: { type: "string", required: true, input: false },
            },
          },
          invitation: {
            additionalFields: {
              orgId: { type: "string", required: true, defaultValue: orgId, input: false },
            },
          },
        },
      }),
    ],
  });
}

export function createAuth(input: CreateAuthOptions) {
  const orgId = v.parse(uuidV7Schema, input.orgId).toLowerCase();
  if (input.secret.length < 32)
    throw new Error("Better Auth secret must be at least 32 characters");
  const paths = new Map([
    ["GET /api/auth/get-session", "read"],
    ["GET /api/auth/organization/list", "read"],
    ["GET /api/auth/organization/get-full-organization", "read"],
    ["POST /api/auth/sign-up/email", "write"],
    ["POST /api/auth/sign-in/email", "write"],
    ["POST /api/auth/sign-out", "write"],
    ["POST /api/auth/change-password", "write"],
    ["POST /api/auth/organization/set-active", "write"],
  ]);
  return {
    async handler(request: Request) {
      const url = new URL(request.url);
      const action = paths.get(`${request.method.toUpperCase()} ${url.pathname}`);
      if (!action) return response({ error: "Not found" }, 404);
      if (url.pathname.endsWith("/sign-up/email")) {
        if (
          !input.bootstrapToken ||
          !constantTimeEqual(
            request.headers.get("X-Shopper-Bootstrap-Token") ?? "",
            input.bootstrapToken,
          )
        ) {
          return response({ error: "Registration is closed" }, 403);
        }
      }
      if (action === "read")
        return buildAuth(input.database, orgId, input.secret, input.baseURL, true).handler(request);
      const principal = await this.resolvePrincipal(request);
      try {
        const result = await mutating(
          input.database,
          {
            orgId,
            actorId: principal?.userId,
            role: principal?.roleName,
            deviceId: principal?.deviceId,
            branchId: principal?.branchId,
            appVersion: buildInfo.version,
          },
          { request, orgId, baseURL: input.baseURL, secret: input.secret },
        );
        return result.response;
      } catch (error) {
        if (error instanceof AuthRollback) return error.response;
        throw error;
      }
    },
    async resolvePrincipal(request: Request): Promise<AuthPrincipal | null> {
      const sessionResult = await buildAuth(
        input.database,
        orgId,
        input.secret,
        input.baseURL,
        true,
      ).api.getSession({ headers: request.headers });
      if (!sessionResult) return null;
      const [membership] = await input.database
        .select({ roleId: role.id, roleName: role.name })
        .from(member)
        .innerJoin(role, and(eq(role.orgId, member.orgId), eq(role.id, member.roleId)))
        .where(and(eq(member.orgId, orgId), eq(member.userId, sessionResult.user.id)))
        .limit(1);
      return membership
        ? {
            orgId,
            userId: sessionResult.user.id,
            roleId: membership.roleId,
            roleName: membership.roleName,
          }
        : null;
    },
    async hasPermission(principal: AuthPrincipal, code: string): Promise<boolean> {
      if (principal.orgId !== orgId) return false;
      const conditions = [
        eq(member.orgId, orgId),
        eq(member.userId, principal.userId),
        eq(member.roleId, principal.roleId),
        eq(permission.code, code),
      ];
      if (principal.deviceId) conditions.push(eq(permission.tillAllowed, true));
      const [found] = await input.database
        .select({ id: permission.id })
        .from(member)
        .innerJoin(
          rolePermission,
          and(eq(rolePermission.orgId, member.orgId), eq(rolePermission.roleId, member.roleId)),
        )
        .innerJoin(
          permission,
          and(
            eq(permission.orgId, rolePermission.orgId),
            eq(permission.id, rolePermission.permissionId),
          ),
        )
        .where(and(...conditions))
        .limit(1);
      return !!found;
    },
  };
}

export { createDeviceService } from "./devices";
export type { DevicePrincipal } from "./devices";
