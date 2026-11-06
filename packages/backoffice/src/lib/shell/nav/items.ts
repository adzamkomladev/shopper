import type { LucideIcon } from "lucide-react";
import type { PermissionNeed } from "../../roles/permissions";
import {
  BadgeCheckIcon,
  BookOpenIcon,
  Building2Icon,
  ChartNoAxesColumnIcon,
  ClockIcon,
  CreditCardIcon,
  GiftIcon,
  GitBranchIcon,
  InboxIcon,
  LandmarkIcon,
  MonitorSmartphoneIcon,
  PackageIcon,
  ReceiptTextIcon,
  ScaleIcon,
  ScanBarcodeIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  StoreIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon,
  WarehouseIcon,
} from "lucide-react";

/**
 * The sidebar's sections in order. A section of one page shows as that page; a larger one is a
 * collapsible parent. `group` is the labelled block it sits in.
 */
export const NAV_SECTIONS = [
  { name: "Reports", group: "Overview", icon: ChartNoAxesColumnIcon },
  { name: "General ledger", group: "Overview", icon: BookOpenIcon },
  { name: "Sales", group: "Manage", icon: ShoppingCartIcon },
  { name: "Catalogue", group: "Manage", icon: PackageIcon },
  { name: "Inventory", group: "Manage", icon: WarehouseIcon },
  { name: "Customers", group: "Manage", icon: UserRoundIcon },
  { name: "Organisation", group: "Manage", icon: Building2Icon },
  { name: "Audit", group: "Manage", icon: ScrollTextIcon },
] as const;

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  section: (typeof NAV_SECTIONS)[number]["name"];
  /** Shown only to members who hold this permission, or any one of these. */
  permission?: PermissionNeed;
  /** Other pages of the same area: the link stays highlighted on them. */
  also?: readonly string[];
  /** An account page: listed in the user menu and the palette, not the sidebar. */
  account?: true;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    to: "/reports",
    label: "Reports",
    icon: ChartNoAxesColumnIcon,
    section: "Reports",
    permission: "report.read",
  },
  {
    to: "/ledger",
    label: "General ledger",
    icon: BookOpenIcon,
    section: "General ledger",
    permission: "ledger.read",
  },
  {
    to: "/transactions",
    label: "Transactions",
    icon: ReceiptTextIcon,
    section: "Sales",
    permission: "report.read",
  },
  {
    to: "/payments/reconciliation",
    label: "Payments",
    icon: ScaleIcon,
    section: "Sales",
    permission: "report.read",
    also: ["/payments/settings", "/payments/verification"],
  },
  {
    to: "/approvals",
    label: "Approvals",
    icon: InboxIcon,
    section: "Sales",
    permission: ["refund.approve", "sale.discount"],
  },
  { to: "/shifts", label: "Shifts", icon: ClockIcon, section: "Sales", permission: "shift.read" },
  { to: "/products", label: "Products", icon: PackageIcon, section: "Catalogue" },
  {
    to: "/barcodes",
    label: "Barcodes",
    icon: ScanBarcodeIcon,
    section: "Catalogue",
    permission: "product.read",
  },
  { to: "/imports", label: "Import", icon: UploadIcon, section: "Catalogue" },
  { to: "/tax", label: "Tax", icon: LandmarkIcon, section: "Catalogue", permission: "tax.read" },
  // One link: the Inventory page's own tabs reach records, takes, valuation and suppliers.
  {
    to: "/stock",
    label: "Inventory",
    icon: WarehouseIcon,
    section: "Inventory",
    permission: "stock.read",
    also: ["/suppliers"],
  },
  {
    to: "/customers",
    label: "Customers",
    icon: UserRoundIcon,
    section: "Customers",
    permission: "customer.read",
  },
  {
    to: "/kyc",
    label: "Identity checks",
    icon: BadgeCheckIcon,
    section: "Customers",
    permission: "kyc.approve",
  },
  {
    to: "/settings/loyalty",
    label: "Loyalty",
    icon: GiftIcon,
    section: "Customers",
    permission: "customer.manage",
    // The other customer settings (credit, statements) are reached from the settings pages.
    also: ["/settings"],
  },
  {
    to: "/stores",
    label: "Stores",
    icon: StoreIcon,
    section: "Organisation",
    permission: "store.read",
  },
  {
    to: "/branches",
    label: "Branches",
    icon: GitBranchIcon,
    section: "Organisation",
    permission: "branch.read",
  },
  {
    to: "/users",
    label: "Users",
    icon: UsersIcon,
    section: "Organisation",
    permission: "user.read",
  },
  {
    to: "/roles",
    label: "Roles",
    icon: ShieldCheckIcon,
    section: "Organisation",
    permission: "role.read",
  },
  {
    to: "/devices",
    label: "Devices",
    icon: MonitorSmartphoneIcon,
    section: "Organisation",
    permission: "device.read",
  },
  {
    to: "/audit",
    label: "Audit",
    icon: ScrollTextIcon,
    section: "Audit",
    permission: "audit.read",
  },
  {
    to: "/billing",
    label: "Billing",
    icon: CreditCardIcon,
    section: "Organisation",
    permission: "billing.manage",
    account: true,
  },
];
