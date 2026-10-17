import type { AuthPrincipal } from "../roles/service";

export type DevicePrincipal = AuthPrincipal;

export type Rejected = {
  error: string;
  status: 401 | 429;
  attempts?: number;
  lockedUntil?: string | null;
};
export type Identity = { userId: string; name: string; roleId: string; roleName: string };
