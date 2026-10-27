import type { LucideIcon } from "lucide-react";
import type { PermissionCode } from "../../roles/permissions";
import {
  ChartNoAxesColumnIcon,
  ClockIcon,
  WarehouseIcon,
  GitBranchIcon,
  MonitorSmartphoneIcon,
  LandmarkIcon,
  PackageIcon,
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
  /** Shown only to members who hold this permission. */
  permission?: PermissionCode;
  /** Other pages of the same area: the link stays highlighted on them. */
  also?: readonly string[];
};

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/reports", label: "Reports", icon: ChartNoAxesColumnIcon, permission: "report.read" },
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
];
