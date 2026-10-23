import { useRef, useState, type ReactNode } from "react";
import { Sheet } from "@shopper/ui/components/sheet";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { MenuDrawer } from "./menu";
import { ShellTabs } from "./tabs";
import { StatusBar } from "./status";
import { TitleBar } from "./titlebar";
import type { ShellAction, ShellLink, ShellView } from "./types";
import { menuShortcut, signOutShortcut, visibleTabs } from "./views";

/**
 * The signed-in desktop chrome of Figma "Dashboard": title bar, register status bar, tabs by permission
 * and the Menu drawer. The screens go in as `children`; the frame owns only the menu.
 */
export function ShellFrame({
  user,
  registerName,
  permissions,
  link,
  view,
  onView,
  onAction,
  onSignOut,
  modal,
  children,
}: {
  user: string;
  registerName: string;
  permissions: readonly string[];
  link: ShellLink;
  view: ShellView;
  onView: (view: ShellView) => void;
  onAction: (action: ShellAction) => void;
  onSignOut: () => void;
  /** A dialog is open: it owns the keyboard, so none of the shell's keys fire behind it. */
  modal: boolean;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  // A screen chosen in the drawer opens once the drawer has closed, so focus is free for that screen to take.
  const chosen = useRef<ShellView | ShellAction | null>(null);
  const can = (permission: string) => permissions.includes(permission);
  const shifts = can("shift.write");
  // A payment goes into the open shift's drawer and finds the customer by phone.
  const accounts = can("sale.create") && can("customer.read");
  const go = (next: ShellView | ShellAction) => {
    chosen.current = next;
    setMenuOpen(false);
  };
  const register = useShortcuts(
    modal
      ? {}
      : {
          "Alt+S": () => can("sale.create") && onView("sale"),
          "Alt+P": () => onView("purchases"),
          "Alt+T": () => onView("settings"),
          ...(shifts && {
            "Alt+H": () => onView("shift"),
            "Alt+K": () => onAction("drop"),
            "Alt+J": () => onAction("nosale"),
          }),
          ...(accounts && { "Alt+A": () => onAction("payment") }),
          [menuShortcut]: () => setMenuOpen((open) => !open),
          [signOutShortcut]: onSignOut,
          ...Object.fromEntries(
            visibleTabs(permissions).map((tab) => [tab.shortcut, () => onView(tab.view)]),
          ),
        },
  );
  return (
    <Sheet onOpenChange={setMenuOpen} open={menuOpen}>
      <div className="flex h-svh min-h-0 flex-col bg-muted/50" ref={register}>
        <TitleBar />
        <StatusBar label={link.label} registerName={registerName} state={link.state} user={user} />
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-1 pb-2 sm:px-8">
          <ShellTabs onChange={onView} permissions={permissions} view={view} />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </div>
      <MenuDrawer
        onCloseAutoFocus={(event) => {
          const next = chosen.current;
          chosen.current = null;
          if (!next) return;
          event.preventDefault();
          if (next === "drop" || next === "nosale" || next === "payment") onAction(next);
          else onView(next);
        }}
        onSignOut={onSignOut}
        onView={go}
        accounts={accounts}
        online={link.online}
        shifts={shifts}
        registerName={registerName}
        user={user}
      />
    </Sheet>
  );
}
