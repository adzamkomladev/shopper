import { Banknote, CreditCard, Smartphone } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldDescription, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { Kbd } from "@shopper/ui/components/kbd";
import type { RefundKind } from "../../../sale/types";

const methods = [
  ["cash", "Cash", Banknote, "Alt+1"],
  ["card", "Card", CreditCard, "Alt+2"],
  ["momo", "MoMo", Smartphone, "Alt+3"],
] as const;
const helper: Record<RefundKind, string> = {
  cash: "The drawer opens when the refund is recorded.",
  card: "From the card terminal slip.",
  momo: "The MoMo transaction ID.",
};

/** How the money goes back. Card and MoMo keep a reference so the refund can be traced. */
export function ReturnTender({
  kind,
  reference,
  onKind,
  onReference,
}: {
  kind: RefundKind;
  reference: string;
  onKind: (kind: RefundKind) => void;
  onReference: (reference: string) => void;
}) {
  return (
    <section aria-label="Refund method" className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Refund method</h3>
      </div>
      <div className="grid gap-3 p-4">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Method">
          {methods.map(([value, label, Icon, key]) => (
            <Button
              aria-keyshortcuts={key}
              aria-pressed={kind === value}
              className="h-auto min-h-11 min-w-0 flex-col gap-0.5 px-2 py-1.5"
              key={value}
              onClick={() => onKind(value)}
              size="touch"
              type="button"
              variant={kind === value ? "default" : "outline"}
            >
              <span className="flex items-center gap-1.5">
                <Icon aria-hidden="true" />
                {label}
              </span>
              <Kbd className="max-sm:hidden">{key}</Kbd>
            </Button>
          ))}
        </div>
        {kind !== "cash" && (
          <Field>
            <FieldLabel htmlFor="refund-reference">
              {kind === "card" ? "Card reference" : "MoMo reference"}
            </FieldLabel>
            <Input
              autoComplete="off"
              id="refund-reference"
              maxLength={100}
              onChange={(event) => onReference(event.target.value)}
              touch
              value={reference}
            />
            <FieldDescription>{helper[kind]}</FieldDescription>
          </Field>
        )}
        {kind === "cash" && <p className="text-xs text-muted-foreground">{helper.cash}</p>}
      </div>
    </section>
  );
}
