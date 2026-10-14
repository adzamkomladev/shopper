import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import { Kbd, KbdGroup } from "@shopper/ui/components/kbd";
import { MOD_KEY } from "../../../lib/mod/key";
import type { Shop } from "../../../stores/shops";
import { CommandPalette, closedPalette, type PaletteState } from "../command/palette";
import { ShopSwitcher } from "../shop/switcher";
import { UserMenu } from "../user/menu";
import { useNavItems } from "../../../hooks/shell/nav/items";
import { useShellShortcuts } from "../../../hooks/shell/shortcuts";

type Props = {
  shops: Shop[];
  currentId: string | null;
  user: { name: string; email: string };
};

/** Figma 48:1473: shop switcher, links, search and the user menu in one bar, plus the palette it opens. */
export function TopNav({ shops, currentId, user }: Props) {
  const [palette, setPalette] = useState<PaletteState>(closedPalette);
  const navItems = useNavItems();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const open = (query = "") => setPalette({ open: true, query, term: query });
  const shortcuts = useShellShortcuts({ openPalette: () => open(), focusSearch });
  // Below md the input is hidden, so the icon button stands in for it.
  function focusSearch() {
    searchRef.current?.focus();
    if (document.activeElement !== searchRef.current) searchButtonRef.current?.focus();
  }
  return (
    <nav
      ref={shortcuts}
      aria-label="Main"
      className="flex flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap"
    >
      <div className="flex min-w-0 flex-1 items-center gap-x-6 xl:flex-initial">
        <ShopSwitcher shops={shops} currentId={currentId} />
      </div>
      <div className="order-last flex w-full flex-wrap gap-x-6 gap-y-1 xl:order-none xl:w-auto xl:flex-nowrap">
        {navItems.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="-mx-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:text-foreground"
          >
            {label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-4 md:ml-auto">
        <Button
          ref={searchButtonRef}
          variant="ghost"
          size="icon"
          className="xl:hidden"
          aria-label="Search"
          onClick={() => open()}
        >
          <SearchIcon aria-hidden />
        </Button>
        <InputGroup className="hidden w-72 xl:flex">
          <InputGroupAddon>
            <SearchIcon aria-hidden />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            value=""
            placeholder="Search"
            aria-label="Search"
            aria-keyshortcuts="/ Control+K Meta+K"
            onClick={() => open()}
            onChange={(event) => open(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <KbdGroup aria-hidden>
              <Kbd>{MOD_KEY}</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </InputGroupAddon>
        </InputGroup>
        <UserMenu user={user} />
      </div>
      <CommandPalette state={palette} onChange={setPalette} onClosed={focusSearch} />
    </nav>
  );
}
