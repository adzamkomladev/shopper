export interface AuthPrincipal {
  orgId: string;
  userId: string;
  roleId: string;
  roleName: string;
  deviceId?: string;
  branchId?: string;
  /** A back-office member's branches; null when they work at every branch. Unset for a till session. */
  branchIds?: string[] | null;
}
