import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { WorkflowTimeoutError, type Workflow, type WorkflowCheckpoint } from "@shopper/ports";
import { expireCase } from "../kyc/commands/expire";
import { issueOtp } from "../kyc/commands/otp";
import { DECISION_WINDOW_MS, otpCode, otpDigest } from "../kyc/otp";
import { caseDeadline, isOpen, KYC_RUN, readCaseRow } from "../kyc/records";
import { kycFlowAction, kycFlowParams } from "../schemas/workflows/kyc";
import type { KycFlowDeps } from "./types";
export type { KycFlowDeps } from "./types";
export { kycFlowParams, type KycFlowParams } from "../schemas/workflows/kyc";

const policy = { maxAttempts: 3, delayMs: 1000, backoff: "exponential" } as const;

/**
 * One identity check, from the code text to the decision. The case row is the record: an event only wakes the
 * workflow, which then reads where the case stands, so a lost event or timer is caught up at the next deadline.
 */
export async function runKyc(
  flow: Pick<Workflow, "instanceId" | "step" | "waitFor">,
  deps: KycFlowDeps,
  raw: unknown,
) {
  const params = v.parse(kycFlowParams, raw);
  if (params.id !== flow.instanceId)
    throw new Error("KYC workflow instance must equal its case id");
  const context = { orgId: params.orgId, appVersion: buildInfo.version };
  const now = () => new Date((deps.now ?? Date.now)());
  const checkpoint = (step: string, status: WorkflowCheckpoint["status"]): WorkflowCheckpoint => ({
    instanceId: params.id,
    businessKey: params.id,
    type: KYC_RUN,
    step,
    status,
  });
  const close = (step: string, force: boolean, status: WorkflowCheckpoint["status"]) =>
    deps.withDatabase((db) =>
      expireCase(db, context, { id: params.id, force, now: now() }, checkpoint(step, status)),
    );
  const sendCode = (send: number) =>
    flow.step(`otp-${send}`, policy, async () => {
      const code = await otpCode(deps.linkSecret, params.id, send);
      const digest = await otpDigest(deps.linkSecret, params.id, code);
      const issued = await deps.withDatabase((db) =>
        issueOtp(
          db,
          context,
          { id: params.id, send, digest, now: now() },
          checkpoint(`otp-${send}`, "waiting"),
        ),
      );
      if (!issued.sent) return { sent: false };
      const { phone } = await deps.withDatabase((db) => readCaseRow(db, params.orgId, params.id));
      await deps.sms.send(
        [phone],
        `Your Shopper verification code is ${code}. It expires in 10 minutes.`,
      );
      return { sent: true };
    });
  const wake = async (name: string, timeoutMs: number) => {
    try {
      return v.parse(kycFlowAction, await flow.waitFor(name, KYC_RUN, timeoutMs)).action;
    } catch (error) {
      if (error instanceof WorkflowTimeoutError) return "timeout" as const;
      throw error;
    }
  };

  try {
    await sendCode(1);
    let sends = 1;
    for (let tick = 0; ; tick++) {
      const state = await flow.step(`state-${tick}`, policy, () =>
        deps.withDatabase(async (db) => {
          const row = await readCaseRow(db, params.orgId, params.id);
          return { open: isOpen(row), deadline: caseDeadline(row)?.getTime() ?? null };
        }),
      );
      if (!state.open) break;
      const remaining = (state.deadline ?? now().getTime() + DECISION_WINDOW_MS) - now().getTime();
      const action = remaining > 0 ? await wake(`wait-${tick}`, remaining) : "timeout";
      if (action === "resend") await sendCode(++sends);
      else if (action === "timeout")
        await flow.step(`expire-${tick}`, policy, () => close(`expire-${tick}`, false, "waiting"));
    }
    await flow.step("close", policy, () => close("close", false, "completed"));
  } catch (error) {
    await close("failure", true, "failed");
    throw error;
  }
}
