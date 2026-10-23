import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customerSearchQuery } from "../../queries/customers/list";
import type { CustomerView } from "../../queries/customers/types";
import { useDebouncedCallback } from "../debounced/callback";

const SEARCH_DEBOUNCE_MS = 200;

/**
 * Finding another customer by phone or name, for a dialog: the text, a debounced search that leaves `exceptId` out,
 * and the one chosen. Each time `open` turns true it starts again from `initialText`.
 */
export function useCustomerFinder(open: boolean, exceptId: string, initialText = "") {
  const [text, setText] = useState(initialText);
  const [term, setTerm] = useState(initialText);
  const [chosen, setChosen] = useState<CustomerView>();
  const [seenOpen, setSeenOpen] = useState(open);
  const setSearchTerm = useDebouncedCallback(setTerm, SEARCH_DEBOUNCE_MS);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setText(initialText);
      setTerm(initialText);
      setChosen(undefined);
    }
  }
  const search = useQuery({ ...customerSearchQuery(term.trim()), enabled: open && !!term.trim() });
  const searching = !!text.trim() && (text.trim() !== term.trim() || search.isPending);
  const status = !text.trim() ? "idle" : search.isError ? "failed" : searching ? "loading" : "done";
  return {
    text,
    onTextChange: (value: string) => {
      setText(value);
      setChosen(undefined);
      setSearchTerm(value);
    },
    status,
    matches:
      status === "done" ? (search.data?.items.filter(({ id }) => id !== exceptId) ?? []) : [],
    chosen,
    onChoose: setChosen,
  } as const;
}
