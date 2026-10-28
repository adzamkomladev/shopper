import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { buildInfo } from "@shopper/config";
import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shopper/ui/components/dropdown-menu";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useSignOut } from "../../queries/session";

const LINKS = [
  { to: "/kyb", label: "Verification", key: "V" },
  { to: "/tenants", label: "Shops", key: "S" },
] as const;

type Props = { user: { name: string; email: string } };

/** The staff bar: the brand, the two pages (V and S), and the user menu. */
export function StaffNav({ user }: Props) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const shortcuts = useShortcuts(
    Object.fromEntries(LINKS.map((link) => [link.key, () => void navigate({ to: link.to })])),
  );
  return (
    <nav ref={shortcuts} aria-label="Main" className="flex flex-wrap items-center gap-x-8 gap-y-3">
      <Link to="/kyb" className="flex items-center gap-2 rounded-md">
        <span className="text-2xl font-semibold tracking-tight text-primary">Shopper</span>
        <Badge variant="secondary">Admin</Badge>
      </Link>
      <div className="order-last flex w-full gap-x-4 sm:order-none sm:w-auto">
        {LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            aria-current={path.startsWith(link.to) ? "page" : undefined}
            aria-keyshortcuts={link.key}
            className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground"
          >
            {link.label}
            <Kbd aria-hidden className="hidden lg:inline-flex">
              {link.key}
            </Kbd>
          </Link>
        ))}
      </div>
      <div className="ml-auto">
        <UserMenu user={user} />
      </div>
    </nav>
  );
}

function UserMenu({ user }: Props) {
  const signOut = useSignOut();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={user.name}>
          <Avatar>
            <AvatarFallback className="text-foreground">
              {user.name
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0]?.toUpperCase())
                .join("")}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut.mutate()}>
          <LogOutIcon aria-hidden />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Shopper {buildInfo.version}
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
