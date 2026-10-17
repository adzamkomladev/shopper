import { r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn } from "./createLucideIcon-DmKyVZgg.js";
//#region ../../packages/ui/src/components/app/backdrop.tsx
var import_jsx_runtime = require_jsx_runtime();
/** Teal page backdrop with the 20px rounded white panel the Figma shell sits in. */
function AppBackdrop({ className, children, fill, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    className: cn("bg-backdrop flex p-5", fill ? "h-svh" : "min-h-svh"),
    ...props,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
      className: cn("min-w-0 flex-1 rounded-panel bg-background px-13 py-10 shadow-sm", className),
      children,
    }),
  });
}
//#endregion
export { AppBackdrop as t };
