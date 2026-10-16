import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react } from "./react-dom-BCYT53bd.js";
//#region ../../packages/ui/src/hooks/use/now.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/** The current time in ms, refreshed every `intervalMs`, so "in force now" stays true on a page left open. */
function useNow(intervalMs) {
  const [clock] = (0, import_react.useState)(() => {
    let now = Date.now();
    return {
      subscribe: (notify) => {
        const timer = setInterval(() => {
          now = Date.now();
          notify();
        }, intervalMs);
        return () => clearInterval(timer);
      },
      read: () => now,
    };
  });
  return (0, import_react.useSyncExternalStore)(clock.subscribe, clock.read);
}
//#endregion
export { useNow as t };
