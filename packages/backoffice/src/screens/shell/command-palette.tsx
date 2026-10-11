import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@shopper/ui/components/command";
import { NAV_ITEMS } from "./nav-items";

export type PaletteState = { open: boolean; query: string };
type Props = {
  state: PaletteState;
  onChange: (state: PaletteState) => void;
  /** Where focus goes when the palette closes. */
  onClosed: () => void;
};

export function CommandPalette({ state, onChange, onClosed }: Props) {
  const navigate = useNavigate();
  return (
    <CommandDialog
      open={state.open}
      onOpenChange={(open) => onChange({ ...state, open })}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onClosed();
      }}
      title="Search"
      description="Search Shopper or jump to a page"
    >
      <CommandInput
        placeholder="Search or jump to…"
        value={state.query}
        onValueChange={(query) => onChange({ ...state, query })}
      />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <CommandItem
              key={to}
              onSelect={() => {
                onChange({ open: false, query: "" });
                void navigate({ to });
              }}
            >
              <Icon aria-hidden />
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
