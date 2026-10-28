import type { LucideIcon } from "lucide-react";
import type { PermissionNeed } from "../../roles/permissions";
import {
  ChartNoAxesColumnIcon,
  ClockIcon,
  CreditCardIcon,
  WarehouseIcon,
  GitBranchIcon,
  InboxIcon,
  MonitorSmartphoneIcon,
  LandmarkIcon,
  PackageIcon,
  ScaleIcon,
  ReceiptTextIcon,
  ScanBarcodeIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  StoreIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to members who hold this permission, or any one of these. */
  permission?: PermissionNeed;
  /** Other pages of the same area: the link stays highlighted on them. */
  also?: readonly string[];
  /** An account page: listed in the user menu and the palette, not the bar. */
  account?: true;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/reports", label: "Reports", icon: ChartNoAxesColumnIcon, permission: "report.read" },
  {
    to: "/transactions",
    label: "Transactions",
    icon: ReceiptTextIcon,
    permission: "report.read",
  },
  {
    to: "/payments/reconciliation",
    label: "Payments",
    icon: ScaleIcon,
    permission: "report.read",
    also: ["/payments/settings", "/payments/verification"],
  },
  {
    to: "/approvals",
    label: "Approvals",
    icon: InboxIcon,
    permission: ["refund.approve", "sale.discount"],
  },
  { to: "/products", label: "Products", icon: PackageIcon },
  {
    to: "/stock",
    label: "Inventory",
    icon: WarehouseIcon,
    permission: "stock.read",
    also: ["/suppliers"],
  },
  {
    to: "/customers",
    label: "Customers",
    icon: UserRoundIcon,
    permission: "customer.read",
    also: ["/kyc", "/settings"],
  },
  { to: "/tax", label: "Tax", icon: LandmarkIcon, permission: "tax.read" },
  { to: "/barcodes", label: "Barcodes", icon: ScanBarcodeIcon, permission: "product.read" },
  { to: "/imports", label: "Import", icon: UploadIcon },
  { to: "/stores", label: "Stores", icon: StoreIcon, permission: "store.read" },
  { to: "/branches", label: "Branches", icon: GitBranchIcon, permission: "branch.read" },
  { to: "/users", label: "Users", icon: UsersIcon, permission: "user.read" },
  { to: "/roles", label: "Roles", icon: ShieldCheckIcon, permission: "role.read" },
  { to: "/devices", label: "Devices", icon: MonitorSmartphoneIcon, permission: "device.read" },
  { to: "/shifts", label: "Shifts", icon: ClockIcon, permission: "shift.read" },
  { to: "/audit", label: "Audit", icon: ScrollTextIcon, permission: "audit.read" },
  {
    to: "/billing",
    label: "Billing",
    icon: CreditCardIcon,
    permission: "billing.manage",
    account: true,
  },
];
