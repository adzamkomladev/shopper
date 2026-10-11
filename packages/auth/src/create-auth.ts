import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { member, role } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { AuthRollback, mutating } from "./auth-request";
import { buildAuth } from "./better-auth";
import { constantTimeEqual, response } from "./http";
import { grantedCodes } from "./roles";
import type { AuthPrincipal, CreateAuthOptions } from "./types";

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
