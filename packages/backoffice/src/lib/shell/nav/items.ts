import type { LucideIcon } from "lucide-react";
import type { PermissionCode } from "../../roles/permissions";
import {
  GitBranchIcon,
  MonitorSmartphoneIcon,
  PackageIcon,
  ShieldCheckIcon,
  StoreIcon,
  UploadIcon,
  UsersIcon,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Shown only to members who hold this permission. */
  permission?: PermissionCode;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/products", label: "Products", icon: PackageIcon },
  { to: "/imports", label: "Import", icon: UploadIcon },
  { to: "/stores", label: "Stores", icon: StoreIcon, permission: "store.read" },
  { to: "/branches", label: "Branches", icon: GitBranchIcon, permission: "branch.read" },
  { to: "/users", label: "Users", icon: UsersIcon, permission: "user.read" },
  { to: "/roles", label: "Roles", icon: ShieldCheckIcon, permission: "role.read" },
  { to: "/devices", label: "Devices", icon: MonitorSmartphoneIcon, permission: "device.read" },
];
