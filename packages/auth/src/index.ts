import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { member, org, role, user, type ShopperDatabase } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { buildAuth } from "./better-auth";
import { grantedCodes, seedRoleRows, type AuthPrincipal } from "./roles";

export { seedAuthRoles, type AuthPrincipal } from "./roles";
export { assignMemberRole, registerOrganizationUser } from "./users";
export { createDeviceService } from "./devices";

export interface CreateAuthOptions {
  database: ShopperDatabase;
  orgId: string;
  secret: string;
  baseURL: string;
  bootstrapToken?: string;
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
      const found = await grantedCodes(input.database, orgId, principal.userId, {
        roleId: principal.roleId,
        code,
        deviceId: principal.deviceId,
      }).limit(1);
      return found.length > 0;
    },
  };
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
