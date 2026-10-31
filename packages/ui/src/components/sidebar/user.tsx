import type { ReactNode } from "react";
import { ChevronsUpDownIcon, KeyboardIcon, LogOutIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "#components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "#components/dropdown/menu";
import { ThemeMenu } from "#components/theme/menu";
import { SidebarMenuButton } from "./parts";

/**
 * The sidebar footer: who is signed in, and their menu (the app's account items, Theme, Keyboard
 * shortcuts and Sign out). In the icon rail only the avatar shows.
 */
export function SidebarUser({
  user,
  detail,
  version,
  onShortcuts,
  onSignOut,
  children,
}: {
  user: { name: string; email?: string };
  /** The second line under the name; the email when not given. */
  detail?: string;
  version?: string;
  onShortcuts?: () => void;
  onSignOut: () => void;
  children?: ReactNode;
}) {
  const second = detail ?? user.email;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          tooltip={user.name}
          aria-label={user.name}
          className="h-11 px-1.5 text-foreground group-data-[sidebar=collapsed]/sidebar:px-0.5"
        >
          {/* A div, not a span: the rail hides the button's span children (the labels). */}
          <div className="shrink-0">
            <Avatar size="sm" className="size-7 rounded-md">
              <AvatarFallback className="rounded-md bg-primary text-xs text-primary-foreground">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="grid flex-1 leading-tight">
            <span className="truncate font-medium">{user.name}</span>
            {second && <span className="truncate text-xs text-foreground/70">{second}</span>}
          </span>
          <ChevronsUpDownIcon
            aria-hidden
            className="ml-auto opacity-50 group-data-[sidebar=collapsed]/sidebar:hidden"
          />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate font-medium">{user.name}</span>
          {user.email && <span className="truncate text-muted-foreground">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {children}
        <ThemeMenu />
        {onShortcuts && (
          <DropdownMenuItem onSelect={onShortcuts}>
            <KeyboardIcon aria-hidden />
            Keyboard shortcuts
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <LogOutIcon aria-hidden />
          Sign out
        </DropdownMenuItem>
        {version && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Shopper {version}
            </DropdownMenuLabel>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}
