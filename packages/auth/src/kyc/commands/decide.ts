import { and, eq } from "drizzle-orm";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { setCreditLimit } from "@shopper/core/customers";
import { kycCase } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { kycDecisionInput } from "../../schemas/kyc";
import { assertHasPermission } from "../../roles/service";
import { grantMemberRole } from "../../users";
import { KycError } from "../error";
import { lapse, readCaseRow } from "../records";
import type { KycOutcome } from "../types";

/**
 * Approves or rejects a case in review. Approval does the thing asked for in the same transaction: it sets the
 * customer's limit and verification date, or gives the member the role. An ID on the case must have been sighted.
 */
export const decideCase = defineCommand({
  name: "kyc.decide",
  async run(
    tx,
    context,
    input: { id: string; now: Date } & v.InferOutput<typeof kycDecisionInput>,
  ) {
    await assertHasPermission(tx, context, "kyc.approve");
    const row = await readCaseRow(tx, context.orgId, input.id, true);
    if (row.status === "expired") throw new KycError("EXPIRED", "This KYC case has expired");
    if (row.status !== "review")
      throw new KycError("WRONG_STEP", "The case is not waiting for a decision");
    if (await lapse(tx, row, input.now))
      return {
        id: row.id,
        outcome: "expired" as KycOutcome,
        status: "expired" as const,
        approvedLimit: null,
        approvedRoleId: null,
        idSighted: false,
      };
    const idSighted = input.idSighted === true;
    let approvedLimit: number | null = null;
    let approvedRoleId: string | null = null;
    if (input.approve) {
      if (row.idType && !idSighted)
        throw new KycError("ID_NOT_SIGHTED", "Confirm that the ID document was sighted");
      // kyc_case_request: a credit case always has a customer and a role case a member and a role.
      if (row.purpose === "credit") {
        if (!input.limit) throw new KycError("LIMIT_REQUIRED", "Approving credit needs a limit");
        await setCreditLimit(tx, context.orgId, row.customerId!, money(input.limit), input.now);
        approvedLimit = input.limit;
      } else {
        approvedRoleId = input.roleId ?? row.requestedRoleId!;
        await grantMemberRole(tx, context, { userId: row.memberId!, roleId: approvedRoleId });
      }
    }
    const status = input.approve ? ("approved" as const) : ("rejected" as const);
    await tx
      .update(kycCase)
      .set({
        status,
        decidedBy: context.actorId,
        decidedAt: input.now,
        decisionNote: input.note,
        idSighted,
        approvedLimit: approvedLimit === null ? null : money(approvedLimit),
        approvedRoleId,
        updatedAt: input.now,
      })
      .where(and(eq(kycCase.orgId, context.orgId), eq(kycCase.id, row.id)));
    return {
      id: row.id,
      outcome: "ok" as KycOutcome,
      status,
      approvedLimit,
      approvedRoleId,
      idSighted,
    };
  },
  audit: (input, output) => ({
    id: output.id,
    outcome: output.outcome,
    status: output.status,
    approvedLimit: output.approvedLimit,
    approvedRoleId: output.approvedRoleId,
    idSighted: output.idSighted,
    note: input.note,
  }),
  details: (_input, output) => ({ entity: "kyc_case", entityId: output.id }),
});
