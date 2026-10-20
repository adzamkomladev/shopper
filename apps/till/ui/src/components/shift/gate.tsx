import type { ReactNode } from "react";
import { Calculator, Lock } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { takeFocus } from "../../hooks/focus";
import type { ShiftPhase } from "../../shift/types";

/** Figma "Register closed": what the Checkout tab shows when no shift is open, or the drawer is counted. */
function ShiftGate({
  phase,
  canWrite,
  active,
  onOpen,
  onClose,
}: {
  phase: "closed" | "counting";
  /** The user holds shift.write; without it there is nothing to offer but who to ask. */
  canWrite: boolean;
  active: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const counting = phase === "counting";
  const register = useShortcuts(
    active && canWrite ? { [counting ? "Alt+Z" : "Alt+O"]: counting ? onClose : onOpen } : {},
  );
  const ref = (node: HTMLElement | null) => {
    const cleanup = register(node);
    takeFocus(node, active);
    return cleanup;
  };
  const Icon = counting ? Calculator : Lock;
  return (
    <main aria-label="Sale" className="h-full min-h-0 outline-none" ref={ref} tabIndex={-1}>
      <Empty className="h-full rounded-panel border border-solid bg-card shadow-sm">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle className="text-3xl font-bold tracking-tight" role="heading" aria-level={1}>
            {counting ? "Drawer counted" : "Register closed"}
          </EmptyTitle>
          <EmptyDescription>
            {counting
              ? "The drawer is counted. Close the shift to finish."
              : "Open a shift to start selling."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          {canWrite ? (
            <Button
              aria-keyshortcuts={counting ? "Alt+Z" : "Alt+O"}
              autoFocus
              onClick={counting ? onClose : onOpen}
              size="touch"
            >
              {counting ? "Close shift" : "Open shift"}{" "}
              <Kbd className="max-sm:hidden">{counting ? "Alt+Z" : "Alt+O"}</Kbd>
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ask a manager to {counting ? "close" : "open"} the shift.
            </p>
          )}
        </EmptyContent>
      </Empty>
    </main>
  );
}

/** The Checkout tab: the sale screen while a shift is open, and the closed or counting notice otherwise. */
export function CheckoutGate({
  phase,
  canWrite,
  active,
  onOpen,
  onClose,
  children,
}: {
  phase: ShiftPhase;
  canWrite: boolean;
  active: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return phase === "closed" || phase === "counting" ? (
    <ShiftGate
      active={active}
      canWrite={canWrite}
      onClose={onClose}
      onOpen={onOpen}
      phase={phase}
    />
  ) : (
    children
  );
}
