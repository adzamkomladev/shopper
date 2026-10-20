import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { MOD_KEY } from "../../../../lib/mod/key";
import { CANCEL_ID, REVIEW_ID } from "../../../../lib/inventory/takes";

type Progress = { counted: number; total: number };

/** "N of M counted", with a bar; the words carry it, so the bar is for the eye only. */
export function CountProgress({ counted, total }: Progress) {
  return (
    <div role="status" className="flex min-w-48 flex-1 flex-col gap-1.5">
      <p className="text-sm font-medium tabular-nums">
        {counted} of {total} counted
      </p>
      <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary"
          style={{ width: `${total ? (counted / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

type CountProps = Progress & {
  uncountedOnly: boolean;
  online: boolean;
  onToggle: () => void;
  onReview: () => void;
  onCancel: () => void;
};

/** Progress, the uncounted-only filter, Review and Cancel take, each with its key. */
export function CountToolbar({
  uncountedOnly,
  online,
  onToggle,
  onReview,
  onCancel,
  ...progress
}: CountProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CountProgress {...progress} />
      <Button
        variant={uncountedOnly ? "default" : "outline"}
        aria-pressed={uncountedOnly}
        onClick={onToggle}
      >
        Uncounted only
        <Kbd
          aria-hidden
          className="[[data-slot=button][data-variant=default]_&]:bg-primary-foreground/5"
        >
          U
        </Kbd>
      </Button>
      <Button id={CANCEL_ID} variant="outline" onClick={onCancel} disabled={!online}>
        Cancel take
      </Button>
      <Button id={REVIEW_ID} onClick={onReview} disabled={!online}>
        Review
        <Kbd aria-hidden className="bg-primary-foreground/5 max-sm:hidden">
          {MOD_KEY} ↵
        </Kbd>
      </Button>
    </div>
  );
}

type ReviewProps = Progress & {
  online: boolean;
  pending: boolean;
  onBack: () => void;
  onPost: () => void;
};

/** Back to counting, and the one button that posts the take. */
export function ReviewToolbar({ online, pending, onBack, onPost, ...progress }: ReviewProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <CountProgress {...progress} />
      <Button variant="outline" onClick={onBack}>
        <ArrowLeftIcon aria-hidden />
        Back to counting
        <Kbd aria-hidden>Esc</Kbd>
      </Button>
      <Button onClick={onPost} disabled={!online || pending}>
        {pending ? "Posting…" : "Post take"}
        {!pending && (
          <Kbd aria-hidden className="bg-primary-foreground/5 max-sm:hidden">
            {MOD_KEY} ↵
          </Kbd>
        )}
      </Button>
    </div>
  );
}
