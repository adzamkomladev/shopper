import { Link } from "@tanstack/react-router";
import { LogOutIcon } from "lucide-react";
import { buildInfo } from "@shopper/config";
import { Avatar, AvatarFallback } from "@shopper/ui/components/avatar";
import { Button } from "@shopper/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@shopper/ui/components/dropdown-menu";
import { useNavItems } from "../../../hooks/shell/nav/items";
import { useSignOut } from "../../../queries/shell";

type Props = { user: { name: string; email: string } };

export function UserMenu({ user }: Props) {
  const signOut = useSignOut();
  const account = useNavItems().filter((item) => item.account);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={user.name}>
          <Avatar>
            <AvatarFallback className="text-foreground">{initials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {account.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} asChild>
            <Link to={to}>
              <Icon aria-hidden />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}
