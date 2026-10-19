import { useRef, useState } from "react";
import { formatGHS } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { takenTender } from "../../../../sale/void";
import type { Approval, ApproverState, DraftView, SaleOutcome } from "../../../../sale/types";
import { VoidForm } from "./void";

type Target = { view: DraftView; id: string; revision: number; name: string };

export function HeldDialog({
  views,
  open,
  canVoid,
  approvers,
  onOpenChange,
  onReturnFocus,
  onResume,
  onVoid,
  onLoadApprovers,
}: {
  views: DraftView[];
  open: boolean;
  canVoid: boolean;
  approvers: ApproverState;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
  onResume: (id: string, revision: number) => void;
  onVoid: (
    id: string,
    revision: number,
    reason: string,
    approval?: Approval,
  ) => Promise<SaleOutcome>;
  onLoadApprovers: () => void;
}) {
  const [target, setTarget] = useState<Target | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  async function submitVoid(chosen: Target, reason: string, approval?: Approval) {
    const outcome = await onVoid(chosen.id, chosen.revision, reason, approval);
    if (outcome.ok) {
      setTarget(null);
      onOpenChange(false);
    }
    return outcome;
  }
  function chooseVoid(next: Target) {
    // A held sale that already took cash or a card needs a manager, like the open basket does.
    if (takenTender(next.view.draft)) onLoadApprovers();
    setTarget(next);
  }
  // The map is registered once, so it asks the form (mounted only while a sale is being voided) and not `target`.
  const shortcuts = useShortcuts(
    open && canVoid
      ? {
          F11: () => {
            if (formRef.current) return formRef.current.requestSubmit();
            document.activeElement
              ?.closest("li")
              ?.querySelector<HTMLButtonElement>("[data-held-void]")
              ?.click();
          },
          Escape: () => {
            if (formRef.current) setTarget(null);
          },
        }
      : {},
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={target ? "void-sale-help" : "held-sales-help"}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        onEscapeKeyDown={(event) => target && event.preventDefault()}
        ref={shortcuts}
        showCloseButton={false}
      >
        {target ? (
          <VoidForm
            approval={takenTender(target.view.draft)}
            approvers={approvers}
            held={{ name: target.name, onBack: () => setTarget(null), formRef }}
            onRetryApprovers={onLoadApprovers}
            onSubmit={(reason, approval) => submitVoid(target, reason, approval)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Held sales</DialogTitle>
              <DialogDescription id="held-sales-help">
                Choose a saved basket to continue.
              </DialogDescription>
            </DialogHeader>
            {views.length ? (
              <ul className="grid gap-2">
                {views.map((view) => {
                  const draft = view.draft;
                  if (!draft) return null;
                  const name =
                    draft.name ||
                    view.quote.lines.find((line) => "name" in line)?.name ||
                    "Held sale";
                  return (
                    <li className="grid grid-cols-1 gap-2 sm:grid-cols-5" key={draft.id}>
                      <Button
                        className="w-full min-w-0 justify-between sm:col-span-4"
                        variant="outline"
                        onClick={() => onResume(draft.id, draft.revision)}
                        size="touch"
                      >
                        <span>Resume {name}</span>
                        <span className="tabular-nums">{formatGHS(view.quote.totals.gross)}</span>
                      </Button>
                      {canVoid && (
                        <Button
                          aria-keyshortcuts="F11"
                          aria-label={`Void ${name}`}
                          className="w-full sm:col-span-1"
                          data-held-void
                          onClick={() =>
                            chooseVoid({ view, id: draft.id, revision: draft.revision, name })
                          }
                          size="touch"
                          variant="ghost"
                        >
                          Void <Kbd>F11</Kbd>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No held sales on this register.</p>
            )}
            {!canVoid && (
              <p className="text-sm text-muted-foreground" role="status">
                Manager permission is required to void a sale.
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
