import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { TillView } from "./types";

export function TillNavigation({
  view,
  onChange,
}: {
  view: TillView;
  onChange: (view: TillView) => void;
}) {
  const register = useShortcuts({
    "Alt+S": () => onChange("sale"),
    "Alt+P": () => onChange("purchases"),
    "Alt+T": () => onChange("settings"),
  });
  return (
    <nav
      aria-label="Till"
      className="mb-4 flex h-11 shrink-0 items-center gap-2 border-b"
      ref={register}
    >
      <Button
        aria-current={view === "sale" ? "page" : undefined}
        aria-keyshortcuts="Alt+S"
        onClick={() => onChange("sale")}
        size="touch"
        variant={view === "sale" ? "secondary" : "ghost"}
      >
        Sale <Kbd className="hidden sm:inline-flex">Alt+S</Kbd>
      </Button>
      <Button
        aria-current={view === "purchases" ? "page" : undefined}
        aria-keyshortcuts="Alt+P"
        onClick={() => onChange("purchases")}
        size="touch"
        variant={view === "purchases" ? "secondary" : "ghost"}
      >
        Purchases <Kbd className="hidden sm:inline-flex">Alt+P</Kbd>
      </Button>
      <Button
        aria-current={view === "settings" ? "page" : undefined}
        aria-keyshortcuts="Alt+T"
        onClick={() => onChange("settings")}
        size="touch"
        variant={view === "settings" ? "secondary" : "ghost"}
      >
        Settings <Kbd className="hidden sm:inline-flex">Alt+T</Kbd>
      </Button>
    </nav>
  );
}
