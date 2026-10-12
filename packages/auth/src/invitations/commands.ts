import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { defineCommand } from "@shopper/audit";
import { account, invitation, org, user } from "@shopper/db-pg";
import type * as v from "valibot";
import type { WorkflowLauncher } from "@shopper/ports";
import { assertCanGrantRole, assertHasPermission, type AuthPrincipal } from "../roles/service";
import { AuthLinkError, createLinkToken, linkDigest } from "../links/tokens";
import type { invitationIssueSchema, invitationAcceptSchema } from "../schemas/invitations";
import { assignMemberRole } from "../users";
import { invitationFor, invitationView } from "./records";

type IssueInput = {
  id: string;
  data: v.InferOutput<typeof invitationIssueSchema>;
  linkSecret: string;
  launcher: WorkflowLauncher;
  now: number;
  replaces?: string;
};
export const issueInvitation = defineCommand({
  name: "auth.invitation.issue",
  async run(tx, context, input: IssueInput) {
    await assertHasPermission(tx, context, "user.write");
    await assertHasPermission(tx, context, "role.write");
    await assertCanGrantRole(tx, context, input.data.roleId);
    if (input.replaces) {
      const [prior] = await tx
        .select()
        .from(invitation)
        .where(and(eq(invitation.orgId, context.orgId), eq(invitation.id, input.replaces)));
      if (!prior || prior.status !== "pending")
        throw new AuthLinkError("Invitation cannot be reissued", 409);
      await tx.update(invitation).set({ status: "replaced" }).where(eq(invitation.id, prior.id));
    }
    const id = input.id;
    const token = await createLinkToken(input.linkSecret, "invitation", id);
    const [row] = await tx
      .insert(invitation)
      .values({
        id,
        orgId: context.orgId,
        organizationId: context.orgId,
        email: input.data.email,
        roleId: input.data.roleId,
        channel: input.data.channel,
        inviterId: context.actorId!,
        tokenDigest: await linkDigest(token),
        expiresAt: new Date(input.now + 604_800_000),
      })
      .returning();
    if (!row) throw new Error("Invitation creation failed");
    await input.launcher.start(id, { id, orgId: context.orgId, purpose: "invitation" });
    return invitationView(row);
  },
  audit: (_input, result) => ({
    invitationId: result.id,
    roleId: result.roleId,
    channel: result.channel,
  }),
});
export const cancelInvitation = defineCommand({
  name: "auth.invitation.cancel",
  async run(tx, context, id: string) {
    await assertHasPermission(tx, context, "user.write");
    await assertHasPermission(tx, context, "role.write");
    const [row] = await tx
      .select()
      .from(invitation)
      .where(and(eq(invitation.orgId, context.orgId), eq(invitation.id, id)));
    if (!row || row.status !== "pending")
      throw new AuthLinkError("Invitation cannot be cancelled", 409);
    await assertCanGrantRole(tx, context, row.roleId!);
    await tx.update(invitation).set({ status: "cancelled" }).where(eq(invitation.id, id));
    return { id, status: "cancelled" };
  },
  audit: (_input, result) => result,
});
export const acceptInvitation = defineCommand({
  name: "auth.invitation.accept",
  async run(
    tx,
    context,
    input: {
      id: string;
      data: v.InferOutput<typeof invitationAcceptSchema>;
      principal?: AuthPrincipal;
      now: number;
    },
  ) {
    const row = await invitationFor(tx, input.id, input.data.token, input.now, context.orgId);
    const inviter = { ...context, actorId: row.inviterId, deviceId: undefined };
    await assertHasPermission(tx, inviter, "user.write");
    await assertHasPermission(tx, inviter, "role.write");
    await assertCanGrantRole(tx, inviter, row.roleId!);
    const [existing] = await tx
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.orgId, context.orgId), eq(user.email, row.email)));
    let userId: string;
    if (existing) {
      if (
        input.principal?.orgId !== context.orgId ||
        input.principal.userId !== existing.id ||
        input.principal.deviceId
      )
        throw new AuthLinkError("Sign in with the invited account to accept this invitation", 401);
      userId = existing.id;
    } else {
      if (!input.data.name || !input.data.password)
        throw new AuthLinkError("Name and password are required");
      const [created] = await tx
        .insert(user)
        .values({
          orgId: context.orgId,
          name: input.data.name,
          email: row.email,
          emailVerified: row.channel === "email",
        })
        .returning({ id: user.id });
      if (!created) throw new Error("Staff creation failed");
      userId = created.id;
      await tx.insert(account).values({
        orgId: context.orgId,
        userId,
        accountId: userId,
        providerId: "credential",
        password: await hashPassword(input.data.password),
      });
    }
    await assignMemberRole(tx, inviter, { userId, roleId: row.roleId! });
    await tx
      .update(invitation)
      .set({ consumedAt: new Date(input.now), status: "accepted" })
      .where(eq(invitation.id, row.id));
    const [shop] = await tx
      .select({ shopCode: org.slug })
      .from(org)
      .where(eq(org.id, context.orgId));
    return {
      orgId: context.orgId,
      shopCode: shop!.shopCode,
      email: row.email,
      userId,
      roleId: row.roleId!,
    };
  },
  audit: (input, result) => ({
    invitationId: input.id,
    userId: result.userId,
    roleId: result.roleId,
  }),
});
