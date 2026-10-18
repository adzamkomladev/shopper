import type { ShellView } from "./types";

type Tab = { view: ShellView; label: string; permission: string; shortcut: string };

/** Figma order. Permissions are data from the host; a role name is never read here. */
const tabs: Tab[] = [
  { view: "dashboard", label: "Dashboard", permission: "report.read", shortcut: "Mod+1" },
  { view: "sale", label: "Checkout", permission: "sale.create", shortcut: "Mod+2" },
  { view: "inventory", label: "Inventory", permission: "stock.read", shortcut: "Mod+3" },
  { view: "reports", label: "Sales Reports", permission: "report.read", shortcut: "Mod+4" },
];

export const visibleTabs = (permissions: readonly string[]) =>
  tabs.filter((tab) => permissions.includes(tab.permission));

/** Checkout for a cashier, otherwise the first section this user may open; null when there is none. */
export function landingView(permissions: readonly string[]): ShellView | null {
  if (permissions.includes("sale.create")) return "sale";
  return visibleTabs(permissions)[0]?.view ?? null;
}

/** Alt+M and Alt+L belong to Settings (display device, reload), so the shell uses Ctrl. */
export const menuShortcut = "Mod+M";
export const signOutShortcut = "Mod+Shift+L";

export const hint = (shortcut: string) => shortcut.replace("Mod", "Ctrl");
export const aria = (shortcut: string) => shortcut.replace("Mod", "Control");
