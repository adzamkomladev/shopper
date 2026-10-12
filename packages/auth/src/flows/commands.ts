import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import {
  invitation,
  org,
  registrationRequest,
  type ShopperDatabase,
  type ShopperTransaction,
} from "@shopper/db-pg";
import type { AuthFlowParams } from "./workflow";

type Preparation = { params: AuthFlowParams; now: number };
export const prepareRegistration = defineCommand({
  name: "auth.registration.prepare-delivery",
  scope: "registration",
  run: (tx, _context, input: Preparation) => readDeliveryState(tx, input),
  audit: (_input, output) => ({ active: output.active }),
});
export const prepareInvitation = defineCommand({
  name: "auth.invitation.prepare-delivery",
  run: (tx, _context, input: Preparation) => readDeliveryState(tx, input),
  audit: (_input, output) => ({ active: output.active }),
});
export const deliverRegistration = defineCommand({
  name: "auth.registration.deliver",
  scope: "registration",
  run: outcome,
  audit: (_input, output) => ({ active: output.active, sent: output.sent }),
});
export const deliverInvitation = defineCommand({
  name: "auth.invitation.deliver",
  run: outcome,
  audit: (_input, output) => ({ active: output.active, sent: output.sent }),
});
export const endRegistration = defineCommand({
  name: "auth.registration.end",
  scope: "registration",
  run: end,
  audit: (_input, output) => output,
});
export const endInvitation = defineCommand({
  name: "auth.invitation.end",
  run: end,
  audit: (_input, output) => output,
});

export async function readDeliveryState(
  tx: ShopperDatabase | ShopperTransaction,
  input: Preparation,
) {
  const row =
    input.params.purpose === "registration"
      ? (
          await tx
            .select()
            .from(registrationRequest)
            .where(eq(registrationRequest.id, input.params.id))
        )[0]
      : (
          await tx
            .select()
            .from(invitation)
            .where(
              and(eq(invitation.id, input.params.id), eq(invitation.orgId, input.params.orgId)),
            )
        )[0];
  const expired = Boolean(row && row.expiresAt.getTime() <= input.now);
  const active = Boolean(
    row &&
    !expired &&
    !("completedAt" in row && row.completedAt) &&
    !("status" in row && row.status !== "pending"),
  );
  const [shop] =
    input.params.purpose === "invitation"
      ? await tx.select({ slug: org.slug }).from(org).where(eq(org.id, input.params.orgId))
      : [];
  return {
    active,
    expired,
    expiresAt: row?.expiresAt.toISOString() ?? new Date(input.now).toISOString(),
    email: row?.email ?? "",
    channel: row && "channel" in row ? row.channel : "email",
    shopCode: shop?.slug ?? "",
  };
}
async function outcome(
  _tx: ShopperTransaction,
  _context: CommandContext,
  input: { active: boolean; expired: boolean; expiresAt: string; sent: boolean },
) {
  return input;
}
async function end(
  tx: ShopperTransaction,
  _context: CommandContext,
  input: { params: AuthFlowParams; expired: boolean },
) {
  let expired = input.expired;
  if (input.params.purpose === "invitation") {
    const [row] = await tx
      .select({ status: invitation.status })
      .from(invitation)
      .where(and(eq(invitation.id, input.params.id), eq(invitation.orgId, input.params.orgId)));
    expired = expired && row?.status === "pending";
    if (expired)
      await tx
        .update(invitation)
        .set({ status: "expired" })
        .where(
          and(
            eq(invitation.id, input.params.id),
            eq(invitation.orgId, input.params.orgId),
            eq(invitation.status, "pending"),
          ),
        );
  } else {
    const [row] = await tx
      .select({ completedAt: registrationRequest.completedAt })
      .from(registrationRequest)
      .where(eq(registrationRequest.id, input.params.id));
    expired = expired && !row?.completedAt;
  }
  return { id: input.params.id, expired };
}
