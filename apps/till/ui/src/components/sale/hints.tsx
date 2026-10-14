import { Kbd } from "@shopper/ui/components/kbd";

const hints = [
  ["F2", "Scan or search"],
  ["↑ ↓", "Choose"],
  ["Enter", "Add"],
  ["F3", "Basket"],
  ["F4", "Quantity"],
  ["Delete", "Remove line"],
  ["F8", "Sync now"],
  ["Esc", "Clear"],
] as const;

/** Every till action has a key; this strip is the legend. The buttons carry their own hints too. */
export function ShortcutHints() {
  return (
    <ul
      aria-label="Keyboard shortcuts"
      className="flex h-7 shrink-0 flex-wrap items-center gap-x-5 text-xs text-muted-foreground"
    >
      {hints.map(([key, label]) => (
        <li className="flex items-center gap-1.5" key={key}>
          <Kbd className="pointer-coarse:inline-flex">{key}</Kbd>
          {label}
        </li>
      ))}
    </ul>
  );
}
