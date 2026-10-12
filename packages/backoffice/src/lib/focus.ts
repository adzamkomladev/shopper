import type { AnyFormApi } from "@tanstack/react-form";

/** Ref callback: focuses the element when it mounts (React 19 ref callbacks replace a focus effect). */
export function focusOnMount(node: HTMLElement | null) {
  node?.focus();
}

/** Ref callback: focuses the element on mount unless something else already holds focus. */
export function focusIfIdle(node: HTMLElement | null) {
  if (node && document.activeElement === document.body) node.focus();
}

/** onSubmitInvalid handler: moves focus to the first field with an error (a field's id is its name). */
export function focusFirstInvalid({ formApi }: { formApi: AnyFormApi }) {
  const invalid = Object.entries(formApi.state.fieldMeta).find(([, meta]) => meta?.errors.length);
  if (invalid) document.getElementById(invalid[0])?.focus();
}
