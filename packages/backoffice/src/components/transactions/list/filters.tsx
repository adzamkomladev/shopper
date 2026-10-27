import { SearchIcon } from "lucide-react";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { Label } from "@shopper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import type { Period } from "../../../lib/reports/types";
import { TENDERS, type TransactionSearch } from "../../../schemas/transactions";
import { PeriodControls } from "../../reports/period";
import { tenderLabel } from "./format";

export const SEARCH_ID = "transactions-search";
const ANY = "any";

type Props = {
  search: TransactionSearch;
  period: Period;
  onChange: (next: Partial<TransactionSearch>) => void;
};

/**
 * The receipt, customer or MoMo reference search (`/`, applied on Enter), the date range (`[` and `]` step it) and
 * the payment method. All of them live in the address.
 */
export function TransactionFilters({ search, period, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <form
        role="search"
        className="flex min-w-64 flex-1 flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const q = new FormData(event.currentTarget).get("q");
          onChange({ q: typeof q === "string" && q.trim() ? q.trim() : undefined });
        }}
      >
        <Label htmlFor={SEARCH_ID}>Search</Label>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={SEARCH_ID}
            name="q"
            type="search"
            // A new search from the address (Back, a cleared filter) refills the box.
            key={search.q ?? ""}
            defaultValue={search.q ?? ""}
            placeholder="Receipt number, customer name or phone, MoMo reference"
            aria-keyshortcuts="/"
            className="pr-10 pl-9"
          />
          <Kbd aria-hidden className="absolute top-1/2 right-3 -translate-y-1/2 max-sm:hidden">
            /
          </Kbd>
        </div>
      </form>
      <PeriodControls period={period} />
      <div className="flex flex-col gap-2 max-sm:w-full">
        <Label htmlFor="transactions-tender">Payment</Label>
        <Select
          value={search.tender ?? ANY}
          onValueChange={(value) =>
            onChange({ tender: value === ANY ? undefined : (value as TransactionSearch["tender"]) })
          }
        >
          <SelectTrigger id="transactions-tender" className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All payments</SelectItem>
            {TENDERS.map((tender) => (
              <SelectItem key={tender} value={tender}>
                {tenderLabel(tender)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
