import { useState } from "react";
import { focusOnMount } from "../../../lib/focus";
import { countId, countText, isCounted, parseCount, REVIEW_ID } from "../../../lib/inventory/takes";
import type { TakeLine } from "../../../queries/inventory/types";
import { useCountLines } from "../../../queries/inventory/takes";

type Focus = { id?: string; ref?: (node: HTMLElement | null) => void };

/**
 * The state of a count sheet: what is typed in each box, which boxes hold something that is not a
 * count, which line holds the cursor, and the line a till made stale. Saving a line is Enter's work.
 */
export function useCountSheet(takeId: string, lines: TakeLine[]) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [invalid, setInvalid] = useState<Record<string, true>>({});
  const [recount, setRecount] = useState<string>();
  // A new request is a new ref callback, so asking again for the same line moves the cursor there again.
  const [focus, setFocus] = useState<Focus>(() => ({
    id: lines.find((line) => !isCounted(line))?.productId,
    ref: focusOnMount,
  }));
  const count = useCountLines(takeId);

  const requestFocus = (id?: string) => setFocus({ id, ref: (node) => node?.focus() });

  return {
    drafts,
    invalid,
    recount,
    focus,
    count,
    requestFocus,
    markRecount: (productId: string) => {
      setRecount(productId);
      requestFocus(productId);
    },
    edit: (productId: string, text: string) => {
      setDrafts((previous) => ({ ...previous, [productId]: text }));
      setInvalid((previous) => {
        const rest = { ...previous };
        delete rest[productId];
        return rest;
      });
    },
    /** Enter: saves the line when its text is a count, and moves the cursor to the next line shown (or to Review). */
    save: (line: TakeLine, shown: TakeLine[]) => {
      const counted = parseCount(countText(line, drafts));
      if (counted === null)
        return setInvalid((previous) => ({ ...previous, [line.productId]: true }));
      if (counted !== line.countedThousandths) {
        count.reset();
        count.mutate([{ productId: line.productId, countedThousandths: counted }]);
      }
      if (recount === line.productId) setRecount(undefined);
      const next = shown[shown.findIndex((entry) => entry.productId === line.productId) + 1];
      document.getElementById(next ? countId(next.productId) : REVIEW_ID)?.focus();
    },
  };
}
