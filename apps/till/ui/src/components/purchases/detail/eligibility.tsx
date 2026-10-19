import { CircleAlert, CircleCheck, CircleSlash } from "lucide-react";
import { formatGHS, money } from "@shopper/money";
import { cn } from "cn";
import { accraDateTime, accraDay, tenderLabel } from "../../../purchases/format";
import { approvalReason, lineCounts } from "../../../purchases/policy";
import type { EligibilityView, RefundSummary } from "../../../sale/types";

/** Figma "Return eligibility": the window, what can still go back, earlier refunds and who must approve. */
export function DetailEligibility({
  eligibility,
  refunds,
  kinds,
  block,
}: {
  eligibility: EligibilityView;
  refunds: RefundSummary[];
  kinds: string[];
  /** Why a return cannot start, shown in place of the count. */
  block: string | null;
}) {
  const counts = lineCounts(eligibility);
  const finalNames = eligibility.lines.filter((line) => line.status === "final").map((l) => l.name);
  const manager = approvalReason(eligibility);
  return (
    <section aria-label="Return eligibility" className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Return eligibility</h3>
        <p className="text-xs text-muted-foreground">
          {eligibility.withinWindow ? "Window closes" : "Window closed"}{" "}
          {accraDay(eligibility.windowEndsAt)}
        </p>
      </div>
      <div className="grid gap-3 p-4 text-sm">
        <Summary
          block={block}
          eligible={counts.eligible}
          refunds={refunds.length}
          withinWindow={eligibility.withinWindow}
        />
        <dl className="grid gap-2">
          <Row label="Refund tender" value="Cash, card or MoMo" />
          <Row label="Paid with" value={kinds.map(tenderLabel).join(" + ") || "—"} />
          <Row label="Non-returnable" value={finalNames.join(", ") || "None"} />
          <Row
            label="Approval"
            value={manager ? "Manager PIN required" : "Supervisor for policy exceptions"}
          />
        </dl>
        {refunds.length > 0 && <Refunds refunds={refunds} />}
      </div>
    </section>
  );
}

function Summary({
  block,
  eligible,
  refunds,
  withinWindow,
}: {
  block: string | null;
  eligible: number;
  refunds: number;
  withinWindow: boolean;
}) {
  const Icon = block ? CircleSlash : withinWindow ? CircleCheck : CircleAlert;
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md p-3",
        block
          ? "bg-muted/50"
          : withinWindow
            ? "bg-success/10"
            : "border border-warning-border bg-warning text-warning-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("size-5 shrink-0", !block && withinWindow && "text-success")}
      />
      <div className="min-w-0">
        <p className="font-semibold" id={block ? "return-reason" : undefined}>
          {block ?? `${eligible} ${eligible === 1 ? "item" : "items"} eligible for return`}
        </p>
        <p className={cn("text-xs", block && "text-muted-foreground")}>
          {refunds === 0
            ? "No previous returns or refunds"
            : `${refunds} ${refunds === 1 ? "refund" : "refunds"} recorded`}
        </p>
      </div>
    </div>
  );
}

function Refunds({ refunds }: { refunds: RefundSummary[] }) {
  return (
    <ul aria-label="Previous refunds" className="grid gap-2 border-t pt-3">
      {refunds.map((refund) => {
        const state = refund.accepted
          ? "Accepted"
          : refund.blockedCode
            ? `Blocked: ${refund.blockedReason ?? refund.blockedCode}`
            : "Pending upload";
        return (
          <li className="grid gap-0.5 rounded-md bg-muted/50 p-3" key={refund.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">
                {tenderLabel(refund.tender.kind)}
                {"reference" in refund.tender ? ` · ${refund.tender.reference}` : ""}
              </span>
              <span className="font-bold tabular-nums">−{formatGHS(money(refund.total))}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {accraDateTime(refund.occurredAt)} · {refund.reason}
            </p>
            <p className={cn("text-xs font-medium", refund.blockedCode && "text-destructive")}>
              {state}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}
