import { Navigate, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { focusIfIdle } from "../../lib/focus";
import { sessionQuery } from "../../queries/session/session";
import { currentShop, useShops } from "../../stores/shops";
import { ReadOnlyBanner } from "../../components/shell/billing/banner";
import { OfflineBanner } from "../../components/shell/offline/banner";
import { TopNav } from "../../components/shell/top/nav";

export function ShellScreen() {
  const { shops, currentId } = useShops();
  const { data: session } = useSuspenseQuery(sessionQuery());
  if (!session) return <Navigate to="/login" search={{ shop: currentShop()?.slug || undefined }} />;
  return (
    <ShortcutRoot ref={focusIfIdle}>
      <AppBackdrop fill className="flex flex-col gap-8 px-5 py-6 md:px-13 md:py-10">
        <OfflineBanner />
        <TopNav shops={shops} currentId={currentId} user={session.user} />
        <ReadOnlyBanner />
        {/* The page scrolls here, not the window: focusable, so the keyboard can scroll a page with no controls yet. */}
        <main
          tabIndex={0}
          className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Outlet />
        </main>
      </AppBackdrop>
      <Toaster />
    </ShortcutRoot>
  );
}
