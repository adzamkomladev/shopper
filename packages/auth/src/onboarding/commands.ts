import { eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import { provisionOrg } from "@shopper/core";
import { org, registrationRequest, type ShopperTransaction } from "@shopper/db-pg";
import type * as v from "valibot";
import type { WorkflowLauncher } from "@shopper/ports";
import { createVerifiedOwner } from "./owner";
import { assertLink, AuthLinkError } from "../links/tokens";
import type { registrationStartSchema, registrationCompleteSchema } from "../schemas/onboarding";

export const startRegistration = defineCommand({
  name: "auth.registration.start",
  scope: "registration",
  async run(
    tx,
    context,
    input: {
      data: v.InferOutput<typeof registrationStartSchema>;
      digest: string;
      expiresAt: Date;
      launcher: WorkflowLauncher;
    },
  ) {
    await tx.insert(registrationRequest).values({
      id: context.orgId,
      ...input.data,
      verificationDigest: input.digest,
      expiresAt: input.expiresAt,
    });
    await input.launcher.start(context.orgId, { id: context.orgId, purpose: "registration" });
    return { id: context.orgId, email: input.data.email, expiresAt: input.expiresAt.toISOString() };
  },
  audit: (_input, result) => ({ registrationId: result.id }),
});
export const verifyRegistration = defineCommand({
  name: "auth.registration.verify",
  scope: "registration",
  async run(tx, context, input: { token: string; now: number }) {
    const row = await registrationFor(tx, context.orgId, input.token, input.now);
    if (!row.verifiedAt)
      await tx
        .update(registrationRequest)
        .set({ verifiedAt: new Date(input.now) })
        .where(eq(registrationRequest.id, row.id));
    return registrationView({ ...row, verifiedAt: row.verifiedAt ?? new Date(input.now) });
  },
  audit: (_input, result) => ({ registrationId: result.id }),
});
export const completeRegistration = defineCommand({
  name: "auth.registration.complete",
  scope: "registration",
  async run(
    tx,
    context,
    input: { data: v.InferOutput<typeof registrationCompleteSchema>; now: number },
  ) {
    const row = await registrationFor(tx, context.orgId, input.data.token, input.now);
    if (row.completedAt) return completedResult(row);
    if (!row.verifiedAt) throw new AuthLinkError("Verify your email before creating the shop", 409);
    const shopCode = input.data.shopCode ?? row.shopCode;
    const [taken] = await tx.select({ id: org.id }).from(org).where(eq(org.slug, shopCode));
    if (taken) throw new AuthLinkError("Shop code is already in use", 409);
    try {
      await provisionOrg(tx, context, { name: row.shopName, slug: shopCode, metadata: buildInfo });
    } catch (error) {
      // A different registration can race on the same global shop code.
      if (isUniqueViolation(error)) throw new AuthLinkError("Shop code is already in use", 409);
      throw error;
    }
    await createVerifiedOwner(tx, context, {
      name: row.name,
      email: row.email,
      password: input.data.password,
    });
    const result = { orgId: context.orgId, shopCode, email: row.email };
    await tx
      .update(registrationRequest)
      .set({ shopCode, completedAt: new Date(input.now), result })
      .where(eq(registrationRequest.id, row.id));
    return result;
  },
  audit: (_input, result) => ({ registrationId: result.orgId, shopCode: result.shopCode }),
});
export async function registrationFor(
  tx: ShopperTransaction,
  id: string,
  token: string,
  now: number,
) {
  const [row] = await tx.select().from(registrationRequest).where(eq(registrationRequest.id, id));
  if (!row) throw new AuthLinkError("This link is invalid or expired", 410);
  await assertLink(row.verificationDigest, token, row.expiresAt, now);
  return row;
}
export function registrationView(row: typeof registrationRequest.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    shopName: row.shopName,
    shopCode: row.shopCode,
    expiresAt: row.expiresAt.toISOString(),
    verified: Boolean(row.verifiedAt),
    completed: Boolean(row.completedAt),
  };
}
function completedResult(row: typeof registrationRequest.$inferSelect) {
  return { orgId: row.id, shopCode: row.shopCode, email: row.email };
}
function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Error &&
    (("code" in error && error.code === "23505") ||
      ("cause" in error && isUniqueViolation(error.cause)))
  );
}
