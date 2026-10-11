/** Ref callback: focuses the element when it mounts (React 19 ref callbacks replace a focus effect). */
export function focusOnMount(node: HTMLElement | null) {
  node?.focus();
}

/** Ref callback: focuses the element on mount unless something else already holds focus. */
export function focusIfIdle(node: HTMLElement | null) {
  if (node && document.activeElement === document.body) node.focus();
}
