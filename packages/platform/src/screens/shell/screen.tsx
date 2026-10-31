import { useState } from "react";
import { Navigate, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { focusIfIdle, OfflineBanner, sessionQuery } from "@shopper/backoffice/kit";
import { pageShortcuts, ShortcutsDialog } from "@shopper/ui/components/shortcuts/dialog";
import type { Shortcut } from "@shopper/ui/components/shortcuts/dialog";
import { SidebarInset } from "@shopper/ui/components/sidebar/parts";
import { SidebarProvider } from "@shopper/ui/components/sidebar/provider";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { MOD_KEY } from "@shopper/ui/hooks/modkey";
import { StaffHeader, StaffSidebar } from "../../components/shell/nav";

const GLOBAL_SHORTCUTS = [
  { keys: "V", label: "Verification" },
  { keys: "S", label: "Shops" },
  { keys: `${MOD_KEY}+B`, label: "Expand or collapse the sidebar" },
  { keys: "?", label: "Keyboard shortcuts" },
];

export function ShellScreen() {
  const { data: session } = useSuspenseQuery(sessionQuery());
  const [shortcuts, setShortcuts] = useState<readonly Shortcut[] | null>(null);
  if (!session) return <Navigate to="/login" />;
  const showShortcuts = () =>
    setShortcuts(pageShortcuts(document.querySelector("main") ?? undefined));
  return (
    <ShortcutRoot ref={focusIfIdle}>
      <SidebarProvider app="admin">
        <StaffSidebar user={session.user} onShortcuts={showShortcuts} />
        <SidebarInset>
          <StaffHeader onShortcuts={showShortcuts} />
          {/* The page scrolls here, not the window, as in the back office. */}
          <main
            tabIndex={0}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset md:px-8 md:py-6"
          >
            <Outlet />
          </main>
          <OfflineBanner />
        </SidebarInset>
      </SidebarProvider>
      <ShortcutsDialog
        open={shortcuts !== null}
        onOpenChange={(open) => !open && setShortcuts(null)}
        groups={[
          { label: "Everywhere", items: GLOBAL_SHORTCUTS },
          { label: "This page", items: shortcuts ?? [] },
        ]}
      />
      <Toaster />
    </ShortcutRoot>
  );
}
