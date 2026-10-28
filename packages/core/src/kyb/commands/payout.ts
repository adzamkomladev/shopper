import { eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { kybCase } from "@shopper/db-pg";
import { enqueueKybNotice, lockKyb } from "../records";

/** Keeps the subaccount Paystack made for an approval; a code already kept is never replaced. */
export const saveKybSubaccount = defineCommand({
  name: "kyb.subaccount",
  async run(tx, context: CommandContext, input: { code: string }) {
    const row = await lockKyb(tx, context.orgId);
    if (row.subaccountCode) return { code: row.subaccountCode, saved: false };
    await tx
      .update(kybCase)
      .set({ subaccountCode: input.code, updatedAt: new Date() })
      .where(eq(kybCase.id, row.id));
    return { code: input.code, saved: true };
  },
  audit: (_input, output) => output,
});

/** Asks the owners, once per approval, to renew before the earliest card or document lapses. */
export const remindKybRenewal = defineCommand({
  name: "kyb.renewal",
  async run(tx, context: CommandContext, input: { version: number }) {
    const row = await lockKyb(tx, context.orgId);
    if (row.status !== "approved" || row.version !== input.version || row.renewalSentAt)
      return { sent: false };
    await tx
      .update(kybCase)
      .set({ renewalSentAt: new Date(), updatedAt: new Date() })
      .where(eq(kybCase.id, row.id));
    enqueueKybNotice(tx, context.orgId, "renew");
    return { sent: true };
  },
  audit: (input, output) => ({ version: input.version, ...output }),
});

/** The approval lapses on its expiry day. The subaccount stays, so payouts go on while the owner renews. */
export const expireKyb = defineCommand({
  name: "kyb.expire",
  async run(tx, context: CommandContext, input: { version: number; today: string }) {
    const row = await lockKyb(tx, context.orgId);
    if (
      row.status !== "approved" ||
      row.version !== input.version ||
      !row.expiresOn ||
      row.expiresOn > input.today
    )
      return { expired: false };
    await tx
      .update(kybCase)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(kybCase.id, row.id));
    enqueueKybNotice(tx, context.orgId, "expired");
    return { expired: true };
  },
  audit: (input, output) => ({ version: input.version, ...output }),
});

/** The run ends where the case stands: back with the owner, or approved with nothing left to wait for. */
export const closeKyb = defineCommand({
  name: "kyb.close",
  async run(tx, context: CommandContext) {
    const row = await lockKyb(tx, context.orgId);
    return { status: row.status, version: row.version };
  },
  audit: (_input, output) => output,
});
