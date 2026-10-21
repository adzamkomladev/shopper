import { useState } from "react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { CancelTakeDialog } from "../../../../components/inventory/takes/sheet/cancel";
import { CountTable } from "../../../../components/inventory/takes/sheet/count";
import { SheetHeader } from "../../../../components/inventory/takes/sheet/header";
import { SheetProblem } from "../../../../components/inventory/takes/sheet/problem";
import { AllCounted, SheetSkeleton } from "../../../../components/inventory/takes/sheet/states";
import {
  CountToolbar,
  CountProgress,
  ReviewToolbar,
} from "../../../../components/inventory/takes/sheet/toolbar";
import { ReviewSummary } from "../../../../components/inventory/takes/review/summary";
import { ReviewTable } from "../../../../components/inventory/takes/review/table";
import { Gate, OfflineNote } from "../../../../components/register/states";
import { ReadOnlyNote } from "../../../../components/admin/states";
import { useCountSheet } from "../../../../hooks/inventory/takes/count";
import { focusOnMount } from "../../../../lib/focus";
import { isCounted, SHEET_HEADING_ID, unsavedCounts } from "../../../../lib/inventory/takes";
import { takeQuery, useCloseTake } from "../../../../queries/inventory/takes";
import type { TakeDetail } from "../../../../queries/inventory/types";
import { usePermissions } from "../../../../queries/session/permissions";

const ROUTE = "/_shop/stock/takes/$takeId";

/** One stock take: the sheet to count on, the review that follows, and the posted take as it was stored. */
export function TakeSheetScreen() {
  return (
    <Gate need="stock.read" what="stock takes" fallback={<SheetSkeleton />}>
      <Take />
    </Gate>
  );
}

function Take() {
  const { takeId } = useParams({ from: ROUTE });
  const { data: take } = useSuspenseQuery(takeQuery(takeId));
  return <TakeSheet key={take.id} take={take} />;
}

function TakeSheet({ take }: { take: TakeDetail }) {
  const search = useSearch({ from: ROUTE });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnline();
  const canWrite = !!usePermissions()?.includes("stock.write");
  const editable = take.status === "open" && canWrite;
  const review = editable && !!search.review;
  const [cancelling, setCancelling] = useState(false);
  const sheet = useCountSheet(take.id, take.lines);
  // A count box takes the cursor on arrival, else the heading does. A new callback moves it there again (Esc from the review).
  const [headingRef, setHeadingRef] = useState<((node: HTMLElement | null) => void) | undefined>(
    () => (!editable || review || take.uncounted === 0 ? focusOnMount : undefined),
  );
  const focusHeading = () => setHeadingRef(() => (node: HTMLElement | null) => node?.focus());
  const post = useCloseTake(take.id, "post");
  const cancel = useCloseTake(take.id, "cancel");
  const shown = search.uncounted ? take.lines.filter((line) => !isCounted(line)) : take.lines;
  const progress = { counted: take.lines.length - take.uncounted, total: take.lines.length };

  const go = (next: { uncounted?: true; review?: true }) =>
    void navigate({
      to: "/stock/takes/$takeId",
      params: { takeId: take.id },
      search: next,
      replace: true,
    });
  const toHeading = () => document.getElementById(SHEET_HEADING_ID)?.focus();
  const leave = (mutation: typeof post) => mutation.mutate(undefined, { onSuccess: toHeading });

  function toggleUncounted() {
    const next = !search.uncounted;
    sheet.requestFocus(
      (next ? take.lines.filter((line) => !isCounted(line)) : take.lines)[0]?.productId,
    );
    go({ ...search, uncounted: next ? true : undefined });
  }
  function openReview() {
    if (!online || cancelling) return;
    // What is typed but not yet saved goes with the review, so Mod+Enter never loses a count.
    const unsaved = unsavedCounts(take.lines, sheet.drafts);
    if (unsaved.length) sheet.count.mutate(unsaved);
    post.reset();
    go({ ...search, review: true });
  }
  function showUncounted() {
    post.reset();
    sheet.requestFocus(take.lines.find((line) => !isCounted(line))?.productId);
    go({ uncounted: true });
  }
  const backToCounting = () => {
    focusHeading();
    go({ ...search, review: undefined });
  };
  const postTake = () => online && !post.isPending && leave(post);
  const shortcuts = useShortcuts(
    review
      ? { "Mod+Enter": postTake, Escape: backToCounting }
      : editable
        ? { U: toggleUncounted, "Mod+Enter": openReview }
        : {},
  );

  return (
    <div ref={shortcuts} className="flex min-h-0 flex-1 flex-col gap-6 pb-6">
      <SheetHeader take={take} focusRef={headingRef} />
      {!online && editable && (
        <OfflineNote>
          You're seeing the sheet loaded earlier. Counting, reviewing and cancelling need a
          connection.
        </OfflineNote>
      )}
      {editable &&
        (review ? (
          <ReviewToolbar
            {...progress}
            online={online}
            pending={post.isPending}
            onBack={backToCounting}
            onPost={postTake}
          />
        ) : (
          <CountToolbar
            {...progress}
            uncountedOnly={!!search.uncounted}
            online={online}
            onToggle={toggleUncounted}
            onReview={openReview}
            onCancel={() => setCancelling(true)}
          />
        ))}
      {!editable && take.status === "open" && (
        <>
          <CountProgress {...progress} />
          <ReadOnlyNote>
            You can see this take but not count it. Counting needs permission to change stock.
          </ReadOnlyNote>
        </>
      )}
      <SheetProblem
        error={post.error ?? sheet.count.error ?? cancel.error}
        lines={take.lines}
        onShowUncounted={showUncounted}
        onRecount={(productId) => {
          post.reset();
          sheet.markRecount(productId);
          go({});
        }}
        onRefresh={() => {
          sheet.count.reset();
          void queryClient.invalidateQueries({ queryKey: takeQuery(take.id).queryKey });
        }}
      />
      {review && <ReviewHeading />}
      {(review || take.status === "posted") && <ReviewSummary take={take} />}
      {editable && !review ? (
        shown.length === 0 ? (
          <AllCounted />
        ) : (
          <CountTable
            lines={shown}
            drafts={sheet.drafts}
            invalid={sheet.invalid}
            recount={sheet.recount}
            focus={sheet.focus}
            disabled={!online}
            onEdit={sheet.edit}
            onSave={(line) => sheet.save(line, shown)}
          />
        )
      ) : (
        <ReviewTable
          lines={take.lines}
          label={take.status === "posted" || review ? "Variance review" : "Counts"}
          compare={take.status === "posted" || review}
        />
      )}
      <CancelTakeDialog
        open={cancelling}
        onOpenChange={setCancelling}
        onConfirm={() => leave(cancel)}
      />
    </div>
  );
}

function ReviewHeading() {
  return (
    <div className="flex flex-col gap-1">
      {/* Focused on arrival: the button that opened the review is gone, and the keys need somewhere to be pressed. */}
      <h2
        tabIndex={-1}
        ref={focusOnMount}
        className="text-lg font-medium tracking-tight outline-none"
      >
        Review the count
      </h2>
      <p className="text-sm text-muted-foreground">
        Check each variance before you post. Posting moves stock on hand by the variance, dated at
        each count.
      </p>
    </div>
  );
}
