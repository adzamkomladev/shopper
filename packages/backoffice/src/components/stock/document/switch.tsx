import { Button } from "@shopper/ui/components/button";

import type { Mode } from "./types";
const modes: { mode: Mode; label: string }[] = [
  { mode: "count", label: "Stock count" },
  { mode: "receiving", label: "Receiving" },
];

/** Segmented switch between the two documents. Both keep their drafts while hidden. */
export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div
      aria-label="Stock document"
      className="flex w-fit gap-1 rounded-lg bg-muted p-0.5"
      role="group"
    >
      {modes.map((item) => (
        <Button
          aria-pressed={mode === item.mode}
          className={
            mode === item.mode
              ? "bg-card px-6 text-foreground shadow-sm hover:bg-card"
              : "px-6 text-kbd-foreground"
          }
          key={item.mode}
          onClick={() => onChange(item.mode)}
          size="touch"
          variant="ghost"
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}
