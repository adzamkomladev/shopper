import { useState } from "react";
import { formatGHS } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shopper/ui/components/dialog";
import { Kbd } from "@shopper/ui/components/kbd";
import { Textarea } from "@shopper/ui/components/textarea";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { DraftView } from "../../../../sale/types";

export function HeldDialog({
  views,
  open,
  canVoid,
  onOpenChange,
  onReturnFocus,
  onResume,
  onVoid,
}: {
  views: DraftView[];
  open: boolean;
  canVoid: boolean;
  onOpenChange: (open: boolean) => void;
  onReturnFocus: () => void;
  onResume: (id: string, revision: number) => void;
  onVoid: (id: string, revision: number, reason: string) => void;
}) {
  const [voidTarget, setVoidTarget] = useState<{
    id: string;
    revision: number;
    name: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  function submitVoid() {
    if (!voidTarget || !reason.trim()) return;
    onVoid(voidTarget.id, voidTarget.revision, reason.trim());
    setVoidTarget(null);
    setReason("");
    onOpenChange(false);
  }
  const shortcuts = useShortcuts(
    open && canVoid
      ? {
          F11: () => {
            if (voidTarget) return submitVoid();
            document.activeElement
              ?.closest("li")
              ?.querySelector<HTMLButtonElement>("[data-held-void]")
              ?.click();
          },
          Escape: () => {
            if (voidTarget) setVoidTarget(null);
          },
        }
      : {},
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby="held-sales-help"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
        ref={shortcuts}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{voidTarget ? "Void sale" : "Held sales"}</DialogTitle>
          <DialogDescription id="held-sales-help">
            {voidTarget
              ? `Record why ${voidTarget.name} is being voided.`
              : "Choose a saved basket to continue."}
          </DialogDescription>
        </DialogHeader>
        {voidTarget ? (
          <>
            <label className="grid gap-2 text-sm font-medium">
              Reason
              <Textarea
                autoFocus
                className="min-h-24"
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <DialogFooter>
              <Button
                aria-keyshortcuts="Escape"
                onClick={() => setVoidTarget(null)}
                size="touch"
                variant="outline"
              >
                Back to held sales <Kbd>Escape</Kbd>
              </Button>
              <Button
                aria-keyshortcuts="F11"
                disabled={!reason.trim()}
                onClick={submitVoid}
                size="touch"
                variant="destructive"
              >
                Void sale <Kbd>F11</Kbd>
              </Button>
            </DialogFooter>
          </>
        ) : views.length ? (
          <ul className="grid gap-2">
            {views.map((view) => {
              const draft = view.draft;
              if (!draft) return null;
              const name =
                draft.name || view.quote.lines.find((line) => "name" in line)?.name || "Held sale";
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
                      onClick={() => {
                        setReason("");
                        setVoidTarget({ id: draft.id, revision: draft.revision, name });
                      }}
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
        {!canVoid && !voidTarget && (
          <p className="text-sm text-muted-foreground" role="status">
            Manager permission is required to void a sale.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
