import { defineCommand, type CommandContext } from "@shopper/audit";

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
