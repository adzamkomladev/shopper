import { type ShopperDatabase } from "@shopper/db-pg";
import type { createMaileroo } from "../emails/maileroo";

export interface AuthFlowDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  linkSecret: string;
  baseURL: string;
  mail?: ReturnType<typeof createMaileroo>;
  now?: () => number;
}
