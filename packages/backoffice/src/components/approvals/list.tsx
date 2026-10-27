import { CheckIcon, XIcon } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Card } from "@shopper/ui/components/card";
import type { ApprovalRow } from "../../schemas/approvals";

/** The approval a keyboard shortcut answers: the one holding focus, else the first. */
export const APPROVAL_ATTRIBUTE = "data-approval";
export const approvalButtonId = (id: string, decision: "approve" | "decline") =>
  `approval-${decision}-${id}`;

type Props = {
  approvals: ApprovalRow[];
  now: number;
  /** Offline, nothing can be answered. */
  offline: boolean;
  /** The request being answered: only its buttons wait, so focus can move on to the next. */
  pendingId?: string;
  onApprove: (row: ApprovalRow) => void;
  onDecline: (row: ApprovalRow) => void;
};

/** Each request: what, how much, why, who asked and how long it has left, with Approve and Decline. */
export function ApprovalList({ approvals, now, offline, pendingId, onApprove, onDecline }: Props) {
  return (
    <ul className="grid gap-4" aria-label="Pending approvals">
      {approvals.map((row) => {
        const minutes = Math.max(0, Math.ceil((Date.parse(row.expiresAt) - now) / 60_000));
        const title = `${row.kind === "refund" ? "Refund" : "Discount"} of ${formatGHS(money(row.subject.amount))}`;
        return (
          <li key={row.id} {...{ [APPROVAL_ATTRIBUTE]: row.id }}>
            <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid min-w-0 gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{title}</h2>
                  <Badge variant="outline">
                    {minutes === 0 ? "Expiring" : `${minutes} min left`}
                  </Badge>
                </div>
                <p className="text-sm wrap-break-word">{row.subject.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {row.requesterName ?? "A cashier"}
                  {row.subject.receiptNumber ? ` · receipt ${row.subject.receiptNumber}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  id={approvalButtonId(row.id, "decline")}
                  variant="outline"
                  disabled={offline || row.id === pendingId}
                  onClick={() => onDecline(row)}
                  aria-label={`Decline ${title.toLowerCase()}`}
                >
                  <XIcon aria-hidden />
                  Decline
                </Button>
                <Button
                  id={approvalButtonId(row.id, "approve")}
                  disabled={offline || row.id === pendingId}
                  onClick={() => onApprove(row)}
                  aria-label={`Approve ${title.toLowerCase()}`}
                >
                  <CheckIcon aria-hidden />
                  Approve
                </Button>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
