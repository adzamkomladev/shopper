import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebouncedCallback } from "../../../hooks/debounced/callback";
import { refusal } from "../../../lib/customers/refusals";
import { customerSearchQuery } from "../../../queries/customers/list";
import { useMergeCustomers } from "../../../queries/customers/status";
import type { CustomerView } from "../../../queries/customers/types";
import { ConfirmDialog } from "../../admin/confirm/dialog";
import { MergePicker } from "./picker";
import { MergeResult } from "./result";

const SEARCH_DEBOUNCE_MS = 200;

type Props = {
  /** The customer kept: the other one's account and points move to them. */
  keep: CustomerView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocus: () => void;
  /** What the search starts with: the shared phone number when the flag opened this, else empty. */
  initialText: string;
};

/** Finds the customer to fold in, shows both accounts and the result, and asks before merging. */
export function MergeDialog({ keep, open, onOpenChange, restoreFocus, initialText }: Props) {
  const [text, setText] = useState(initialText);
  const [term, setTerm] = useState(initialText);
  const [chosen, setChosen] = useState<CustomerView>();
  const [seenOpen, setSeenOpen] = useState(open);
  const merge = useMergeCustomers(keep.id, () => onOpenChange(false));
  const setSearchTerm = useDebouncedCallback(setTerm, SEARCH_DEBOUNCE_MS);
  // Each time it opens the search starts again, from the shared phone when that is why it opened.
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
  const matches = search.data?.items.filter((customer) => customer.id !== keep.id) ?? [];
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) merge.reset();
        onOpenChange(next);
      }}
      title={`Merge into ${keep.name}`}
      description="Pick the customer to fold in. Their account and points move to this customer, and they are archived. A merge can't be undone."
      confirmLabel="Merge customers"
      blocked={chosen ? undefined : "Pick the customer to merge in."}
      error={merge.error ? refusal(merge.error) : undefined}
      pending={merge.isPending}
      onConfirm={() => chosen && merge.mutate(chosen.id)}
      restoreFocus={restoreFocus}
    >
      <MergePicker
        text={text}
        onTextChange={(value) => {
          setText(value);
          setChosen(undefined);
          setSearchTerm(value);
        }}
        matches={status === "done" ? matches : []}
        status={status}
        chosen={chosen}
        onChoose={setChosen}
      />
      {chosen && <MergeResult keep={keep} fold={chosen} />}
    </ConfirmDialog>
  );
}
