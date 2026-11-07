import { onboardingParams, runOnboarding, type OnboardingFlowDeps } from "@shopper/core/onboarding";
import type { Launch } from "../types";
import { memoryLaunch } from "./launch";

// ponytail: the box opens no public signup, so it never starts one; this shell carries the shared function for
// conformance.
export function boxOnboardingFlows(deps: OnboardingFlowDeps, launch: Launch = memoryLaunch) {
  return launch("onboarding", onboardingParams, (flow, params) =>
    runOnboarding(flow, deps, params),
  );
}
