import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CircleCheckIcon, CircleXIcon, ExternalLinkIcon } from "lucide-react";
import { focusOnMount, formatDate, shiftTime } from "@shopper/backoffice/kit";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import {
  CHECK_LABELS,
  DOCUMENT_LABELS,
  QUEUE_TABS,
  STATUS_LABELS,
  statusVariant,
} from "../../../lib/kyb/status";
import type { KybCase } from "../../../schemas/types";

export function ReviewHeader({ kase }: { kase: KybCase }) {
  const tab = QUEUE_TABS.find((status) => status === kase.status);
  return (
    <header className="flex flex-col gap-3">
      <Button asChild variant="ghost" size="sm" className="-ml-3 self-start text-muted-foreground">
        <Link to="/kyb" search={tab ? { status: tab } : {}}>
          <ArrowLeftIcon aria-hidden />
          Back to verifications
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Focused on arrival, so A and R work straight after opening the case. */}
        <h1
          tabIndex={-1}
          ref={focusOnMount}
          className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
        >
          {kase.businessName ?? kase.shop}
        </h1>
        <Badge variant={statusVariant(kase.status)}>{STATUS_LABELS[kase.status]}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {kase.shop}
        {kase.code ? ` · shop code ${kase.code}` : ""} · submission {kase.version}
      </p>
    </header>
  );
}

/** What the shop told us about the business and where its payouts go. */
export function BusinessDetails({ kase }: { kase: KybCase }) {
  const rows: [string, string][] = [
    ["Registration number", kase.registrationNumber ?? "Not given"],
    ["TIN", kase.tin ?? "Not given"],
    ["Payout bank code", kase.settlementBank ?? "Not given"],
    ["Payout account", kase.settlementAccount ?? "Not given"],
    ["Submitted", kase.submittedAt ? shiftTime(kase.submittedAt) : "Not yet"],
    ["Approval lapses", kase.expiresOn ? formatDate(kase.expiresOn) : "No expiry"],
  ];
  return (
    <Section label="Business">
      <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium wrap-break-word">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** The directors and the documents, each with a short-lived link to its scan. */
export function Evidence({ kase }: { kase: KybCase }) {
  const items = [
    ...kase.directors.map((director) => ({
      title: director.name,
      detail: `${director.ghanaCard} · expires ${formatDate(director.cardExpiresOn)}`,
      link: director.link,
      what: `${director.name}'s Ghana Card`,
    })),
    ...kase.documents.map((document) => ({
      title: DOCUMENT_LABELS[document.kind] ?? document.kind,
      detail: document.expiresOn ? `Expires ${formatDate(document.expiresOn)}` : "No expiry",
      link: document.link,
      what: DOCUMENT_LABELS[document.kind] ?? document.kind,
    })),
  ];
  return (
    <Section label="Directors and documents">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing has been uploaded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {items.map((item) => (
            <li
              key={item.what}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium wrap-break-word">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.detail}</span>
              </div>
              {item.link ? (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${item.what}`}
                  >
                    Open scan
                    <ExternalLinkIcon aria-hidden />
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Scan unavailable</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** The automated checks of this submission; a failure says why. */
export function Checks({ kase }: { kase: KybCase }) {
  return (
    <Section label="Automated checks">
      {kase.checks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          The checks have not run for this submission yet.
        </p>
      ) : (
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          {kase.checks.map((check) => (
            <li key={check.check} className="flex gap-2">
              {check.ok ? (
                <CircleCheckIcon
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-label="Passed"
                />
              ) : (
                <CircleXIcon
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                  aria-label="Failed"
                />
              )}
              <div className="flex flex-col">
                <span className="font-medium">{CHECK_LABELS[check.check] ?? check.check}</span>
                {check.reason && <span className="text-muted-foreground">{check.reason}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold tracking-tight">{label}</h2>
      {children}
    </section>
  );
}
