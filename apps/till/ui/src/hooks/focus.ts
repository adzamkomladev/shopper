/**
 * Shortcuts only reach the app while something inside it has focus. When a screen becomes active the
 * element that held focus is hidden or gone, so focus falls to <body>; the screen takes it back.
 */
export function takeFocus(node: HTMLElement | null, active: boolean) {
  const focused = document.activeElement;
  if (node && active && (focused === document.body || focused?.closest("[hidden]"))) node.focus();
}
