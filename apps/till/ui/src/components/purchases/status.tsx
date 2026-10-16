import { Button } from "@shopper/ui/components/button";
import type { PurchaseFilters } from "../../sale/types";

const statuses = [
  ["all", "All"],
  ["completed", "Completed"],
  ["voided", "Voided"],
  ["pending", "Pending MoMo"],
] as const;

export function PurchaseStatus({
  value,
  onChange,
}: {
  value: PurchaseFilters["status"];
  onChange: (status: PurchaseFilters["status"]) => void;
}) {
  return (
    <div aria-label="Purchase status" className="flex flex-wrap gap-1" role="group">
      {statuses.map(([status, label]) => (
        <Button
          key={status}
          aria-pressed={value === status}
          onClick={() => onChange(status)}
          size="touch"
          variant={value === status ? "secondary" : "ghost"}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
