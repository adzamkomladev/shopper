import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { FormSheet } from "../../admin/form/sheet";
import { auditTime, commandLabel } from "../../../lib/audit/diff";
import type { AuditDetail, AuditItem } from "../../../schemas/audit";
import { AuditDiff } from "./diff";

type Props = {
  row?: AuditItem;
  /** The full entry once it has loaded. */
  entry?: AuditDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  /** Set when the entry could not be read, with a way to read it again. */
  readError?: { message: string; retry: () => void };
};

/** One entry: who did it, when, on which device, who approved it, and what changed. */
export function AuditEntrySheet({ row, entry, readError, ...sheet }: Props) {
  const shown = entry ?? row;
  return (
    <FormSheet
      {...sheet}
      title={shown ? commandLabel(shown.command) : "Audit entry"}
      description="Who did this, where, who approved it and what changed."
    >
      <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-4">
        {shown && (
          <dl className="grid gap-3 text-sm">
            <Field
              label="Who"
              value={`${shown.actor?.name ?? "System"}${shown.role ? ` · ${shown.role}` : ""}`}
            />
            <Field label="When" value={auditTime(shown.at)} />
            {shown.deviceTime && <Field label="Device clock" value={auditTime(shown.deviceTime)} />}
            <Field label="Device" value={shown.device?.name ?? "Back office"} />
            {shown.branch?.name && <Field label="Branch" value={shown.branch.name} />}
            <Field
              label="Approved by"
              value={
                shown.approver ? (
                  <Badge variant="secondary">{shown.approver.name ?? "A manager"}</Badge>
                ) : (
                  "No approval needed"
                )
              }
            />
            {shown.reason && <Field label="Reason" value={shown.reason} />}
          </dl>
        )}
        {entry ? (
          <>
            <section aria-labelledby="audit-changes" className="flex flex-col gap-2">
              <h3 id="audit-changes" className="text-sm font-semibold">
                What changed
              </h3>
              <AuditDiff before={entry.before} after={entry.after} />
            </section>
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold">Recorded details</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            </details>
            <dl className="grid gap-2 text-xs text-muted-foreground">
              <Field
                label="Chain"
                value={`${entry.streamName ?? (entry.stream === "org" ? "Back office" : entry.stream)} #${entry.seq}`}
              />
              <Field
                label="Hash"
                value={<span className="font-mono break-all">{entry.hash}</span>}
              />
              <Field label="App" value={entry.appVersion} />
            </dl>
          </>
        ) : readError ? (
          <div role="alert" className="flex flex-col items-start gap-3 text-sm">
            <p className="text-destructive">Could not load this entry. {readError.message}</p>
            <Button variant="outline" size="sm" onClick={readError.retry}>
              Try again
            </Button>
          </div>
        ) : (
          <div role="status" aria-label="Loading the entry" className="grid gap-3">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        )}
      </div>
    </FormSheet>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{value}</dd>
    </div>
  );
}
