import * as v from "valibot";
import type { CommandContext } from "@shopper/audit";
import {
  kycDecisionInput,
  kycIdInput,
  kycListQuery,
  kycOpenInput,
  kycSettingsInput,
  kycVerifyInput,
} from "../schemas/kyc";
import { decideCase } from "./commands/decide";
import { expireCase } from "./commands/expire";
import { recordId, skipId } from "./commands/id";
import { openCase } from "./commands/open";
import { checkOtp } from "./commands/otp";
import { idDigest, maskId } from "./documents";
import { KycError } from "./error";
import { OTP_MAX_SENDS, otpDigest } from "./otp";
import { listKycCases, readKycCase, readKycSettings } from "./queries";
import { assertCasePermission, readCaseRow } from "./records";
import { setKycSettings } from "./settings";
import type { KycOptions, KycOutcome } from "./types";

const refusals = {
  wrong: ["OTP_INVALID", "That code is not right"],
  locked: ["OTP_LOCKED", "Too many wrong codes: ask for a new code"],
  expired: ["EXPIRED", "This KYC case has expired"],
} as const;

/** The KYC use cases the API serves: each runs its command, then wakes the case's workflow. */
export function createKyc(options: KycOptions) {
  const { database } = options;
  const live = () => {
    if (!options.launcher || !options.linkSecret)
      throw new KycError("UNAVAILABLE", "KYC is not available on this host");
    return { launcher: options.launcher, secret: options.linkSecret };
  };
  // The workflow reads the case row on every wake-up, so a lost wake-up is caught up at the next deadline.
  const wake = async (orgId: string, id: string, action: string) => {
    try {
      await live().launcher.send(id, "kyc", { action });
    } catch (error) {
      console.error({ event: "kyc.wake_failed", orgId, id, action, error });
    }
  };
  const settle = (outcome: KycOutcome) => {
    if (outcome === "ok") return;
    const [code, message] = refusals[outcome];
    throw new KycError(code, message);
  };
  const view = (context: CommandContext, id: string) => readKycCase(database, context.orgId, id);

  return {
    async open(context: CommandContext, raw: unknown) {
      const { launcher } = live();
      const input = v.parse(kycOpenInput, raw);
      const { id } = await openCase(database, context, input);
      try {
        await launcher.start(id, { orgId: context.orgId, id });
      } catch (error) {
        // A case nobody is driving would block its subject's next one.
        await expireCase(database, context, { id, force: true, now: new Date() });
        throw error;
      }
      return view(context, id);
    },
    async resend(context: CommandContext, id: string) {
      live();
      const row = await database.transaction(async (tx) => {
        const found = await readCaseRow(tx, context.orgId, id);
        await assertCasePermission(tx, context, found);
        return found;
      });
      if (row.status !== "otp_sent")
        throw new KycError("WRONG_STEP", "The phone is already verified");
      if (row.otpSends >= OTP_MAX_SENDS)
        throw new KycError("RESEND_LIMIT", "No more codes can be sent for this case");
      if (row.otpExpiresAt && row.otpExpiresAt <= new Date())
        throw new KycError("EXPIRED", "This KYC case has expired");
      await wake(context.orgId, id, "resend");
      return view(context, id);
    },
    async verify(context: CommandContext, id: string, raw: unknown) {
      const { secret } = live();
      const { code } = v.parse(kycVerifyInput, raw);
      const digest = await otpDigest(secret, id, code);
      settle((await checkOtp(database, context, { id, digest, now: new Date() })).outcome);
      await wake(context.orgId, id, "verified");
      return view(context, id);
    },
    async recordId(context: CommandContext, id: string, raw: unknown) {
      const { secret } = live();
      const input = v.parse(kycIdInput, raw);
      // The number stops here: the command, the audit and the workflow only ever see its mask and fingerprint.
      const recorded = await recordId(database, context, {
        id,
        idType: input.idType,
        fingerprint: await idDigest(secret, input.idType, input.idNumber),
        masked: maskId(input.idType, input.idNumber),
        fullName: input.fullName,
        now: new Date(),
      });
      settle(recorded.outcome);
      await wake(context.orgId, id, "id");
      return view(context, id);
    },
    async skipId(context: CommandContext, id: string) {
      live();
      settle((await skipId(database, context, { id, now: new Date() })).outcome);
      await wake(context.orgId, id, "id");
      return view(context, id);
    },
    async decide(context: CommandContext, id: string, raw: unknown) {
      live();
      const input = v.parse(kycDecisionInput, raw);
      settle((await decideCase(database, context, { ...input, id, now: new Date() })).outcome);
      await wake(context.orgId, id, "decided");
      return view(context, id);
    },
    read: (context: CommandContext, id: string) => view(context, id),
    list: (context: CommandContext, query: unknown) =>
      listKycCases(database, context.orgId, v.parse(kycListQuery, query)),
    settings: (context: CommandContext) => readKycSettings(database, context.orgId),
    async setSettings(context: CommandContext, raw: unknown) {
      await setKycSettings(database, context, v.parse(kycSettingsInput, raw));
      return readKycSettings(database, context.orgId);
    },
  };
}
