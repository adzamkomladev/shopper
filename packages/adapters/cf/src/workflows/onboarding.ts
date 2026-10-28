import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import { buildInfo } from "@shopper/config";
import { runOnboarding } from "@shopper/core/onboarding";
import { NOTIFICATION_RETRY, type Json } from "@shopper/ports";
import { hyperdriveDatabase } from "../database";
import { cloudflareLauncher } from "../launcher";
import { cloudflareQueue } from "../queue";
import { cloudflareFlow } from "./flow";

interface OnboardingEnvironment {
  HYPERDRIVE: Hyperdrive;
  NOTIFICATIONS?: Parameters<typeof cloudflareQueue>[0];
  AUTH_FLOWS?: Parameters<typeof cloudflareLauncher>[0];
}

/** Cloudflare shell for one shop's onboarding, from signup to its first sale (instance id = `onboarding-<org>`). */
export class OnboardingWorkflow extends WorkflowEntrypoint<OnboardingEnvironment, Json> {
  async run(event: WorkflowEvent<Json>, step: WorkflowStep) {
    await runOnboarding(
      cloudflareFlow(event, step),
      {
        withDatabase: hyperdriveDatabase(this.env.HYPERDRIVE),
        appVersion: buildInfo.version,
        queue: this.env.NOTIFICATIONS
          ? cloudflareQueue(this.env.NOTIFICATIONS, NOTIFICATION_RETRY)
          : undefined,
        authFlows: this.env.AUTH_FLOWS ? cloudflareLauncher(this.env.AUTH_FLOWS) : undefined,
      },
      event.payload,
    );
  }
}
