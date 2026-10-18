import { History, Pause, ScanBarcode, type LucideIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { SaleControls } from "../../sale/types";

type Tile = {
  label: string;
  shortcut: string;
  icon: LucideIcon;
  disabled: boolean;
  onClick: () => void;
};

/**
 * Figma "Sale actions": one tile per action the register can do today. Add customer, Add custom item,
 * Add discount, Create invoice and Arrange delivery wait for their modules.
 */
export function SaleTiles({ controls, onScan }: { controls: SaleControls; onScan: () => void }) {
  const tiles: Tile[] = [
    { label: "Scan product", shortcut: "F2", icon: ScanBarcode, disabled: false, onClick: onScan },
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
      {tiles.map(({ label, shortcut, icon: Icon, disabled, onClick }) => (
        <li className="contents" key={label}>
          <Button
            aria-keyshortcuts={shortcut}
            aria-label={label}
            className="h-24 w-full flex-col items-stretch justify-between rounded-panel border-border bg-card p-4 text-lg sm:h-32"
            disabled={disabled}
            onClick={onClick}
            variant="outline"
          >
            <span className="flex items-center justify-between">
              <Icon aria-hidden="true" className="text-primary" />
              <Kbd className="pointer-coarse:inline-flex">{shortcut}</Kbd>
            </span>
            <span className="text-left">{label}</span>
          </Button>
        </li>
      ))}
    </ul>
  );
}
