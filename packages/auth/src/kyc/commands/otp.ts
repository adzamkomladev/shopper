import { and, eq } from "drizzle-orm";
import { defineCommand } from "@shopper/audit";
import { kycCase } from "@shopper/db-pg";
import { constantTimeEqual } from "../../session/http";
import { KycError } from "../error";
import { OTP_MAX_ATTEMPTS, OTP_MAX_SENDS, OTP_TTL_MS } from "../otp";
import { assertCasePermission, decisionDue, lapse, readCaseRow } from "../records";
import type { KycOutcome } from "../types";

const entity = (id: string) => ({ entity: "kyc_case", entityId: id });

/**
 * Stores the digest of a code the workflow is about to text, as the case's `send`th. Anything but the next send of a case
 * still waiting for its code is a stale or repeated call and sends nothing.
 */
export const issueOtp = defineCommand({
  name: "kyc.otp.issue",
  async run(tx, context, input: { id: string; send: number; digest: string; now: Date }) {
    const row = await readCaseRow(tx, context.orgId, input.id, true);
    if (
      row.status !== "otp_sent" ||
      row.otpSends >= OTP_MAX_SENDS ||
      row.otpSends + 1 !== input.send
    )
      return { id: row.id, send: input.send, sent: false };
    await tx
      .update(kycCase)
      .set({
        otpDigest: input.digest,
        otpExpiresAt: new Date(input.now.getTime() + OTP_TTL_MS),
        otpSends: input.send,
        otpAttempts: 0,
        updatedAt: input.now,
      })
      .where(and(eq(kycCase.orgId, context.orgId), eq(kycCase.id, row.id)));
    return { id: row.id, send: input.send, sent: true };
  },
  audit: (_input, output) => ({ id: output.id, send: output.send, sent: output.sent }),
  details: (_input, output) => entity(output.id),
});

/** Checks the code a person typed. A wrong code is counted and a fifth locks the case, so none of that may roll back. */
export const checkOtp = defineCommand({
  name: "kyc.otp.check",
  async run(tx, context, input: { id: string; digest: string; now: Date }) {
    const row = await readCaseRow(tx, context.orgId, input.id, true);
    await assertCasePermission(tx, context, row);
    if (row.status === "expired") throw new KycError("EXPIRED", "This KYC case has expired");
    if (row.status !== "otp_sent")
      throw new KycError("WRONG_STEP", "The phone is already verified for this case");
    if (await lapse(tx, row, input.now)) return result(row.id, "expired", row.otpAttempts);
    if (!row.otpDigest) throw new KycError("OTP_PENDING", "The code has not been sent yet");
    if (row.otpAttempts >= OTP_MAX_ATTEMPTS) return result(row.id, "locked", row.otpAttempts);
    if (!constantTimeEqual(row.otpDigest, input.digest)) {
      await tx
        .update(kycCase)
        .set({ otpAttempts: row.otpAttempts + 1, updatedAt: input.now })
        .where(and(eq(kycCase.orgId, context.orgId), eq(kycCase.id, row.id)));
      return result(row.id, "wrong", row.otpAttempts + 1);
    }
    await tx
      .update(kycCase)
      .set({
        status: "id_needed",
        otpDigest: null,
        decisionDueAt: decisionDue(input.now),
        updatedAt: input.now,
      })
      .where(and(eq(kycCase.orgId, context.orgId), eq(kycCase.id, row.id)));
    return result(row.id, "ok", row.otpAttempts);
  },
  audit: (_input, output) => ({
    id: output.id,
    outcome: output.outcome,
    attempts: output.attempts,
  }),
  details: (_input, output) => entity(output.id),
});

const result = (id: string, outcome: KycOutcome, attempts: number) => ({ id, outcome, attempts });
