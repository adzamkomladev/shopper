import type { ShopperDatabase } from "@shopper/db-pg";

export type { AuthPrincipal } from "./roles/service";

export interface CreateAuthOptions {
  database: ShopperDatabase;
  orgId: string;
  secret: string;
  baseURL: string;
  bootstrapToken?: string;
}
