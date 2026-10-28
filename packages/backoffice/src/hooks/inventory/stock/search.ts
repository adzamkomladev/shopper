import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useDebouncedCallback } from "../../debounced/callback";
import type { StockSearch } from "../../../queries/inventory/types";

const SEARCH_DEBOUNCE_MS = 250;

/** The stock list's filters, kept in the URL: the search text a moment after typing stops, the rest at once. */
export function useStockSearch(search: StockSearch) {
  const navigate = useNavigate();
  const router = useRouter();
  const [text, setText] = useState(search.q ?? "");
  const [seenQuery, setSeenQuery] = useState(search.q);
  // The URL changed from elsewhere (a link, Back): show it. Our own update only trims the text.
  if (search.q !== seenQuery) {
    setSeenQuery(search.q);
    if ((search.q ?? "") !== text.trim()) setText(search.q ?? "");
  }
  const update = (patch: StockSearch) =>
    navigate({
      to: "/stock",
      search: (previous: StockSearch) => ({ ...previous, ...patch }),
      replace: true,
    });
  const setQuery = useDebouncedCallback((value: string) => {
    // Typing then leaving the page must not drag the user back.
    if (router.state.location.pathname === "/stock") void update({ q: value.trim() || undefined });
  }, SEARCH_DEBOUNCE_MS);
  return {
    text,
    onTextChange: (value: string) => {
      setText(value);
      setQuery(value);
    },
    onBranchChange: (branch: string) => void update({ branch }),
    // One filter at a time: negative stock is rarely also asked about by reorder level.
    toggleLow: () => void update({ low: search.low ? undefined : true, negative: undefined }),
    toggleNegative: () =>
      void update({ negative: search.negative ? undefined : true, low: undefined }),
    /** Escape in the search box: empties it, or (when already empty) leaves it for the screen so shortcuts work. */
    onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Escape") return;
      if (text) {
        setQuery.cancel();
        setText("");
        void update({ q: undefined });
      } else event.currentTarget.closest<HTMLElement>("[tabindex='-1']")?.focus();
    },
    clear: () => {
      setQuery.cancel();
      setText("");
      void update({ q: undefined, low: undefined, negative: undefined });
    },
  };
}
