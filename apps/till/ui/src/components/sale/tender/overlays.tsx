import type { Money } from "@shopper/money";
import type {
  Approval,
  ApproverState,
  SaleControls,
  SaleOutcome,
  SaleSnapshot,
} from "../../../sale/types";
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
  voidApproval,
  approvers,
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
  onRetryApprovers,
}: {
  amount: Money;
  offline: boolean;
  cardOpen: boolean;
  momoOpen: boolean;
  heldOpen: boolean;
  voidOpen: boolean;
  voidApproval: SaleControls["voidApproval"];
  approvers: ApproverState;
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
  onVoidSubmit: (reason: string, approval?: Approval) => Promise<SaleOutcome>;
  onRetryApprovers: () => void;
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
        approval={voidApproval}
        approvers={approvers}
        open={voidOpen}
        onOpenChange={onVoidOpenChange}
        onRetryApprovers={onRetryApprovers}
        onReturnFocus={onReturnFocus}
        onSubmit={onVoidSubmit}
      />
    </>
  );
}
