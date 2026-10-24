import { Banknote, CreditCard, HandCoins, Smartphone, Star, type LucideIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import type { TenderMethod } from "../../../sale/account/types";

const methods: { kind: TenderMethod; label: string; icon: LucideIcon; key: string }[] = [
  { kind: "cash", label: "Cash", icon: Banknote, key: "Alt+1" },
  { kind: "momo", label: "MoMo", icon: Smartphone, key: "Alt+2" },
  { kind: "card", label: "Card", icon: CreditCard, key: "Alt+3" },
  { kind: "credit", label: "On account", icon: HandCoins, key: "Alt+5" },
  { kind: "loyalty", label: "Points", icon: Star, key: "Alt+6" },
];

/**
 * Why a method is off, in words for the cashier. On account and Points need a customer and the server.
 * `accountShown` is false for the common case of no customer yet: the Add customer tile is right there, so
 * that reason is read out and in the tooltip but takes no line from the till-size panel.
 */
export function methodReasons({
  offline,
  canMomo,
  hasCustomer,
}: {
  offline: boolean;
  canMomo: boolean;
  hasCustomer: boolean;
}) {
  const account = !hasCustomer
    ? "Add a customer to sell on account or with points"
    : offline
      ? "Needs a connection"
      : null;
  const momo = offline
    ? "Mobile money needs an internet connection."
    : canMomo
      ? null
      : "Mobile money permission is required for this register.";
  return { momo, account, accountShown: hasCustomer };
}

const group = (kind: TenderMethod) =>
  kind === "momo" ? "momo" : kind === "credit" || kind === "loyalty" ? "account" : null;

export function TenderMethods({
  selected,
  reasons,
  onSelect,
}: {
  selected: TenderMethod;
  reasons: ReturnType<typeof methodReasons>;
  onSelect: (kind: TenderMethod) => void;
}) {
  const shown = [reasons.momo, reasons.accountShown ? reasons.account : null].some(Boolean);
  return (
    <>
      <div
        aria-label="Payment methods"
        className="grid grid-cols-3 gap-2 sm:grid-cols-5"
        role="group"
      >
        {methods.map(({ kind, label, icon: Icon, key }) => {
          const reason = group(kind) ? reasons[group(kind)!] : null;
          return (
            <Button
              key={kind}
              aria-describedby={reason ? `tender-reason-${group(kind)}` : undefined}
              aria-keyshortcuts={key}
              aria-pressed={selected === kind}
              className="h-11 min-w-0 gap-1.5 px-1 text-sm has-[>svg]:px-1 2xl:has-[>svg]:px-2"
              disabled={!!reason}
              onClick={() => onSelect(kind)}
              size="touch"
              title={`${label} (${key})`}
              variant={selected === kind ? "default" : "outline"}
            >
              {/* Five across leave no room for a glyph on a till-size panel. */}
              <Icon aria-hidden="true" className="hidden size-4 shrink-0 max-sm:block 2xl:block" />
              <span className="truncate">{label}</span>
            </Button>
          );
        })}
      </div>
      {shown && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {reasons.momo && <p id="tender-reason-momo">{reasons.momo}</p>}
          {reasons.accountShown && reasons.account && (
            <p id="tender-reason-account">{reasons.account}</p>
          )}
        </div>
      )}
      {!reasons.accountShown && (
        <p className="sr-only" id="tender-reason-account">
          {reasons.account}
        </p>
      )}
    </>
  );
}
