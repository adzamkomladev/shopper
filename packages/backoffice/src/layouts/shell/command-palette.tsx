import type { Dispatch, SetStateAction } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@shopper/ui/components/command";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { useDebouncedCallback } from "../../lib/use-debounced-callback";
import { usePaletteProducts } from "./queries";
import { useNavItems } from "./use-nav-items";

const SEARCH_DEBOUNCE_MS = 200;

/** `query` is what is typed; `term` trails it by a moment and is what the server is asked. */
export type PaletteState = { open: boolean; query: string; term: string };
export const closedPalette: PaletteState = { open: false, query: "", term: "" };

type Props = {
  state: PaletteState;
  onChange: Dispatch<SetStateAction<PaletteState>>;
  /** Where focus goes when the palette closes. */
  onClosed: () => void;
};

export function CommandPalette({ state, onChange, onClosed }: Props) {
  const navigate = useNavigate();
  const navItems = useNavItems();
  const online = useOnline();
  const { data, isFetching, isError } = usePaletteProducts(state.term, online);
  const setTerm = useDebouncedCallback(
    (term: string) => onChange((current) => ({ ...current, term })),
    SEARCH_DEBOUNCE_MS,
  );
  const close = () => {
    setTerm.cancel();
    onChange(closedPalette);
  };
  const searching = state.term.trim() !== "";
  return (
    <CommandDialog
      open={state.open}
      onOpenChange={(open) => (open ? onChange((current) => ({ ...current, open })) : close())}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onClosed();
      }}
      title="Search"
      description="Search products or jump to a page"
    >
      <CommandInput
        placeholder="Search products or jump to…"
        value={state.query}
        onValueChange={(query) => {
          onChange((current) => ({ ...current, query }));
          setTerm(query);
        }}
      />
      <CommandList>
        {!online && searching && <PaletteNote>Can't search products offline.</PaletteNote>}
        {online && isError && <PaletteNote>Couldn't search products. Try again.</PaletteNote>}
        {!isFetching && !isError && !data?.items.length && (
          <CommandEmpty>Nothing matches that.</CommandEmpty>
        )}
        {searching && data && data.items.length > 0 && (
          <CommandGroup heading="Products">
            {data.items.map((product) => (
              <CommandItem
                key={product.id}
                // The server already matched it (maybe by barcode), so the typed text is part of the value to
                // get past cmdk's own filter.
                value={`${state.query} ${product.name} ${product.sku}`}
                onSelect={() => {
                  close();
                  void navigate({ to: "/products/$productId", params: { productId: product.id } });
                }}
              >
                <span className="flex-1 truncate">{product.name}</span>
                <span className="text-xs text-muted-foreground">{product.sku}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Go to">
          {navItems.map(({ to, label, icon: Icon }) => (
            <CommandItem
              key={to}
              onSelect={() => {
                close();
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

function PaletteNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
