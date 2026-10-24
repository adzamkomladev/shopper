import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { formatGHS, money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { SEGMENTS, STATUS_LABELS } from "../../../lib/kyc/status";
import { shiftTime } from "../../../lib/shifts/format";
import { useKycActions } from "../../../queries/kyc/actions";
import type { KycDetail } from "../../../schemas/kyc";
import { ReadOnlyNote } from "../../admin/states";
import { DecisionForm } from "./form";

type Props = {
  kase: KycDetail;
  /** Holds `kyc.approve`. */
  canApprove: boolean;
  roles: { value: string; label: string }[];
};

const WAITING: Partial<Record<KycDetail["status"], string>> = {
  otp_sent: "The phone has not been verified yet. The check can be decided once it is.",
  id_needed: "The phone is verified. The check can be decided once the ID step is done.",
  expired:
    "This check ran out of time before it was decided. Start a new one if it is still needed.",
};

/** The decision: A approves, R rejects, Mod+Enter confirms. Decided and waiting checks show where they stand instead. */
export function DecisionPanel({ kase, canApprove, roles }: Props) {
  const online = useOnline();
  const navigate = useNavigate();
  const { decide } = useKycActions();
  const [choice, setChoice] = useState<"approve" | "reject">();
  const deciding = kase.status === "review" && canApprove;
  const choose = (next: "approve" | "reject") => {
    if (!deciding || decide.isPending) return;
    decide.reset();
    setChoice(next);
  };
  const shortcuts = useShortcuts({ A: () => choose("approve"), R: () => choose("reject") });
  const submit = (body: unknown) =>
    decide.mutate(
      { id: kase.id, body },
      {
        onSuccess: (decided) => {
          toast.success(decided.status === "approved" ? "Check approved" : "Check rejected");
          const segment = SEGMENTS.find((each) => each.statuses.includes(decided.status))?.value;
          void navigate({ to: "/kyc", search: segment ? { segment } : {} });
        },
      },
    );
  return (
    <section
      ref={shortcuts}
      aria-label="Decision"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold tracking-tight">Decision</h2>
      {kase.status === "review" ? (
        canApprove ? (
          <>
            <div className="flex flex-wrap gap-3">
              <Button
                variant={choice === "approve" ? "default" : "outline"}
                aria-pressed={choice === "approve"}
                onClick={() => choose("approve")}
              >
                Approve
                <Kbd aria-hidden>A</Kbd>
              </Button>
              <Button
                variant={choice === "reject" ? "destructive" : "outline"}
                aria-pressed={choice === "reject"}
                onClick={() => choose("reject")}
              >
                Reject
                <Kbd aria-hidden>R</Kbd>
              </Button>
            </div>
            {!online && (
              <p role="status" className="text-sm text-muted-foreground">
                You're offline. Reconnect to approve or reject.
              </p>
            )}
            {choice && (
              <DecisionForm
                key={choice}
                kase={kase}
                approve={choice === "approve"}
                roles={roles}
                pending={decide.isPending}
                error={decide.error?.message}
                onSubmit={submit}
                onClearError={() => decide.isError && decide.reset()}
              />
            )}
          </>
        ) : (
          <ReadOnlyNote>
            You can view this check. Ask an owner for permission to approve or reject it.
          </ReadOnlyNote>
        )
      ) : (
        <Outcome kase={kase} />
      )}
    </section>
  );
}

function Outcome({ kase }: { kase: KycDetail }) {
  if (!kase.decidedAt)
    return <p className="text-sm text-muted-foreground">{WAITING[kase.status]}</p>;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-medium">
        {STATUS_LABELS[kase.status]} {shiftTime(kase.decidedAt)}
        {kase.approvedLimit ? ` with a limit of ${formatGHS(money(kase.approvedLimit))}` : ""}
      </p>
      {kase.decisionNote && <p className="text-muted-foreground">{kase.decisionNote}</p>}
      {kase.idType && (
        <p className="text-muted-foreground">
          {kase.idSighted
            ? "The approver sighted the ID document."
            : "The ID document was not sighted."}
        </p>
      )}
    </div>
  );
}
