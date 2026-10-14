import { type ShopperDatabase } from "@shopper/db-pg";
import type { WorkflowLauncher } from "@shopper/ports";

export interface OnboardingOptions {
  database: ShopperDatabase;
  linkSecret: string;
  baseURL: string;
  launcher: WorkflowLauncher;
  now?: () => number;
}
