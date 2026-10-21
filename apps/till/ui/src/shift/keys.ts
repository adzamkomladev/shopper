import type { KeyboardEvent } from "react";

/**
 * Enter in a count box moves to the next box, as it does on a numpad. Only Ctrl+Enter or the button sends the
 * form, so a habit of pressing Enter after each number never submits half a count.
 */
export function nextOnEnter(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
  if (!(event.target instanceof HTMLInputElement)) return;
  event.preventDefault();
  const inputs = [...event.currentTarget.querySelectorAll("input")];
  inputs[inputs.indexOf(event.target) + 1]?.focus();
}
