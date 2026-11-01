import { createContext, use, useState, type ReactNode } from "react";
import { cn } from "cn";
import { TooltipProvider } from "#components/tooltip";
import { useShortcuts } from "#hooks/shortcuts";
import { useMobile } from "#hooks/use/mobile";
import type { SidebarState } from "./types";

const SidebarContext = createContext<SidebarState | null>(null);

export function useSidebar() {
  const sidebar = use(SidebarContext);
  if (!sidebar) throw new Error("useSidebar needs a SidebarProvider above it");
  return sidebar;
}

/**
 * Lays the sidebar beside the page and keeps whether it is expanded, saved per `app`. Mod+B (and any
 * `keys`) toggle it; below md it is a sheet that starts closed. `touch` sizes it for a touch screen.
 */
export function SidebarProvider({
  app,
  defaultOpen = true,
  keys = [],
  touch = false,
  className,
  children,
}: {
  app: string;
  defaultOpen?: boolean;
  keys?: readonly string[];
  touch?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const storageKey = `shopper.sidebar.${app}`;
  const mobile = useMobile();
  const [open, setOpenState] = useState(() => readSidebarOpen(app) ?? defaultOpen);
  const [openMobile, setOpenMobile] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(storageKey, String(next));
    } catch {
      // Blocked storage only means the choice is not remembered.
    }
  };
  const toggle = () => (mobile ? setOpenMobile(!openMobile) : setOpen(!open));
  const register = useShortcuts(Object.fromEntries(["Mod+B", ...keys].map((key) => [key, toggle])));
  return (
    <SidebarContext value={{ open, setOpen, mobile, openMobile, setOpenMobile, toggle, touch }}>
      <TooltipProvider delayDuration={300}>
        <div
          ref={register}
          data-sidebar={open ? "expanded" : "collapsed"}
          className={cn("group/sidebar flex h-svh min-h-0 w-full bg-background", className)}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext>
  );
}

/** The app's saved sidebar state, so a loading skeleton can match it; undefined when none is saved. */
export function readSidebarOpen(app: string) {
  try {
    const saved = localStorage.getItem(`shopper.sidebar.${app}`);
    return saved === null ? undefined : saved === "true";
  } catch {
    return undefined;
  }
}
