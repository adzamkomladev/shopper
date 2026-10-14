import { Navigate, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { focusIfIdle } from "../../lib/focus";
import { sessionQuery } from "../../queries/session/session";
import { currentShop, useShops } from "../../stores/shops";
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
        <main className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1">
          <Outlet />
        </main>
      </AppBackdrop>
      <Toaster />
    </ShortcutRoot>
  );
}
