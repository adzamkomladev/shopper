import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { CustomersSearch } from "../../queries/customers/types";
import { useDebouncedCallback } from "../debounced/callback";

const SEARCH_DEBOUNCE_MS = 250;

/** The customer list's search text, kept in the URL a moment after typing stops. */
export function useCustomersSearch(search: CustomersSearch) {
  const navigate = useNavigate();
  const router = useRouter();
  const [text, setText] = useState(search.q ?? "");
  const [seenQuery, setSeenQuery] = useState(search.q);
  // The URL changed from elsewhere (a link, Back): show it. Our own update only trims the text.
  if (search.q !== seenQuery) {
    setSeenQuery(search.q);
    if ((search.q ?? "") !== text.trim()) setText(search.q ?? "");
  }
  const update = (q: string | undefined) =>
    navigate({
      to: "/customers",
      search: (previous: CustomersSearch) => ({ ...previous, q }),
      replace: true,
    });
  const setQuery = useDebouncedCallback((value: string) => {
    // Typing then leaving the page must not drag the user back.
    if (router.state.location.pathname === "/customers") void update(value.trim() || undefined);
  }, SEARCH_DEBOUNCE_MS);
  const clear = () => {
    setQuery.cancel();
    setText("");
    void update(undefined);
  };
  return {
    text,
    onTextChange: (value: string) => {
      setText(value);
      setQuery(value);
    },
    /** Escape in the search box empties it, or (when already empty) leaves it for the screen so shortcuts work. */
    onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Escape") return;
      if (text) clear();
      else event.currentTarget.closest<HTMLElement>("[tabindex='-1']")?.focus();
    },
    clear,
  };
}
