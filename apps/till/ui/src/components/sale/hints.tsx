import { Kbd } from "@shopper/ui/components/kbd";

const hints = [
  ["F2", "Scan or search"],
  ["↑ ↓", "Choose"],
  ["Enter", "Add"],
  ["Ctrl+Enter", "Checkout"],
  ["Alt+C", "Cart"],
  ["F5", "Charge"],
  ["F6", "Hold"],
  ["F7", "Held sales"],
  ["F11", "Clear cart"],
  ["Alt+1/2/3", "Tender method"],
  ["Alt+5/6", "On account or points"],
  ["Alt+A", "Account payment"],
  ["Alt+U", "Customer"],
  ["Alt+I", "Invoice"],
  ["Alt+E/R", "Edit or remove customer"],
  ["F3", "Basket"],
  ["F4", "Quantity"],
  ["Alt+O", "Price"],
  ["Delete", "Remove line"],
  ["F8", "Sync now"],
  ["F10", "Register"],
  ["Esc", "Clear"],
] as const;

/** Every till action has a key; this strip is the legend. The buttons carry their own hints too. */
export function ShortcutHints() {
  return (
    <ul
      aria-label="Keyboard shortcuts"
      className="hidden min-h-7 shrink-0 flex-wrap items-center gap-x-5 text-xs text-muted-foreground sm:flex"
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
