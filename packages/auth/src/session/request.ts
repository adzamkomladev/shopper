import { and, eq, sql } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { member, org, role, user } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { buildAuth } from "./better-auth";
import { response } from "./http";
import { seedRoleRows } from "../roles";

export class AuthRollback extends Error {
  constructor(public readonly response: Response) {
    super("Authentication request rolled back");
  }
}

// Every mutating auth request runs as one audited command; failures roll back.
export const mutating = defineCommand({
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
