import type { Money } from "@shopper/money";
import type { SaleSnapshot } from "../../../sale/types";
import { CardDialog } from "./dialogs/card";
import { HeldDialog } from "./dialogs/held";
import { MomoDialog } from "./dialogs/momo";
import { VoidDialog } from "./dialogs/void";

export function TenderOverlays({
  amount,
  offline,
  cardOpen,
  momoOpen,
  heldOpen,
  voidOpen,
  held,
  onReturnFocus,
  onCardOpenChange,
  onCardSubmit,
  onMomoOpenChange,
  onMomoSubmit,
  onHeldOpenChange,
  onResume,
  canVoid,
  onHeldVoid,
  onVoidOpenChange,
  onVoidSubmit,
}: {
  amount: Money;
  offline: boolean;
  cardOpen: boolean;
  momoOpen: boolean;
  heldOpen: boolean;
  voidOpen: boolean;
  held: SaleSnapshot["held"];
  onReturnFocus: () => void;
  onCardOpenChange: (open: boolean) => void;
  onCardSubmit: (approvalCode: string, last4: string) => void;
  onMomoOpenChange: (open: boolean) => void;
  onMomoSubmit: (phone: string, network: "mtn" | "telecel" | "airteltigo") => void;
  onHeldOpenChange: (open: boolean) => void;
  onResume: (id: string, revision: number) => void;
  canVoid: boolean;
  onHeldVoid: (id: string, revision: number, reason: string) => void;
  onVoidOpenChange: (open: boolean) => void;
  onVoidSubmit: (reason: string) => void;
}) {
  return (
    <>
      <CardDialog
        amount={amount}
        onReturnFocus={onReturnFocus}
        onOpenChange={onCardOpenChange}
        onSubmit={onCardSubmit}
        open={cardOpen}
      />
      <MomoDialog
        amount={amount}
        offline={offline}
        onReturnFocus={onReturnFocus}
        onOpenChange={onMomoOpenChange}
        onSubmit={onMomoSubmit}
        open={momoOpen}
      />
      <HeldDialog
        views={held}
        open={heldOpen}
        canVoid={canVoid}
        onReturnFocus={onReturnFocus}
        onOpenChange={onHeldOpenChange}
        onResume={onResume}
        onVoid={onHeldVoid}
      />
      <VoidDialog
        open={voidOpen}
        onOpenChange={onVoidOpenChange}
        onReturnFocus={onReturnFocus}
        onSubmit={onVoidSubmit}
      />
    </>
  );
}
