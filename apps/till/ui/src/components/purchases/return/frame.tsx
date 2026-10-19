import { ArrowLeft } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts, type ShortcutMap } from "@shopper/ui/hooks/shortcuts";
import { windowLine } from "../../../purchases/policy";
import type { PurchaseDetails } from "../../../sale/types";

/** The return step's page: a title, the way back, and whatever state the step is in. */
export function ReturnFrame({
  purchase,
  shortcuts,
  active,
  focusBack,
  onBack,
  children,
}: {
  purchase: PurchaseDetails;
  shortcuts: ShortcutMap;
  active: boolean;
  /** Focus the back button on arrival, for states with nothing to type into. */
  focusBack: boolean;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const register = useShortcuts(active ? shortcuts : {});
  const reference = purchase.receiptNumber ?? purchase.id.slice(0, 8);
  return (
    <section
      aria-label="Return items"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto pb-1"
      ref={register}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border bg-card p-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Return items</h2>
          <p className="text-sm text-muted-foreground">
            Purchase #{reference}
            {purchase.eligibility && ` · ${windowLine(purchase.eligibility)}`}
          </p>
        </div>
        <Button
          aria-keyshortcuts="Escape"
          autoFocus={focusBack}
          onClick={onBack}
          size="touch"
          type="button"
          variant="outline"
        >
          <ArrowLeft aria-hidden="true" />
          Back to purchase <Kbd className="max-sm:hidden">Esc</Kbd>
        </Button>
      </header>
      {children}
    </section>
  );
}
