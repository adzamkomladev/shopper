import { Navigate, Outlet } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { focusIfIdle, OfflineBanner, sessionQuery } from "@shopper/backoffice/kit";
import { AppBackdrop } from "@shopper/ui/components/app-backdrop";
import { Toaster } from "@shopper/ui/components/sonner";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { StaffNav } from "../../components/shell/nav";

export function ShellScreen() {
  const { data: session } = useSuspenseQuery(sessionQuery());
  if (!session) return <Navigate to="/login" />;
  return (
    <ShortcutRoot ref={focusIfIdle}>
      <AppBackdrop fill className="flex flex-col gap-8 px-5 py-6 md:px-13 md:py-10">
        <OfflineBanner />
        <StaffNav user={session.user} />
        {/* The page scrolls here, not the window, as in the back office. */}
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
