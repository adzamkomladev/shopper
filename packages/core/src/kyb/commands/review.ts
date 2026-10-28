import * as v from "valibot";
import { eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { kybCase, type KybCheck } from "@shopper/db-pg";
import { ManagementError } from "../../management";
import { enqueueKybNotice, lockKyb } from "../records";
import { kybDecision } from "../schemas/base";

/** Records one submission's automated checks: all passed goes to a reviewer, any failure back to the owner. */
export const recordKybChecks = defineCommand({
  name: "kyb.checks",
  async run(tx, context: CommandContext, input: { version: number; checks: KybCheck[] }) {
    const row = await lockKyb(tx, context.orgId);
    // A resubmission since the checks began makes them stale; its own run checks it.
    if (row.status !== "submitted" || row.version !== input.version)
      return { applied: false, status: row.status };
    const status = input.checks.every((check) => check.ok) ? "in_review" : "checks_failed";
    await tx
      .update(kybCase)
      .set({ status, checks: input.checks, updatedAt: new Date() })
      .where(eq(kybCase.id, row.id));
    if (status === "checks_failed") enqueueKybNotice(tx, context.orgId, "checks_failed");
    return { applied: true, status };
  },
  audit: (input, output) => ({ version: input.version, ...output }),
});

/**
 * A Shopper reviewer's decision, audited in the shop's own chain. The reviewer belongs to the platform org, so they
 * are named in the payload rather than as the chain's actor. Only the version under review can be decided, once: a
 * second decision, or one on an older submission, is refused.
 */
export const decideKyb = defineCommand({
  name: "kyb.decide",
  async run(tx, context: CommandContext, raw: unknown) {
    const input = v.parse(kybDecision, raw);
    const row = await lockKyb(tx, context.orgId);
    if (row.status !== "in_review" || row.version !== input.version)
      throw new ManagementError("This submission was already decided or has changed.", 409);
    if (input.decision === "rejected" && !input.note)
      throw new ManagementError("Tell the owner why the submission was not approved.", 400);
    await tx
      .update(kybCase)
      .set({
        status: input.decision,
        reviewerId: input.reviewerId,
        decisionNote: input.note ?? null,
        decidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(kybCase.id, row.id));
    enqueueKybNotice(tx, context.orgId, input.decision);
    return {
      id: row.id,
      version: input.version,
      decision: input.decision,
      reviewerId: input.reviewerId,
    };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({ entity: "kyb_case", entityId: output.id, after: output }),
});
