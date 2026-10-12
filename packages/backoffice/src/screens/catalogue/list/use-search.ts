import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useDebouncedCallback } from "../../../lib/use-debounced-callback";
import type { ProductSearch } from "./queries";

const SEARCH_DEBOUNCE_MS = 250;

/** The search box text, kept in `?q` a moment after typing stops (replace: no history per keystroke). */
export function useProductSearch(search: ProductSearch) {
  const navigate = useNavigate();
  const router = useRouter();
  const [text, setText] = useState(search.q ?? "");
  const [seenQuery, setSeenQuery] = useState(search.q);
  // The URL changed from elsewhere (a link, Back): show it. Our own update only trims the text.
  if (search.q !== seenQuery) {
    setSeenQuery(search.q);
    if ((search.q ?? "") !== text.trim()) setText(search.q ?? "");
  }
  const update = (patch: ProductSearch) =>
    navigate({
      to: "/products",
      search: (previous: ProductSearch) => ({ ...previous, ...patch }),
      replace: true,
    });
  const setQuery = useDebouncedCallback((value: string) => {
    // Typing then leaving the page must not drag the user back.
    if (router.state.location.pathname === "/products")
      void update({ q: value.trim() || undefined });
  }, SEARCH_DEBOUNCE_MS);
  return {
    text,
    onTextChange: (value: string) => {
      setText(value);
      setQuery(value);
    },
    onCategoryChange: (categoryId?: string) => void update({ categoryId }),
    clear: () => {
      setQuery.cancel();
      setText("");
      void update({ q: undefined, categoryId: undefined });
    },
  };
}
