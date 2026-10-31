import { useState, type ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { ShortcutsDialog } from "@shopper/ui/components/shortcuts/dialog";
import { SidebarInset, SidebarTrigger } from "@shopper/ui/components/sidebar/parts";
import { SidebarProvider } from "@shopper/ui/components/sidebar/provider";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { TILL_SHORTCUTS } from "../../shortcuts/registry";
import { TillSidebar } from "./sidebar";
import { TitleBar } from "./titlebar";
import type { LinkState, ShellAction, ShellLink, ShellView } from "./types";
import { menuShortcut, signOutShortcut, viewLabel, visibleTabs } from "./views";

const dots: Record<LinkState, string> = {
  good: "bg-success",
  pending: "bg-muted-foreground",
  problem: "bg-destructive",
};

/**
 * The signed-in desktop chrome: title bar, the sidebar (a rail until opened) and a slim header with
 * the register, its connection and Help. The screens go in as `children`.
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
  notice,
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
  /** A banner under the header, such as a waiting update. */
  notice?: ReactNode;
  children: ReactNode;
}) {
  const [help, setHelp] = useState(false);
  const can = (permission: string) => permissions.includes(permission);
  const shifts = can("shift.write");
  // A payment goes into the open shift's drawer and finds the customer by phone.
  const accounts = can("sale.create") && can("customer.read");
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
          F1: () => setHelp(true),
          "Mod+/": () => setHelp(true),
          [signOutShortcut]: onSignOut,
          ...Object.fromEntries(
            visibleTabs(permissions).map((tab) => [tab.shortcut, () => onView(tab.view)]),
          ),
        },
  );
  return (
    <div className="flex h-svh min-h-0 flex-col" ref={register}>
      <TitleBar />
      {/* The till starts as an icon rail, so the sale keeps the width; Ctrl+M or Ctrl+B opens it. */}
      <SidebarProvider
        app="till"
        defaultOpen={false}
        touch
        keys={modal ? [] : [menuShortcut]}
        className="h-auto min-h-0 flex-1"
      >
        <TillSidebar
          accounts={accounts}
          onAction={onAction}
          onHelp={() => setHelp(true)}
          onSignOut={onSignOut}
          onView={onView}
          online={link.online}
          permissions={permissions}
          registerName={registerName}
          shifts={shifts}
          user={user}
          view={view}
        />
        <SidebarInset className="bg-muted/50">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-4">
            <SidebarTrigger />
            <p className="truncate text-sm font-semibold">{viewLabel(view)}</p>
            <p className="hidden min-w-0 truncate text-sm text-muted-foreground md:block">
              {[user, registerName].filter(Boolean).join(" · ")}
            </p>
            <p
              aria-live="polite"
              className="ml-auto flex items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <span>{link.label}</span>
              <span aria-hidden="true" className={`size-2 rounded-full ${dots[link.state]}`} />
            </p>
            <Button
              aria-keyshortcuts="F1 Control+/"
              aria-label="Help"
              className="size-11"
              onClick={() => setHelp(true)}
              size="icon"
              variant="ghost"
            >
              <CircleHelp aria-hidden="true" />
            </Button>
          </header>
          {notice}
          <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-2 sm:px-6">
            {!visibleTabs(permissions).length && (
              <p className="mb-2 text-sm text-muted-foreground">
                This account has no register sections. Ask a manager for access.
              </p>
            )}
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <ShortcutsDialog groups={TILL_SHORTCUTS} onOpenChange={setHelp} open={help} title="Help" />
    </div>
  );
}
