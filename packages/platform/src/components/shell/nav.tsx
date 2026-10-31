import { createElement } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { BadgeCheckIcon, StoreIcon } from "lucide-react";
import { buildInfo } from "@shopper/config";
import { Badge } from "@shopper/ui/components/badge";
import { SidebarNav } from "@shopper/ui/components/sidebar/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@shopper/ui/components/sidebar/parts";
import { SidebarUser } from "@shopper/ui/components/sidebar/user";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useSignOut } from "../../queries/session";

const LINKS = [
  { to: "/kyb", label: "Verification", key: "V", icon: BadgeCheckIcon },
  { to: "/tenants", label: "Shops", key: "S", icon: StoreIcon },
] as const;

type Props = { user: { name: string; email: string }; onShortcuts: () => void };

/** The staff sidebar: the brand, the two pages (V and S), and the user menu. */
export function StaffSidebar({ user, onShortcuts }: Props) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const signOut = useSignOut();
  const items = LINKS.map((link) => ({
    label: link.label,
    icon: link.icon,
    shortcut: link.key,
    active: path.startsWith(link.to),
    render: createElement(Link, { to: link.to }),
  }));
  return (
    <Sidebar label="Main">
      <SidebarHeader>
        <Link
          to="/kyb"
          className="flex h-11 items-center gap-2 rounded-md px-1.5 group-data-[sidebar=collapsed]/sidebar:px-0.5"
        >
          <div
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground"
          >
            S
          </div>
          <span className="flex items-center gap-2 group-data-[sidebar=collapsed]/sidebar:sr-only">
            <span className="font-semibold tracking-tight">Shopper</span>
            <Badge variant="secondary">Admin</Badge>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav groups={[{ label: "Platform", items }]} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser
          user={user}
          version={buildInfo.version}
          onShortcuts={onShortcuts}
          onSignOut={() => signOut.mutate()}
        />
      </SidebarFooter>
    </Sidebar>
  );
}

/** The slim bar over every staff page: the sidebar toggle and the current page's name. */
export function StaffHeader({ onShortcuts }: { onShortcuts: () => void }) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const shortcuts = useShortcuts({
    ...Object.fromEntries(LINKS.map((link) => [link.key, () => void navigate({ to: link.to })])),
    "?": onShortcuts,
  });
  return (
    <header ref={shortcuts} className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <p className="truncate text-sm font-medium">
        {LINKS.find((link) => path.startsWith(link.to))?.label}
      </p>
    </header>
  );
}
