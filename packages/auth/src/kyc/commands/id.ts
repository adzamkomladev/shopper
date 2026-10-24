import { and, eq } from "drizzle-orm";
import { defineCommand, type CommandContext } from "@shopper/audit";
import { kycCase, org, type ShopperTransaction } from "@shopper/db-pg";
import { KycError } from "../error";
import { assertCasePermission, decisionDue, lapse, readCaseRow } from "../records";
import type { KycIdType, KycOutcome } from "../types";

const entity = (id: string) => ({ entity: "kyc_case", entityId: id });

/**
 * Stores an ID the approver will check by hand: only its mask and fingerprint are kept, never the number, which
 * the caller reduces before this command runs. The case moves on to review.
 */
export const recordId = defineCommand({
  name: "kyc.id.record",
  async run(
    tx,
    context,
    input: {
      id: string;
      idType: KycIdType;
      fingerprint: string;
      masked: string;
      fullName: string;
      now: Date;
    },
  ): Promise<{ id: string; outcome: KycOutcome; idType: KycIdType }> {
    const row = await idStep(tx, context, input.id, input.now);
    if (row.outcome === "expired")
      return { id: input.id, outcome: row.outcome, idType: input.idType };
    if (!row.settings.kycIdTypes.includes(input.idType))
      throw new KycError("ID_NOT_ACCEPTED", "This organization does not accept that ID type");
    await tx
      .update(kycCase)
      .set({
        status: "review",
        idType: input.idType,
        idFingerprint: input.fingerprint,
        idMasked: input.masked,
        fullName: input.fullName,
        decisionDueAt: decisionDue(input.now),
        updatedAt: input.now,
      })
      .where(and(eq(kycCase.orgId, context.orgId), eq(kycCase.id, input.id)));
    return { id: input.id, outcome: "ok", idType: input.idType };
  },
  audit: (input, output) => ({
    id: output.id,
    outcome: output.outcome,
    idType: output.idType,
    masked: input.masked,
  }),
  details: (_input, output) => entity(output.id),
});

/** Moves on without an ID, unless the organization requires one. */
export const skipId = defineCommand({
  name: "kyc.id.skip",
  async run(
    tx,
    context,
    input: { id: string; now: Date },
  ): Promise<{ id: string; outcome: KycOutcome }> {
    const row = await idStep(tx, context, input.id, input.now);
    if (row.outcome === "expired") return { id: input.id, outcome: row.outcome };
    if (row.settings.kycIdRequired)
      throw new KycError("ID_REQUIRED", "This organization requires an ID document");
    await tx
      .update(kycCase)
      .set({ status: "review", decisionDueAt: decisionDue(input.now), updatedAt: input.now })
      .where(and(eq(kycCase.orgId, context.orgId), eq(kycCase.id, input.id)));
    return { id: input.id, outcome: "ok" };
  },
  audit: (_input, output) => ({ id: output.id, outcome: output.outcome }),
  details: (_input, output) => entity(output.id),
});

/** The case in the ID step with the org's ID settings, or the news that its window closed. */
async function idStep(tx: ShopperTransaction, context: CommandContext, id: string, now: Date) {
  const row = await readCaseRow(tx, context.orgId, id, true);
  await assertCasePermission(tx, context, row);
  if (row.status === "expired") throw new KycError("EXPIRED", "This KYC case has expired");
  if (row.status !== "id_needed")
    throw new KycError("WRONG_STEP", "The case is not waiting for an ID");
  const [settings] = await tx
    .select({ kycIdRequired: org.kycIdRequired, kycIdTypes: org.kycIdTypes })
    .from(org)
    .where(eq(org.id, context.orgId));
  const outcome: KycOutcome = (await lapse(tx, row, now)) ? "expired" : "ok";
  // Every tenant has its org row; the command lock and the case row prove this one is reachable.
  return { outcome, settings: settings! };
}
