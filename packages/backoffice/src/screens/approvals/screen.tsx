import { Suspense, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useNow } from "@shopper/ui/hooks/use-now";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { DeclineDialog } from "../../components/approvals/decline";
import {
  APPROVAL_ATTRIBUTE,
  ApprovalList,
  approvalButtonId,
} from "../../components/approvals/list";
import { ApprovalsSkeleton, NoApprovals } from "../../components/approvals/states";
import { Gate, OfflineNote } from "../../components/register/states";
import { focusIfIdle } from "../../lib/focus";
import { pendingApprovalsQuery, useDecideApproval } from "../../queries/approvals/inbox";
import type { ApprovalRow } from "../../schemas/approvals";

/** Refunds and discounts the tills are waiting on; A approves and D declines the focused (or first) request. */
export function ApprovalsScreen() {
  const online = useOnline();
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="grid gap-1">
        <h1
          tabIndex={-1}
          ref={focusIfIdle}
          className="text-3xl font-bold tracking-tight outline-none"
        >
          Approvals
        </h1>
        <p className="text-sm text-muted-foreground">
          Answer a till's request while the cashier waits. A approves, D declines.
        </p>
      </div>
      <Gate
        need={["refund.approve", "sale.discount"]}
        what="approvals"
        verb="answer"
        fallback={<ApprovalsSkeleton />}
      >
        {!online && <OfflineNote>Answering a request needs a connection.</OfflineNote>}
        <Suspense fallback={<ApprovalsSkeleton />}>
          <Inbox online={online} />
        </Suspense>
      </Gate>
    </div>
  );
}

function Inbox({ online }: { online: boolean }) {
  const { data } = useSuspenseQuery(pendingApprovalsQuery());
  const now = useNow(15_000);
  const decide = useDecideApproval();
  const [declining, setDeclining] = useState<ApprovalRow>();
  const busy = decide.isPending || !online;
  const rows = data.approvals.filter((row) => Date.parse(row.expiresAt) > now);
  const target = () => {
    const id = document.activeElement
      ?.closest(`[${APPROVAL_ATTRIBUTE}]`)
      ?.getAttribute(APPROVAL_ATTRIBUTE);
    return rows.find((row) => row.id === id) ?? rows[0];
  };
  const approve = (row?: ApprovalRow) =>
    row &&
    !busy &&
    decide.mutate(
      { id: row.id, decision: { decision: "approved" } },
      { onSuccess: () => refocus(row.id) },
    );
  const shortcuts = useShortcuts({
    A: () => approve(target()),
    D: () => !busy && setDeclining(target()),
  });
  // The answered request leaves the list: focus moves to the next one's Approve, or the heading.
  const refocus = (answered = declining?.id) =>
    (
      document.getElementById(
        approvalButtonId(rows.find((row) => row.id !== answered)?.id ?? "", "approve"),
      ) ?? document.querySelector<HTMLElement>("main h1")
    )?.focus();
  return (
    <div ref={shortcuts} className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <NoApprovals />
      ) : (
        <ApprovalList
          approvals={rows}
          now={now}
          offline={!online}
          pendingId={decide.isPending ? decide.variables.id : undefined}
          onApprove={approve}
          onDecline={setDeclining}
        />
      )}
      <DeclineDialog
        open={!!declining}
        busy={decide.isPending}
        onOpenChange={(open) => !open && setDeclining(undefined)}
        restoreFocus={() => refocus()}
        onDecline={(reason) =>
          declining &&
          decide.mutate(
            { id: declining.id, decision: { decision: "declined", reason } },
            { onSuccess: () => setDeclining(undefined) },
          )
        }
      />
    </div>
  );
}
