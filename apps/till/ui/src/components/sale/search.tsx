import type { ChangeEvent, KeyboardEvent, Ref } from "react";
import { ScanLine, SearchX } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { cn } from "cn";
import { formatQuantity } from "../../sale/quantity";
import { reveal } from "./line";
import type { AddInput, CatalogueMatch, SearchState } from "../../sale/types";

export const resultsId = "sale-results";
export const optionId = (index: number) => `${resultsId}-${index}`;

/** A pack barcode adds by code so it keeps its own quantity; any other match adds the product. */
export const addInputFor = (match: CatalogueMatch): AddInput =>
  match.match === "barcode" && match.barcode
    ? { code: match.barcode }
    : { productId: match.productId };

type EntryProps = {
  fieldRef: Ref<HTMLInputElement>;
  value: string;
  activeIndex: number | null;
  disabled: boolean;
  describedBy: string | undefined;
  /** A new key remounts the field, and `autoFocus` puts the scan cursor back in it. */
  focusKey: number;
  fieldProps: {
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
    onPaste: () => void;
    onCompositionStart: () => void;
  };
  onLookup: () => void;
};

/** The main scan field, always the first stop. Figma "Scan entry": icon, field, Lookup. */
export function ScanEntry({
  fieldRef,
  value,
  activeIndex,
  disabled,
  describedBy,
  focusKey,
  fieldProps,
  onLookup,
}: EntryProps) {
  return (
    <div className="flex h-17 shrink-0 items-center gap-2.5 border-y bg-muted/50 px-4">
      <ScanLine aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
      <Input
        {...fieldProps}
        aria-activedescendant={activeIndex === null ? undefined : optionId(activeIndex)}
        aria-autocomplete="list"
        // The listbox exists only while there are matches to choose from.
        aria-controls={activeIndex === null ? undefined : resultsId}
        aria-describedby={describedBy}
        aria-expanded={activeIndex !== null}
        aria-keyshortcuts="F2"
        aria-label="Scan barcode or search items"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        autoFocus
        className="bg-card"
        data-zone="scan"
        disabled={disabled}
        key={focusKey}
        placeholder="Scan barcode or search items"
        ref={fieldRef}
        role="combobox"
        spellCheck={false}
        touch
        value={value}
      />
      <Button aria-keyshortcuts="F2" onClick={onLookup} size="touch" variant="secondary">
        Lookup <Kbd className="pointer-coarse:inline-flex">F2</Kbd>
      </Button>
    </div>
  );
}

type ResultsProps = {
  query: string;
  search: SearchState;
  activeIndex: number;
  onPick: (match: CatalogueMatch) => void;
};

const matchLabel = { barcode: "Barcode", sku: "SKU", name: "Name" } as const;
// Muted text on the tinted active row drops below 4.5:1; slate-600 keeps AA.
const quiet = (active: boolean) => (active ? "text-kbd-foreground" : "text-muted-foreground");

/** Takes the place of the basket lines while the cashier searches. */
export function SearchResults({ query, search, activeIndex, onPick }: ResultsProps) {
  const { status, matches } = search;
  if (status === "failed")
    return (
      <Empty className="flex-1" role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Search is unavailable</EmptyTitle>
          <EmptyDescription>
            The register could not search the catalogue. Scan the barcode, or try again.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  if (matches.length === 0 && status !== "ready")
    return (
      <div aria-label="Searching the catalogue" className="flex flex-1 flex-col" role="status">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex h-14 items-center gap-3 border-b px-4" key={index}>
            <div className="grid flex-1 gap-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    );
  if (matches.length === 0)
    return (
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>No matches for “{query}”</EmptyTitle>
          <EmptyDescription>
            Check the spelling, or search by SKU. You can also scan the barcode.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="flex h-7 shrink-0 items-center bg-muted px-4 text-xs font-bold text-kbd-foreground">
        {matches.length} match{matches.length === 1 ? "" : "es"} · Up and Down to choose, Enter to
        add
      </p>
      <ul
        aria-busy={status === "loading"}
        aria-label="Search results"
        className="min-h-0 flex-1 overflow-y-auto"
        id={resultsId}
        role="listbox"
      >
        {matches.map((match, index) => (
          <li
            aria-selected={index === activeIndex}
            className={cn(
              "flex h-14 cursor-pointer items-center gap-3 border-b border-l-4 px-4",
              index === activeIndex ? "border-l-primary bg-primary/5" : "border-l-transparent",
            )}
            id={optionId(index)}
            key={`${match.productId}-${match.barcode ?? match.match}`}
            onClick={() => onPick(match)}
            onMouseDown={(event) => event.preventDefault()}
            ref={index === activeIndex ? reveal : undefined}
            role="option"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-base leading-none font-medium">{match.name}</p>
              <p className={cn("mt-1 truncate text-xs", quiet(index === activeIndex))}>
                {[match.sku, match.barcode].filter(Boolean).join(" · ")}
              </p>
            </div>
            {match.quantityThousandths !== undefined && match.quantityThousandths !== 1000 && (
              <span
                className={cn("text-sm font-medium tabular-nums", quiet(index === activeIndex))}
              >
                × {formatQuantity(match.quantityThousandths)}
              </span>
            )}
            <Badge variant="outline">{matchLabel[match.match]}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
