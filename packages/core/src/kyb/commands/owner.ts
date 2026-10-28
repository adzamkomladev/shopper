import * as v from "valibot";
import { eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { kybCase } from "@shopper/db-pg";
import { ManagementError } from "../../management";
import { earliestExpiry } from "../checks";
import { enqueueKybNotice, lockKyb } from "../records";
import { kybDraft, kybSubmission } from "../schemas/base";

/** While Shopper holds a submission, the owner cannot change what is being checked. */
const HELD = ["submitted", "in_review"];

/** Saves any part of the case. Editing a decided case reopens it as a draft; payouts keep their subaccount. */
export const saveKyb = defineCommand({
  name: "kyb.save",
  async run(tx, context: CommandContext, input: { body: unknown }) {
    const data = v.parse(kybDraft, input.body);
    const row = await lockKyb(tx, context.orgId);
    if (HELD.includes(row.status))
      throw new ManagementError(
        "Shopper is reviewing this submission. Wait for the decision.",
        409,
      );
    // Charges already pay out to the subaccount Paystack made for these details.
    if (
      row.subaccountCode &&
      ((data.settlementBank !== undefined && data.settlementBank !== row.settlementBank) ||
        (data.settlementAccount !== undefined && data.settlementAccount !== row.settlementAccount))
    )
      throw new ManagementError(
        "Payouts already go to this account. Contact Shopper support to change it.",
        409,
      );
    await tx
      .update(kybCase)
      .set({ ...data, status: "draft", checks: [], decidedAt: null, updatedAt: new Date() })
      .where(eq(kybCase.id, row.id));
    return { id: row.id, fields: Object.keys(data) };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({
    entity: "kyb_case",
    entityId: output.id,
    after: { fields: output.fields },
  }),
});

/** Sends the whole case for checks and review, as the next version. */
export const submitKyb = defineCommand({
  name: "kyb.submit",
  async run(tx, context: CommandContext) {
    const row = await lockKyb(tx, context.orgId);
    if (HELD.includes(row.status) || row.status === "approved")
      throw new ManagementError("This verification is already with Shopper.", 409);
    const parsed = v.safeParse(kybSubmission, row);
    if (!parsed.success)
      throw new ManagementError(
        `Finish the form first: ${[...new Set(parsed.issues.map((issue) => v.getDotPath(issue)?.split(".")[0]))].join(", ")}`,
        400,
      );
    const version = row.version + 1;
    await tx
      .update(kybCase)
      .set({
        status: "submitted",
        version,
        submittedAt: new Date(),
        expiresOn: earliestExpiry(parsed.output),
        checks: [],
        reviewerId: null,
        decisionNote: null,
        decidedAt: null,
        renewalSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(kybCase.id, row.id));
    enqueueKybNotice(tx, context.orgId, "submitted");
    return { id: row.id, version };
  },
  audit: (_input, output) => output,
  details: (_input, output) => ({
    entity: "kyb_case",
    entityId: output.id,
    after: { version: output.version },
  }),
});
