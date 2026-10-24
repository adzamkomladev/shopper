import {
  FileText,
  History,
  Pause,
  ScanBarcode,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { CustomerControls } from "../../hooks/sale/customer/types";
import type { SaleControls } from "../../sale/types";

type Tile = {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  disabled: boolean;
  /** Why the tile is off, when it is the cashier's access and not the state of the sale that turns it off. */
  reason?: string | null;
  onClick: () => void;
};

/**
 * Figma "Sale actions": one tile per action the register can do today. Add custom item, Add discount and
 * Arrange delivery wait for their modules.
 */
export function SaleTiles({
  controls,
  customer,
  onScan,
}: {
  controls: SaleControls;
  customer: CustomerControls;
  onScan: () => void;
}) {
  const unavailable = customer.locked || !customer.canRead;
  const tiles: Tile[] = [
    { label: "Scan product", shortcut: "F2", icon: ScanBarcode, disabled: false, onClick: onScan },
    {
      label: customer.customer ? "Change customer" : "Add customer",
      shortcut: "Alt+U",
      icon: customer.customer ? UserRound : UserPlus,
      disabled: unavailable,
      reason: customer.reason,
      onClick: () => customer.open("attach"),
    },
    {
      label: "Create invoice",
      shortcut: "Alt+I",
      icon: FileText,
      disabled: unavailable,
      reason: customer.reason,
      onClick: () => customer.open("invoice"),
    },
    {
      label: "Hold sale",
      shortcut: "F6",
      icon: Pause,
      disabled: controls.locked || !controls.hasDraft,
      onClick: controls.hold,
    },
    {
      label: "Held sales",
      shortcut: "F7",
      icon: History,
      disabled: controls.locked,
      onClick: controls.showHeld,
    },
  ];
  return (
    <ul aria-label="Sale actions" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {tiles.map(({ label, shortcut, icon: Icon, disabled, reason, onClick }) => (
        <li className="contents" key={label}>
          <Button
            aria-keyshortcuts={shortcut}
            aria-label={label}
            className={cn(
              "h-24 w-full flex-col items-stretch justify-between rounded-panel border-border bg-card p-4 text-lg sm:h-32",
              // A reason has to be readable, so a tile turned off by access keeps its full colour.
              reason && "disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
            )}
            disabled={disabled}
            onClick={onClick}
            variant="outline"
          >
            <span className="flex items-center justify-between">
              <Icon aria-hidden="true" className="text-primary" />
              <Kbd className="pointer-coarse:inline-flex">{shortcut}</Kbd>
            </span>
            <span className="text-left leading-tight whitespace-normal">
              {label}
              {reason && <span className="block text-xs font-normal">{reason}</span>}
            </span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
