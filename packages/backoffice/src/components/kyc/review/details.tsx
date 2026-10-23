import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CircleCheckIcon, TriangleAlertIcon } from "lucide-react";
import { money } from "@shopper/money";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { formatGHS } from "@shopper/money";
import { focusOnMount } from "../../../lib/focus";
import { ID_LABELS } from "../../../lib/kyc/ids";
import { SEGMENTS, STATUS_LABELS } from "../../../lib/kyc/status";
import { shiftTime } from "../../../lib/shifts/format";
import type { KycDetail } from "../../../schemas/kyc";

/** Back to the segment this check is listed under. */
export function BackToChecks({ status }: { status?: KycDetail["status"] }) {
  const segment = SEGMENTS.find((each) => status && each.statuses.includes(status))?.value;
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-3 self-start text-muted-foreground">
      <Link to="/kyc" search={segment ? { segment } : {}}>
        <ArrowLeftIcon aria-hidden />
        Back to identity checks
      </Link>
    </Button>
  );
}

type HeaderProps = { kase: KycDetail; title: string; subtitle: string };

export function ReviewHeader({ kase, title, subtitle }: HeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      <BackToChecks status={kase.status} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Focused on arrival, so A and R work straight after opening the check. */}
        <h1
          tabIndex={-1}
          ref={focusOnMount}
          className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
        >
          {title}
        </h1>
        <Badge variant={kase.status === "review" ? "secondary" : "outline"}>
          {STATUS_LABELS[kase.status]}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}

type DetailsProps = { kase: KycDetail; asked: string };

/** What the approver is looking at: the phone that was verified, what is asked for, and the ID as far as it is shown. */
export function CheckDetails({ kase, asked }: DetailsProps) {
  const verified = kase.status !== "otp_sent";
  const rows: [string, React.ReactNode][] = [
    [
      "Phone",
      <span key="phone" className="flex flex-wrap items-center gap-2">
        {kase.phone}
        {verified ? (
          <Badge variant="outline">
            <CircleCheckIcon className="text-success" aria-hidden />
            Verified
          </Badge>
        ) : (
          <Badge variant="outline">Not verified yet</Badge>
        )}
      </span>,
    ],
    ["Asked for", asked],
    ...idRows(kase),
    ["Opened", shiftTime(kase.createdAt)],
    ...(kase.status === "review" && kase.decisionDueAt
      ? [["Decide by", shiftTime(kase.decisionDueAt)] as [string, string]]
      : []),
  ];
  return (
    <section aria-label="Check details" className="rounded-lg border bg-card p-5 shadow-sm">
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function idRows(kase: KycDetail): [string, string][] {
  if (!kase.idType)
    return [
      [
        "ID",
        kase.status === "otp_sent" || kase.status === "id_needed"
          ? "Not given yet"
          : "No ID provided",
      ],
    ];
  return [
    ["ID type", ID_LABELS[kase.idType]],
    ["ID number", kase.idMasked ?? ""],
    ["Name on the ID", kase.fullName ?? ""],
  ];
}

/** Other checks that carry the same ID number: a shared document is worth a second look before approving. */
export function Duplicates({ kase }: { kase: KycDetail }) {
  if (kase.duplicates.length === 0) return null;
  const many = kase.duplicates.length > 1;
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon aria-hidden />
      <AlertTitle>This ID is on another check</AlertTitle>
      <AlertDescription>
        <p>
          {many ? `${kase.duplicates.length} other checks use` : "One other check uses"} the same ID
          number. Make sure it belongs to this person before you approve.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {kase.duplicates.map((other, index) => (
            <li key={other.caseId}>
              <Button asChild variant="outline" size="sm">
                <Link to="/kyc/$caseId" params={{ caseId: other.caseId }}>
                  Open check{many ? ` ${index + 1}` : ""}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/** The limit that was asked for, or the role. */
export const askedFor = (kase: KycDetail, roleName?: string) =>
  kase.requestedLimit
    ? `Credit limit ${formatGHS(money(kase.requestedLimit))}`
    : `Role: ${roleName ?? "as requested"}`;
