import * as v from "valibot";
import { v7 } from "uuid";
import { and, desc, eq, sql } from "drizzle-orm";
import { buildInfo } from "@shopper/config";
import { assertLinkSecret } from "@shopper/utils";
import { invitation, org, workflowStep } from "@shopper/db-pg";
import { uuidV7Schema } from "@shopper/ports";
import { signalAuthCompletion } from "../flows/completion";
import { AuthLinkError, createLinkToken } from "../links/tokens";
import { invitationAcceptSchema, invitationIssueSchema } from "../schemas/invitations";
import { linkTokenSchema } from "../schemas/onboarding";
import type { AuthPrincipal } from "../roles/service";
import type { OnboardingOptions } from "../onboarding/service";
import { acceptInvitation, cancelInvitation, issueInvitation } from "./commands";
import { invitationFor, invitationPreview, invitationView } from "./records";

export function createInvitations(options: OnboardingOptions) {
  assertLinkSecret(options.linkSecret);
  const now = options.now ?? Date.now;
  const context = (principal: AuthPrincipal) => ({
    orgId: principal.orgId,
    actorId: principal.userId,
    deviceId: principal.deviceId,
    branchId: principal.branchId,
    appVersion: buildInfo.version,
  });
  async function issue(principal: AuthPrincipal, raw: unknown, replaces?: string) {
    const data = v.parse(invitationIssueSchema, raw);
    const id = v7();
    const result = await issueInvitation(
      options.database,
      context(principal),
      {
        id,
        data,
        linkSecret: options.linkSecret,
        launcher: options.launcher,
        now: now(),
        replaces,
      },
      { instanceId: id, businessKey: id, type: "invitation", step: "issue", status: "waiting" },
    );
    if (data.channel !== "local") return { ...result, setupLink: undefined };
    const [shop] = await options.database
      .select({ slug: org.slug })
      .from(org)
      .where(eq(org.id, principal.orgId));
    const url = new URL("/accept-invitation", options.baseURL);
    url.searchParams.set("id", result.id);
    url.searchParams.set(
      "token",
      await createLinkToken(options.linkSecret, "invitation", result.id),
    );
    url.searchParams.set("shop", shop!.slug);
    return { ...result, setupLink: url.toString() };
  }
  return {
    issue,
    async list(principal: AuthPrincipal) {
      const rows = await options.database
        .select({
          row: invitation,
          // Nest the subquery so single-table selection keeps its correlated column qualifiers.
          deliveryStatus: sql<string>`coalesce((${sql`select case when ${workflowStep.output}->>'sent' = 'true' then 'sent' else 'failed' end from ${workflowStep} where ${workflowStep.orgId} = ${invitation.orgId} and ${workflowStep.instanceId} = ${invitation.id}::text and ${workflowStep.name} like 'delivery-%' order by ${workflowStep.createdAt} desc limit 1`}), 'pending')`,
        })
        .from(invitation)
        .where(eq(invitation.orgId, principal.orgId))
        .orderBy(desc(invitation.createdAt));
      return rows.map(({ row, deliveryStatus }) => ({ ...invitationView(row), deliveryStatus }));
    },
    async reissue(principal: AuthPrincipal, rawId: string) {
      const id = v.parse(uuidV7Schema, rawId).toLowerCase();
      const [row] = await options.database
        .select()
        .from(invitation)
        .where(and(eq(invitation.orgId, principal.orgId), eq(invitation.id, id)));
      if (!row || !row.roleId) throw new AuthLinkError("Invitation not found", 404);
      const result = await issue(
        principal,
        { email: row.email, roleId: row.roleId, channel: row.channel },
        id,
      );
      await signalAuthCompletion(options, { id, orgId: principal.orgId, purpose: "invitation" });
      return result;
    },
    async cancel(principal: AuthPrincipal, rawId: string) {
      const id = v.parse(uuidV7Schema, rawId).toLowerCase();
      const result = await cancelInvitation(options.database, context(principal), id);
      await signalAuthCompletion(options, { id, orgId: principal.orgId, purpose: "invitation" });
      return result;
    },
    async preview(rawId: string, rawToken: string) {
      const id = v.parse(uuidV7Schema, rawId).toLowerCase();
      const token = v.parse(linkTokenSchema, rawToken);
      return invitationPreview(
        options.database,
        await invitationFor(options.database, id, token, now()),
      );
    },
    async accept(rawId: string, raw: unknown, principal?: AuthPrincipal) {
      const id = v.parse(uuidV7Schema, rawId).toLowerCase();
      const data = v.parse(invitationAcceptSchema, raw);
      const row = await invitationFor(options.database, id, data.token, now());
      const result = await acceptInvitation(
        options.database,
        { orgId: row.orgId, appVersion: buildInfo.version },
        { id, data, principal, now: now() },
      );
      await signalAuthCompletion(options, { id, orgId: row.orgId, purpose: "invitation" });
      return result;
    },
  };
}
