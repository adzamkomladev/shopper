import { CheckIcon } from "lucide-react";
import { Command, CommandInput, CommandItem, CommandList } from "@shopper/ui/components/command";
import type { CustomerView } from "../../../queries/customers/types";

const NOTES = {
  idle: "Type a phone number or a name.",
  loading: "Searching…",
  failed: "Couldn't search. Check your connection and try again.",
  done: "No customers match that.",
};

type Props = {
  /** What the search box is called for screen readers. */
  label: string;
  text: string;
  onTextChange: (text: string) => void;
  /** Who matched the search, without the customer being kept. */
  matches: CustomerView[];
  /** Whether a search has been made and is still on its way, or failed. */
  status: "idle" | "loading" | "failed" | "done";
  chosen?: CustomerView;
  onChoose: (customer: CustomerView) => void;
};

/** Finds another customer by phone or name: arrow keys move through the matches, Enter picks one. */
export function MergePicker({
  label,
  text,
  onTextChange,
  matches,
  status,
  chosen,
  onChoose,
}: Props) {
  return (
    <Command shouldFilter={false} className="rounded-md border">
      <CommandInput
        autoFocus
        aria-label={label}
        placeholder="Phone number or name"
        value={text}
        onValueChange={onTextChange}
      />
      {matches.length > 0 ? (
        <CommandList className="max-h-48">
          {matches.map((customer) => (
            <CommandItem
              key={customer.id}
              value={customer.id}
              className="group"
              onSelect={() => onChoose(customer)}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{customer.name}</span>
                <span className="truncate text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground">
                  {customer.phone}
                  {customer.businessName && ` · ${customer.businessName}`}
                </span>
              </span>
              {customer.id === chosen?.id && <CheckIcon aria-label="Chosen" />}
            </CommandItem>
          ))}
        </CommandList>
      ) : (
        <p role="status" className="py-6 text-center text-sm text-muted-foreground">
          {NOTES[status]}
        </p>
      )}
    </Command>
  );
}
