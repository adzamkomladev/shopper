import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
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
        aria-keyshortcuts="U"
        variant={uncountedOnly ? "default" : "outline"}
        aria-pressed={uncountedOnly}
        onClick={onToggle}
      >
        Uncounted only
      </Button>
      <Button id={CANCEL_ID} variant="outline" onClick={onCancel} disabled={!online}>
        Cancel take
      </Button>
      <Button
        aria-keyshortcuts="Control+Enter Meta+Enter"
        id={REVIEW_ID}
        onClick={onReview}
        disabled={!online}
      >
        Review
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
      <Button aria-keyshortcuts="Escape" variant="outline" onClick={onBack}>
        <ArrowLeftIcon aria-hidden />
        Back to counting
      </Button>
      <Button
        aria-keyshortcuts="Control+Enter Meta+Enter"
        onClick={onPost}
        disabled={!online || pending}
      >
        {pending ? "Posting…" : "Post take"}
      </Button>
    </div>
  );
}
