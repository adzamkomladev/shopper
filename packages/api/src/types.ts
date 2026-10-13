import type {
  AuthPrincipal,
  createDeviceService,
  createOnboarding,
  createInvitations,
} from "@shopper/auth";
import type { ShopperDatabase } from "@shopper/db-pg";
import type { Sequencer, WorkflowLauncher } from "@shopper/ports";

export type ApiPrincipal = AuthPrincipal;
export interface ApiAuthentication {
  resolvePrincipal(request: Request): Promise<ApiPrincipal | null>;
  hasPermission(principal: ApiPrincipal, code: string): Promise<boolean>;
  handler?: (request: Request) => Promise<Response>;
}
export type ApiEnvironment = { Variables: { principal: ApiPrincipal } };

export interface ApiOptions {
  authentication?: ApiAuthentication;
  database?: ShopperDatabase;
  sequencer?: Sequencer;
  devices?: ReturnType<typeof createDeviceService>;
  // Populated by the authenticated session adapter; never derive this from request parameters.
  resolveOrgId?: (request: Request) => Promise<string | null>;
  priceChange?: WorkflowLauncher;
  onboarding?: ReturnType<typeof createOnboarding>;
  invitations?: ReturnType<typeof createInvitations>;
}
