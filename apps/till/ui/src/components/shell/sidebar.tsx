import { createElement } from "react";
import {
  Building2,
  ChartColumn,
  HandCoins,
  LayoutDashboard,
  PanelBottomOpen,
  Receipt,
  Settings,
  ShoppingCart,
  Timer,
  Wallet,
  Warehouse,
} from "lucide-react";
import { SidebarNav, type SidebarNavItem } from "@shopper/ui/components/sidebar/nav";
import { Sidebar, SidebarContent, SidebarFooter } from "@shopper/ui/components/sidebar/parts";
import { SidebarUser } from "@shopper/ui/components/sidebar/user";
import type { ShellAction, ShellView } from "./types";
import { aria, visibleTabs } from "./views";

const icons = {
  dashboard: LayoutDashboard,
  sale: ShoppingCart,
  inventory: Warehouse,
  reports: ChartColumn,
};

/** The till's sidebar: its sections by permission, the cash actions, the back office, and the user. */
export function TillSidebar({
  user,
  registerName,
  permissions,
  view,
  online,
  shifts,
  accounts,
  onView,
  onAction,
  onHelp,
  onSignOut,
}: {
  user: string;
  registerName: string;
  permissions: readonly string[];
  view: ShellView;
  /** The back office needs the server; offline it is disabled with the reason. */
  online: boolean;
  /** The user holds shift.write, so the shift screens and the cash movements are theirs to open. */
  shifts: boolean;
  /** The user may sell and read customers, so taking a payment on an account is theirs to open. */
  accounts: boolean;
  onView: (view: ShellView) => void;
  onAction: (action: ShellAction) => void;
  onHelp: () => void;
  onSignOut: () => void;
}) {
  const button = (onClick: () => void) => createElement("button", { type: "button", onClick });
  const go = (
    target: ShellView,
    label: string,
    icon: SidebarNavItem["icon"],
    shortcut: string,
  ) => ({
    label,
    icon,
    shortcut,
    active: view === target,
    render: button(() => onView(target)),
  });
  const act = (
    action: ShellAction,
    label: string,
    icon: SidebarNavItem["icon"],
    shortcut: string,
  ) => ({
    label,
    icon,
    shortcut,
    render: button(() => onAction(action)),
  });
  const sections = visibleTabs(permissions).map((tab) =>
    go(tab.view, tab.label, icons[tab.view as keyof typeof icons], aria(tab.shortcut)),
  );
  const register = [
    go("purchases", "Previous purchases", Receipt, "Alt+P"),
    ...(shifts
      ? [
          go("shift", "Shift", Timer, "Alt+H"),
          act("drop", "Cash drop", HandCoins, "Alt+K"),
          act("nosale", "No sale", PanelBottomOpen, "Alt+J"),
        ]
      : []),
    ...(accounts ? [act("payment", "Account payment", Wallet, "Alt+A")] : []),
    go("settings", "Register settings", Settings, "Alt+T"),
    {
      label: online ? "Back office" : "Back office (needs connection)",
      icon: Building2,
      render: online
        ? createElement("a", { href: "/backoffice/" })
        : createElement("button", { type: "button", disabled: true }),
    },
  ];
  return (
    <Sidebar label="Register">
      <SidebarContent>
        <SidebarNav
          groups={[
            { label: "Sections", items: sections },
            { label: "Register", items: register },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser
          detail={registerName}
          onShortcuts={onHelp}
          onSignOut={onSignOut}
          user={{ name: user }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
