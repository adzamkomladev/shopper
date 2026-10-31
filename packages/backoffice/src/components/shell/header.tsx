import { useRef, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { SidebarTrigger } from "@shopper/ui/components/sidebar/parts";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useSidebarGroups } from "../../hooks/shell/nav/items";
import { MOD_KEY } from "../../lib/mod/key";
import { CommandPalette, closedPalette, type PaletteState } from "./command/palette";

/**
 * The slim bar over every page: the sidebar toggle, where you are, and search. Mod+K or "/" opens the
 * palette, "?" the keyboard shortcuts.
 */
export function ShellHeader({ onShortcuts }: { onShortcuts: () => void }) {
  const [palette, setPalette] = useState<PaletteState>(closedPalette);
  const searchRef = useRef<HTMLButtonElement>(null);
  const open = () => setPalette({ ...closedPalette, open: true });
  const shortcuts = useShortcuts({ "Mod+K": open, "/": open, "?": onShortcuts });
  const trail = useSidebarGroups()
    .flatMap((group) => group.items)
    .flatMap((item) => {
      const child = item.items?.find((each) => each.active);
      if (child) return [item.label, child.label];
      return item.active ? [item.label] : [];
    });
  return (
    <header ref={shortcuts} className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <p aria-label="You are here" className="flex min-w-0 items-center gap-1.5 text-sm">
        {trail.map((part, index) => (
          <span
            key={part}
            className={
              index === trail.length - 1
                ? "truncate font-medium"
                : "hidden truncate text-muted-foreground sm:inline after:ml-1.5 after:content-['/']"
            }
          >
            {part}
          </span>
        ))}
      </p>
      <Button
        ref={searchRef}
        variant="outline"
        aria-label="Search"
        aria-keyshortcuts="/ Control+K Meta+K"
        className="ml-auto w-8 justify-start px-0 font-normal text-muted-foreground max-sm:justify-center sm:w-56 sm:px-2.5"
        onClick={open}
      >
        <SearchIcon aria-hidden />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <Kbd aria-hidden className="hidden sm:inline-flex">
          {MOD_KEY === "⌘" ? "⌘K" : "Ctrl K"}
        </Kbd>
      </Button>
      <CommandPalette
        state={palette}
        onChange={setPalette}
        onClosed={() => searchRef.current?.focus()}
      />
    </header>
  );
}
