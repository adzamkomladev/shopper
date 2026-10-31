import { useState } from "react";
import { Navigate, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { SidebarInset } from "@shopper/ui/components/sidebar/parts";
import { SidebarProvider } from "@shopper/ui/components/sidebar/provider";
import { pageShortcuts, ShortcutsDialog } from "@shopper/ui/components/shortcuts/dialog";
import type { Shortcut } from "@shopper/ui/components/shortcuts/dialog";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { focusIfIdle } from "../../lib/focus";
import { MOD_KEY } from "../../lib/mod/key";
import { sessionQuery } from "../../queries/session/session";
import { currentShop, useShops } from "../../stores/shops";
import { ReadOnlyBanner } from "../../components/shell/billing/banner";
import { ShellHeader } from "../../components/shell/header";
import { OfflineBanner } from "../../components/shell/offline/banner";
import { SetupBanner } from "../../components/shell/setup/banner";
import { ShellSidebar } from "../../components/shell/sidebar/nav";

const GLOBAL_SHORTCUTS = [
  { keys: `${MOD_KEY}+K`, label: "Search products or jump to a page" },
  { keys: "/", label: "Search" },
  { keys: `${MOD_KEY}+B`, label: "Expand or collapse the sidebar" },
  { keys: "?", label: "Keyboard shortcuts" },
];

export function ShellScreen() {
  const { shops, currentId } = useShops();
  const { data: session } = useSuspenseQuery(sessionQuery());
  const [shortcuts, setShortcuts] = useState<readonly Shortcut[] | null>(null);
  if (!session) return <Navigate to="/login" search={{ shop: currentShop()?.slug || undefined }} />;
  const showShortcuts = () =>
    setShortcuts(pageShortcuts(document.querySelector("main") ?? undefined));
  return (
    <ShortcutRoot ref={focusIfIdle}>
      <SidebarProvider app="portal">
        <ShellSidebar
          shops={shops}
          currentId={currentId}
          user={session.user}
          onShortcuts={showShortcuts}
        />
        <SidebarInset>
          <ShellHeader onShortcuts={showShortcuts} />
          <div className="flex flex-col gap-2 px-4 pt-3 empty:hidden md:px-8">
            <ReadOnlyBanner />
            <SetupBanner />
          </div>
          {/* The page scrolls here, not the window: focusable, so the keyboard can scroll a page with no controls yet. */}
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
