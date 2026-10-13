import { useState, type RefObject } from "react";

/** Moves focus to the element with this id, or to `fallback` when it is gone (a deleted row). */
export function focusById(id: string | undefined, fallback: RefObject<HTMLElement | null>) {
  (document.getElementById(id ?? "") ?? fallback.current)?.focus();
}

/**
 * Open state for a sheet or dialog, plus where focus returns when it closes. The value outlives
 * the close so the content does not change while the exit animation plays.
 */
export function usePanel<T = undefined>(fallback: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<{ open: boolean; value?: T; trigger?: string }>({
    open: false,
  });
  return {
    open: state.open,
    value: state.value,
    show: (value?: T, trigger?: string) => setState({ open: true, value, trigger }),
    setOpen: (open: boolean) => setState((current) => ({ ...current, open })),
    restoreFocus: () => focusById(state.trigger, fallback),
  };
}
