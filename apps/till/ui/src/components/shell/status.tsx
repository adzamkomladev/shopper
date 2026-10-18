import { Menu } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { SheetTrigger } from "@shopper/ui/components/sheet";
import type { LinkState } from "./types";
import { aria, hint, menuShortcut } from "./views";

const dots = { good: "bg-success", pending: "bg-muted-foreground", problem: "bg-destructive" };

/** Figma register status bar: Menu, "<user> - <register>", then the connection with its dot. */
export function StatusBar({
  user,
  registerName,
  label,
  state,
}: {
  user: string;
  registerName: string;
  label: string;
  state: LinkState;
}) {
  return (
    <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b bg-card px-2 sm:px-6">
      <SheetTrigger asChild>
        <Button
          aria-keyshortcuts={aria(menuShortcut)}
          className="justify-self-start text-muted-foreground"
          size="touch"
          variant="ghost"
        >
          <Menu aria-hidden="true" /> Menu <Kbd className="max-sm:hidden">{hint(menuShortcut)}</Kbd>
        </Button>
      </SheetTrigger>
      <p className="min-w-0 truncate text-center text-base font-medium text-muted-foreground">
        {[user, registerName].filter(Boolean).join(" · ")}
      </p>
      <p
        aria-live="polite"
        className="flex items-center gap-2 justify-self-end pr-2 text-sm font-medium text-muted-foreground"
      >
        <span>{label}</span>
        <span aria-hidden="true" className={`size-2.5 rounded-full ${dots[state]}`} />
      </p>
    </header>
  );
}
