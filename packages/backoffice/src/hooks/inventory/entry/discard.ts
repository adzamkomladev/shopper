import { useRef } from "react";
import { useBlocker } from "@tanstack/react-router";

/**
 * Holds a form with unsaved lines in place when navigation would leave the page (Escape, a link, the
 * browser's Back), so the dialog can ask first. Changing only the search (the branch) is not leaving.
 * `markSaved` lets the navigation that follows a successful save through.
 */
export function useDiscardGuard(dirty: boolean) {
  const saved = useRef(false);
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty && !saved.current && next.pathname !== current.pathname,
    enableBeforeUnload: () => dirty && !saved.current,
    withResolver: true,
  });
  return {
    blocker,
    markSaved: () => {
      saved.current = true;
    },
  };
}
