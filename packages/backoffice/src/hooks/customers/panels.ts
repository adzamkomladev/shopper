import { useRef } from "react";
import { usePanel } from "../admin/panel";

/** The four account dialogs' open state, and the button each hands focus back to when it closes. */
export function useAccountPanels() {
  const refs = {
    pay: useRef<HTMLButtonElement>(null),
    note: useRef<HTMLButtonElement>(null),
    limit: useRef<HTMLButtonElement>(null),
    transfer: useRef<HTMLButtonElement>(null),
  };
  const pay = usePanel(refs.pay);
  const note = usePanel(refs.note);
  const limit = usePanel(refs.limit);
  const transfer = usePanel(refs.transfer);
  return {
    refs,
    pay,
    note,
    limit,
    transfer,
    busy: pay.open || note.open || limit.open || transfer.open,
  };
}
