import { eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { org, type updateChannels } from "@shopper/db-pg";
import { ManagementError } from "../management";

/**
 * The platform's own record of a KYB decision, in the platform org's chain with the reviewer as actor. The shop's
 * chain records the same decision through `kyb.decide`, naming the reviewer in its payload.
 */
export const recordPlatformDecision = defineCommand({
  name: "platform.kyb.decide",
  run: async (
    _tx,
    _context: CommandContext,
    input: { orgId: string; version: number; decision: string },
  ) => input,
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "org", entityId: output.orgId, after: output }),
});

/**
 * Moves a shop's registers to another till release feed. The platform org's chain records it (context is the
 * admin's), naming the shop and the channel before and after.
 */
export const setTenantChannel = defineCommand({
  name: "platform.tenant.channel",
  async run(
    tx,
    _context: CommandContext,
    input: { orgId: string; channel: (typeof updateChannels)[number] },
  ) {
    const [before] = await tx
      .select({ channel: org.updateChannel })
      .from(org)
      .where(eq(org.id, input.orgId))
      .for("update");
    if (!before) throw new ManagementError("No such shop", 404);
    await tx
      .update(org)
      .set({ updateChannel: input.channel, updatedAt: new Date() })
      .where(eq(org.id, input.orgId));
    return { orgId: input.orgId, before: before.channel, after: input.channel };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "org", entityId: output.orgId }),
});
