import { cn } from "cn";
import { Button } from "@shopper/ui/components/button";
import type { PurchaseCounts, PurchaseFilters } from "../../sale/types";

const tabs = [
  ["all", "All"],
  ["completed", "Completed"],
  ["returned", "Returns"],
  ["voided", "Voided"],
  ["pending", "Pending"],
] as const;

/** Figma "Status tabs": a label and its count; the selected one is underlined. */
export function PurchaseStatus({
  value,
  counts,
  onChange,
}: {
  value: PurchaseFilters["status"];
  counts: PurchaseCounts;
  onChange: (status: PurchaseFilters["status"]) => void;
}) {
  return (
    <div aria-label="Purchase status" className="flex flex-wrap" role="group">
      {tabs.map(([status, label]) => (
        <Button
          aria-pressed={value === status}
          className={cn(
            "-mb-px rounded-none border-b-2 border-transparent px-4 text-muted-foreground hover:bg-transparent",
            value === status && "border-primary font-semibold text-foreground",
          )}
          key={status}
          onClick={() => onChange(status)}
          size="touch"
          variant="ghost"
        >
          {label} <span className="tabular-nums">{counts[status]}</span>
        </Button>
      ))}
    </div>
  );
}
