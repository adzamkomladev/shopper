export interface AuthPrincipal {
  orgId: string;
  userId: string;
  roleId: string;
  roleName: string;
  deviceId?: string;
  branchId?: string;
}
