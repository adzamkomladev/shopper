import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import type { TenderKind } from "../../../sale/types";

export function TenderMethods({
  selected,
  offline,
  canMomo,
  onSelect,
}: {
  selected: TenderKind;
  offline: boolean;
  canMomo: boolean;
  onSelect: (kind: TenderKind) => void;
}) {
  return (
    <div aria-label="Payment methods" className="grid grid-cols-3 gap-2">
      {(["cash", "momo", "card"] as const).map((kind, index) => {
        const Icon = kind === "cash" ? Banknote : kind === "momo" ? Smartphone : CreditCard;
        return (
          <Button
            key={kind}
            aria-keyshortcuts={`Alt+${index + 1}`}
            aria-pressed={selected === kind}
            className="h-11 min-w-0 gap-1.5 px-2 text-sm"
            disabled={kind === "momo" && (offline || !canMomo)}
            onClick={() => onSelect(kind)}
            size="touch"
            variant={selected === kind ? "default" : "outline"}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {kind === "momo" ? "MoMo" : kind === "cash" ? "Cash" : "Card"}
          </Button>
        );
      })}
    </div>
  );
}
