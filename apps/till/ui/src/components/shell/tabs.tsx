import { cn } from "cn";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { ShellView } from "./types";
import { aria, hint, visibleTabs } from "./views";

/** Figma tab strip: only the sections the signed-in user may open. */
export function ShellTabs({
  permissions,
  view,
  onChange,
}: {
  permissions: readonly string[];
  view: ShellView;
  onChange: (view: ShellView) => void;
}) {
  const tabs = visibleTabs(permissions);
  if (!tabs.length)
    return (
      <p className="mb-4 text-sm text-muted-foreground">
        This account has no register sections. Ask a manager for access.
      </p>
    );
  return (
    <div
      aria-label="Register sections"
      role="tablist"
      className="mb-1 flex w-fit max-w-full shrink-0 gap-1 overflow-x-auto rounded-lg bg-muted p-0.5"
    >
      {tabs.map((tab) => (
        <Button
          aria-keyshortcuts={aria(tab.shortcut)}
          aria-selected={view === tab.view}
          className={cn(
            "px-4 text-kbd-foreground lg:px-6",
            view === tab.view && "bg-card text-foreground shadow-sm hover:bg-card",
          )}
          key={tab.view}
          onClick={() => onChange(tab.view)}
          role="tab"
          size="touch"
          variant="ghost"
        >
          {tab.label} <Kbd className="max-lg:hidden">{hint(tab.shortcut)}</Kbd>
        </Button>
      ))}
    </div>
  );
}
