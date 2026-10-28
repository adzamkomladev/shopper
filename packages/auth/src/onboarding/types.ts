import { type ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";

export interface OnboardingOptions {
  database: ShopperDatabase;
  linkSecret: string;
  baseURL: string;
  launcher: WorkflowLauncher;
  /** The shop's onboarding: started at signup, woken by verification and completion. */
  onboarding?: WorkflowLauncher;
  now?: () => number;
}
