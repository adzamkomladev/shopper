/**
 * A ref callback for a page's `<main tabIndex={-1}>`: takes focus when nothing else holds it, so the page's keys
 * work straight after a navigation, and attaches the page's shortcuts.
 */
export const pageRef =
  (shortcuts: (node: HTMLElement | null) => (() => void) | undefined) =>
  (node: HTMLElement | null) => {
    if (!node) return;
    if (document.activeElement === document.body) node.focus({ preventScroll: true });
    return shortcuts(node);
  };
