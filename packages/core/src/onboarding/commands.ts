import { eq } from "drizzle-orm";
import { v7 } from "uuid";
import { defineCommand, enqueueAfterCommit, type CommandContext } from "@shopper/audit";
import { onboarding, registrationRequest } from "@shopper/db-pg";
import { orgOwners } from "../audit/anchor";
import { lockOnboarding } from "./records";

/** At most this many nudges toward the first sale. */
export const MAX_NUDGES = 3;

/** Before the shop exists: whether the signup still waits on its email, so a reminder is worth sending. */
export const remindRegistration = defineCommand({
  name: "onboarding.registration.remind",
  scope: "registration",
  async run(tx, context: CommandContext, input: { now: number }) {
    const [row] = await tx
      .select()
      .from(registrationRequest)
      .where(eq(registrationRequest.id, context.orgId))
      .for("update");
    const due = Boolean(
      row && !row.verifiedAt && !row.completedAt && row.expiresAt.getTime() > input.now,
    );
    return { due };
  },
  audit: (_input, output) => output,
});

/** The signup's link expired before the shop was made: its onboarding ends here. */
export const abandonRegistration = defineCommand({
  name: "onboarding.registration.abandon",
  scope: "registration",
  run: async () => ({ abandoned: true }),
  audit: (_input, output) => output,
});

/** The shop was made: the signup's part of onboarding is over, and the shop's part begins. */
export const registeredOnboarding = defineCommand({
  name: "onboarding.registration.provisioned",
  scope: "registration",
  run: async () => ({ provisioned: true }),
  audit: (_input, output) => output,
});

/** The shop's part of onboarding starts: setup, until the first sale. */
export const startOnboarding = defineCommand({
  name: "onboarding.start",
  async run(tx, context: CommandContext) {
    const row = await lockOnboarding(tx, context.orgId);
    return { status: row.status };
  },
  audit: (_input, output) => output,
});

/** Emails each owner the next nudge, unless the shop already sold or has had all three. */
export const nudgeOnboarding = defineCommand({
  name: "onboarding.nudge",
  async run(tx, context: CommandContext) {
    const row = await lockOnboarding(tx, context.orgId);
    if (row.firstSaleAt || row.nudges >= MAX_NUDGES) return { sent: false, nudges: row.nudges };
    const nudges = row.nudges + 1;
    await tx
      .update(onboarding)
      .set({ nudges, updatedAt: new Date() })
      .where(eq(onboarding.id, row.id));
    for (const owner of await orgOwners(tx, context.orgId))
      enqueueAfterCommit(tx, {
        id: v7(),
        orgId: context.orgId,
        v: 1,
        sequence: "0",
        type: "onboarding.nudge",
        payload: { userId: owner.id, nudge: nudges },
      });
    return { sent: true, nudges };
  },
  audit: (_input, output) => output,
});

/** The onboarding ends: trading, or a month with no sale. The row keeps its status either way. */
export const closeOnboarding = defineCommand({
  name: "onboarding.close",
  async run(tx, context: CommandContext) {
    const row = await lockOnboarding(tx, context.orgId);
    return { status: row.status, nudges: row.nudges };
  },
  audit: (_input, output) => output,
});
