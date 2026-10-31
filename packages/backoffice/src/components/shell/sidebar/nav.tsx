import { Link } from "@tanstack/react-router";
import { buildInfo } from "@shopper/config";
import { DropdownMenuItem } from "@shopper/ui/components/dropdown-menu";
import { SidebarNav } from "@shopper/ui/components/sidebar/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@shopper/ui/components/sidebar/parts";
import { SidebarUser } from "@shopper/ui/components/sidebar/user";
import { useNavItems, useSidebarGroups } from "../../../hooks/shell/nav/items";
import { useSignOut } from "../../../queries/shell";
import type { Shop } from "../../../stores/shops";
import { ShopSwitcher } from "../shop/switcher";

type Props = {
  shops: Shop[];
  currentId: string | null;
  user: { name: string; email: string };
  onShortcuts: () => void;
};

/** The back office sidebar: the shop switcher, the member's pages by section, and their menu. */
export function ShellSidebar({ shops, currentId, user, onShortcuts }: Props) {
  const groups = useSidebarGroups();
  const account = useNavItems().filter((item) => item.account);
  const signOut = useSignOut();
  return (
    <Sidebar label="Main">
      <SidebarHeader>
        <ShopSwitcher shops={shops} currentId={currentId} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarNav groups={groups} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUser
          user={user}
          version={buildInfo.version}
          onShortcuts={onShortcuts}
          onSignOut={() => signOut.mutate()}
        >
          {account.map((item) => (
            <DropdownMenuItem key={item.to} asChild>
              <Link to={item.to}>
                <item.icon aria-hidden />
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        </SidebarUser>
      </SidebarFooter>
    </Sidebar>
  );
}
