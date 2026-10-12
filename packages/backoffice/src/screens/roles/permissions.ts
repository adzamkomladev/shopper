import type * as v from "valibot";
import type { permissionCode } from "@shopper/auth/schemas";

export type PermissionCode = v.InferOutput<typeof permissionCode>;

/** What each permission lets a member do, in the words an owner would use. */
export const PERMISSION_LABELS: Record<PermissionCode, string> = {
  "sale.create": "Ring up sales",
  "refund.request": "Request refunds",
  "refund.approve": "Approve refunds",
  "shift.read": "View shifts",
  "shift.write": "Open and close shifts",
  "stock.read": "View stock",
  "stock.write": "Change stock",
  "product.read": "View products",
  "product.write": "Change products",
  "product.propose": "Propose product changes",
  "tax.read": "View tax rules",
  "tax.write": "Change tax rules",
  "report.read": "View reports",
  "audit.read": "View audit log",
  "user.read": "View users",
  "user.write": "Invite and manage users",
  "role.read": "View roles",
  "role.write": "Change roles",
  "store.read": "View stores",
  "store.write": "Change stores",
  "branch.read": "View branches",
  "branch.write": "Change branches",
  "device.read": "View devices",
  "device.enroll": "Enrol devices",
  "device.revoke": "Revoke devices",
  "cashier.pin.assign": "Set cashier PINs",
};

/** The matrix reads top to bottom in these groups. */
export const PERMISSION_GROUPS: readonly { name: string; codes: readonly PermissionCode[] }[] = [
  { name: "Sales", codes: ["sale.create", "refund.request", "refund.approve"] },
  { name: "Shifts", codes: ["shift.read", "shift.write"] },
  {
    name: "Products and stock",
    codes: ["product.read", "product.write", "product.propose", "stock.read", "stock.write"],
  },
  { name: "Tax, reports and audit", codes: ["tax.read", "tax.write", "report.read", "audit.read"] },
  { name: "People", codes: ["user.read", "user.write", "role.read", "role.write"] },
  {
    name: "Stores and branches",
    codes: ["store.read", "store.write", "branch.read", "branch.write"],
  },
  {
    name: "Devices",
    codes: ["device.read", "device.enroll", "device.revoke", "cashier.pin.assign"],
  },
];
