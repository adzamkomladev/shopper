import { Link } from "@tanstack/react-router";
import { formatGHS, type Money } from "@shopper/money";
import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { MOD_KEY } from "../../../lib/mod/key";

const OFFLINE_NOTE_ID = "entry-offline-note";

type Props = {
  /** What a receipt adds up to, and how many lines are left out of it; an adjustment has neither. */
  total?: { total: Money; excluded: number };
  label: string;
  pending: boolean;
  online: boolean;
  branchId: string;
  onSubmit: () => void;
};

/** The order total, Cancel and the one save button, which says why it is disabled when offline. */
export function EntryFooter({ total, label, pending, online, branchId, onSubmit }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      {total === undefined ? (
        <span />
      ) : (
        <p role="status" className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-semibold tabular-nums">{formatGHS(total.total)}</span>
          {total.excluded > 0 && (
            <span className="w-full text-xs text-muted-foreground">
              excludes {total.excluded} {total.excluded === 1 ? "line" : "lines"} with no cost or
              quantity yet
            </span>
          )}
        </p>
      )}
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/stock/records" search={{ branch: branchId }}>
              Cancel
              <Kbd aria-hidden>Esc</Kbd>
            </Link>
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={!online || pending}
            aria-describedby={online ? undefined : OFFLINE_NOTE_ID}
          >
            {pending ? (
              "Saving…"
            ) : (
              <>
                {label}
                <Kbd aria-hidden className="bg-primary-foreground/5 max-sm:hidden">
                  {MOD_KEY} ↵
                </Kbd>
              </>
            )}
          </Button>
        </div>
        {!online && (
          <p id={OFFLINE_NOTE_ID} className="text-sm text-muted-foreground">
            You're offline. Reconnect to save.
          </p>
        )}
      </div>
    </div>
  );
}
