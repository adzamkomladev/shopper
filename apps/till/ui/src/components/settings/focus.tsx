import { createContext, use } from "react";
import type { Focus } from "../../settings/types";

export function createFocus(): Focus {
  const nodes = new Map<string, HTMLElement>();
  return {
    ref: (key) => (node) => {
      if (node) nodes.set(key, node);
      return () => void (nodes.get(key) === node && nodes.delete(key));
    },
    to: (key) => nodes.get(key)?.focus(),
  };
}

export const FocusContext = createContext<Focus | null>(null);

/** The ref callback that registers an element under `key`. */
export function useFocusRef(key: string) {
  const focus = use(FocusContext);
  if (!focus) throw new Error("useFocusRef needs a FocusContext above it");
  return focus.ref(key);
}
