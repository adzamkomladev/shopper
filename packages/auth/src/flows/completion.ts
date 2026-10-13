import { defineCommand } from "@shopper/audit";
import { buildInfo } from "@shopper/config";
import type { OnboardingOptions } from "../onboarding/service";
import type { AuthFlowParams } from "./workflow";

export async function signalAuthCompletion(options: OnboardingOptions, params: AuthFlowParams) {
  let notified = true;
  try {
    await options.launcher.send(params.id, "auth-action", { action: "completed" });
  } catch {
    notified = false;
  } // The business mutation committed; record the unavailable transport without reporting a false failure.
  const command = params.purpose === "registration" ? registrationSignal : invitationSignal;
  await command(
    options.database,
    {
      orgId: params.purpose === "registration" ? params.id : params.orgId,
      appVersion: buildInfo.version,
    },
    { id: params.id, notified },
    {
      instanceId: params.id,
      businessKey: params.id,
      type: params.purpose,
      step: "completion-signal",
      status: "completed",
    },
  );
}
const registrationSignal = defineCommand({
  name: "auth.registration.signal",
  scope: "registration",
  run: async (_tx, _context, input: { id: string; notified: boolean }) => input,
  audit: (_input, output) => output,
});
const invitationSignal = defineCommand({
  name: "auth.invitation.signal",
  run: async (_tx, _context, input: { id: string; notified: boolean }) => input,
  audit: (_input, output) => output,
});
