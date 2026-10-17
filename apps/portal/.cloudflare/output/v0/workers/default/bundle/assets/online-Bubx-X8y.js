import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
//#region ../../packages/ui/src/hooks/shortcuts.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var ShortcutContext = (0, import_react.createContext)(null);
function ShortcutRoot({ children, ...props }) {
  const [registry] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  function onKeyDownCapture(event) {
    const combo = describe(event);
    if (isPlainKey(combo) && isTyping(event.target)) return;
    for (const map of [...registry].reverse()) {
      const handler = map[combo];
      if (!handler) continue;
      event.preventDefault();
      handler(event);
      return;
    }
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShortcutContext, {
    value: registry,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
      tabIndex: -1,
      onKeyDownCapture,
      className: "outline-none",
      ...props,
      children,
    }),
  });
}
/** Attach the returned ref to the element that owns the shortcuts. They live while it is mounted. */
function useShortcuts(map) {
  const registry = (0, import_react.use)(ShortcutContext);
  if (!registry) throw new Error("useShortcuts needs a ShortcutRoot above it");
  return (node) => {
    if (!node) return;
    registry.add(map);
    return () => {
      registry.delete(map);
    };
  };
}
function describe(event) {
  const printable = event.key.length === 1;
  const key = printable ? event.key.toUpperCase() : event.key;
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey;
  return [
    ...[
      event.ctrlKey || event.metaKey ? "Mod" : "",
      event.altKey ? "Alt" : "",
      event.shiftKey && (!printable || hasModifier) ? "Shift" : "",
    ].filter(Boolean),
    key,
  ].join("+");
}
var isPlainKey = (combo) => combo.length === 1;
function isTyping(target) {
  return (
    target instanceof HTMLElement &&
    target.matches(
      'input, textarea, select, [contenteditable], [role="combobox"], [role="listbox"], [role="option"]',
    )
  );
}
//#endregion
//#region ../../packages/backoffice/src/lib/mod/key.ts
/** The label for the Mod shortcut key on this platform. */
var MOD_KEY = /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl";
//#endregion
//#region ../../packages/ui/src/hooks/use/online.ts
function useOnline() {
  return (0, import_react.useSyncExternalStore)(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
function subscribe(notify) {
  addEventListener("online", notify);
  addEventListener("offline", notify);
  return () => {
    removeEventListener("online", notify);
    removeEventListener("offline", notify);
  };
}
//#endregion
export { useShortcuts as i, MOD_KEY as n, ShortcutRoot as r, useOnline as t };
