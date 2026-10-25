import { RotateCcwIcon } from "lucide-react";
import { money } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Money } from "@shopper/ui/components/money";
import { Skeleton } from "@shopper/ui/components/skeleton";
import { FormSheet } from "../../admin/form/sheet";
import { FISCAL_KIND, FISCAL_STATUS, fiscalTime } from "../../../lib/tax/fiscal";
import type { FiscalDocView, FiscalRow } from "../../../schemas/tax/fiscal";

type Props = {
  row?: FiscalRow;
  /** The full document once it has loaded. */
  doc?: FiscalDocView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  /** Present only for a member who may retry, online, on a dead-lettered document. */
  onRetry?: () => void;
  retrying: boolean;
  error?: string;
  /** Set when the document could not be read, with a way to read it again. */
  readError?: { message: string; retry: () => void };
};

/** One document: what the SDC said, the signature once accepted, and Retry for a dead-lettered one (R). */
export function FiscalDocSheet({ row, doc, onRetry, retrying, error, readError, ...sheet }: Props) {
  const status = row && FISCAL_STATUS[doc?.status ?? row.status];
  return (
    <FormSheet
      {...sheet}
      title={row ? `${FISCAL_KIND[row.kind]} ${row.invoiceNumber}` : "Fiscal document"}
      description="Where this document stands with the GRA SDC."
    >
      <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
        {status && <Badge variant={status.variant}>{status.label}</Badge>}
        {doc ? (
          <dl className="grid gap-3 text-sm">
            <Field label="Branch" value={doc.branchName} />
            <Field label="Issued" value={fiscalTime(doc.createdAt)} />
            {doc.payload.totals && (
              <Field label="Total" value={<Money amount={money(doc.payload.totals.total)} />} />
            )}
            <Field label="Tries" value={String(doc.attempts)} />
            {doc.rejectionCode && (
              <Field label="Rejected" value={`${doc.rejectionCode}: ${doc.rejectionMessage}`} />
            )}
            {!doc.rejectionCode && doc.lastError && (
              <Field label="Last error" value={doc.lastError} />
            )}
            {doc.signature && (
              <>
                <Field label="SDC" value={`${doc.sdcId} #${doc.sdcCounter}`} />
                <Field label="Signed" value={fiscalTime(doc.signedAt!)} />
                <Field
                  label="Signature"
                  value={<span className="break-all font-mono">{doc.signature}</span>}
                />
              </>
            )}
          </dl>
        ) : readError ? (
          <div role="alert" className="flex flex-col items-start gap-3 text-sm">
            <p className="text-destructive">Could not load this document. {readError.message}</p>
            <Button variant="outline" size="sm" onClick={readError.retry}>
              Try again
            </Button>
          </div>
        ) : (
          <div role="status" aria-label="Loading the document" className="grid gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-5 w-full" />
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {onRetry && (
          <Button onClick={onRetry} disabled={retrying} aria-keyshortcuts="R">
            <RotateCcwIcon aria-hidden />
            {retrying ? "Retrying…" : "Retry"}
            <Kbd aria-hidden>R</Kbd>
          </Button>
        )}
      </div>
    </FormSheet>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">{value}</dd>
    </div>
  );
}
