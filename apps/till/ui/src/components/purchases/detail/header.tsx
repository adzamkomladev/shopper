import { CircleCheck, Info, ReceiptText, Undo2 } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import type { PurchaseDetails } from "@shopper/sync/bridge";
import { accraDateTime } from "../../../purchases/format";
import { windowLine } from "../../../purchases/policy";
import type { PurchaseOutput, ReprintFeedback } from "../../../sale/types";
import { ReprintButton } from "./receipt";

type Props = {
  purchase: PurchaseDetails;
  output: PurchaseOutput | null;
  reprint: ReprintFeedback | null;
  /** Why Start return cannot run; null when it can. */
  returnBlocked: string | null;
  onReprint: () => void;
  onStartReturn: () => void;
};

/** Figma "Purchase identity": the receipt, its status and return window, who and when, then the two actions. */
export function DetailHeader({
  purchase,
  output,
  reprint,
  returnBlocked,
  onReprint,
  onStartReturn,
}: Props) {
  const receipt = purchase.receipt;
  const eligibility = purchase.eligibility;
  const reference =
    purchase.receiptNumber ?? receipt?.header.receiptNumber ?? purchase.id.slice(0, 8);
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-4 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex min-w-64 flex-1 items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <ReceiptText aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Purchase #{reference}</h2>
            <Badge
              variant={
                purchase.status === "voided"
                  ? "destructive"
                  : purchase.status === "completed"
                    ? "default"
                    : "secondary"
              }
            >
              {statusLabel(purchase.status)}
            </Badge>
          </div>
          {eligibility && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CircleCheck
                aria-hidden="true"
                className={eligibility.withinWindow ? "size-3.5 text-success" : "size-3.5"}
              />
              {windowLine(eligibility)}
            </p>
          )}
          {purchase.origin === "server" && (
            <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Info aria-hidden="true" className="size-3.5" />
              Sold on another register
            </p>
          )}
        </div>
      </div>
      <Fact label="Purchased" value={accraDateTime(purchase.occurredAt)} />
      {receipt?.header.cashier && <Fact label="Cashier" value={receipt.header.cashier} />}
      {receipt?.header.branch && <Fact label="Branch" value={receipt.header.branch} />}
      <div className="flex flex-wrap items-center gap-2">
        {purchase.delivery && (
          <ReprintButton label="Reprint" onClick={onReprint} output={output} reprint={reprint} />
        )}
        {eligibility && (
          <Button
            aria-describedby={returnBlocked ? "return-reason" : undefined}
            aria-keyshortcuts="Alt+E"
            disabled={!!returnBlocked}
            onClick={onStartReturn}
            size="touch"
            type="button"
            variant="destructive"
          >
            <Undo2 aria-hidden="true" />
            Start return <Kbd className="max-sm:hidden">Alt+E</Kbd>
          </Button>
        )}
      </div>
    </header>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function statusLabel(status: PurchaseDetails["status"]) {
  return status === "pending" ? "Pending" : status === "voided" ? "Voided" : "Completed";
}
