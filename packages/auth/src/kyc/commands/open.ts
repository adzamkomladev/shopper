import { and, eq, inArray, isNull } from "drizzle-orm";
import { v7 } from "uuid";
import * as v from "valibot";
import { defineCommand } from "@shopper/audit";
import { CustomerError, readCustomerRow } from "@shopper/core/customers";
import { kycCase, role, user, workflowRun } from "@shopper/db-pg";
import { money } from "@shopper/money";
import { kycOpenInput } from "../../schemas/kyc";
import { AdministrationError } from "../../roles/service";
import { KycError } from "../error";
import { assertCasePermission, KYC_RUN, openStatuses } from "../records";

/** Opens an identity check for a customer's credit or a member's role, and its workflow run. The workflow is launched by the caller. */
export const openCase = defineCommand({
  name: "kyc.case.open",
  async run(tx, context, input: v.InferOutput<typeof kycOpenInput>) {
    if (!context.actorId) throw new AdministrationError("An authenticated actor is required", 401);
    await assertCasePermission(tx, context, input);
    const credit = input.purpose === "credit";
    let phone: string;
    if (credit) {
      const customer = await readCustomerRow(tx, context.orgId, input.subject.customerId, true);
      if (customer.archivedAt) throw new CustomerError("ARCHIVED", "The customer is archived");
      phone = input.phone ?? customer.phone;
    } else {
      const [member] = await tx
        .select({ id: user.id })
        .from(user)
        .where(and(eq(user.orgId, context.orgId), eq(user.id, input.subject.userId)));
      const [requested] = await tx
        .select({ id: role.id })
        .from(role)
        .where(
          and(
            eq(role.orgId, context.orgId),
            eq(role.id, input.requestedRoleId),
            isNull(role.archivedAt),
          ),
        );
      if (!member || !requested) throw new KycError("NOT_FOUND", "Member or role not found");
      phone = input.phone;
    }
    const [open] = await tx
      .select({ id: kycCase.id })
      .from(kycCase)
      .where(
        and(
          eq(kycCase.orgId, context.orgId),
          inArray(kycCase.status, [...openStatuses]),
          credit
            ? eq(kycCase.customerId, input.subject.customerId)
            : eq(kycCase.memberId, input.subject.userId),
        ),
      );
    if (open) throw new KycError("CASE_OPEN", "This subject already has an open KYC case");
    const id = v7();
    await tx.insert(kycCase).values({
      id,
      orgId: context.orgId,
      customerId: credit ? input.subject.customerId : undefined,
      memberId: credit ? undefined : input.subject.userId,
      purpose: input.purpose,
      requestedLimit: credit ? money(input.requestedLimit) : undefined,
      requestedRoleId: credit ? undefined : input.requestedRoleId,
      phone,
      openedBy: context.actorId,
    });
    await tx.insert(workflowRun).values({
      orgId: context.orgId,
      instanceId: id,
      businessKey: id,
      type: KYC_RUN,
      currentStep: "opened",
      status: "waiting",
    });
    return { id, purpose: input.purpose };
  },
  audit: (input, output) => ({
    id: output.id,
    purpose: output.purpose,
    subject: input.subject,
    ...(input.purpose === "credit"
      ? { requestedLimit: input.requestedLimit }
      : { requestedRoleId: input.requestedRoleId }),
  }),
  details: (_input, output) => ({ entity: "kyc_case", entityId: output.id }),
});
