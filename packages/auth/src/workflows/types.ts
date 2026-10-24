import { type ShopperDatabase } from "@shopper/db-pg";
import type { createArkesel } from "@shopper/core/sms/arkesel";
import type { createMaileroo } from "../emails/maileroo";

export interface AuthFlowDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  linkSecret: string;
  baseURL: string;
  mail?: ReturnType<typeof createMaileroo>;
  now?: () => number;
}

export interface KycFlowDeps {
  withDatabase<T>(run: (db: ShopperDatabase) => Promise<T>): Promise<T>;
  sms: Pick<ReturnType<typeof createArkesel>, "send">;
  linkSecret: string;
  now?: () => number;
}
