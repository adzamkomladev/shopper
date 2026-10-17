import "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn } from "./createLucideIcon-DmKyVZgg.js";
require_react();
var import_jsx_runtime = require_jsx_runtime();
/** `touch` makes the field 44px tall for the till. */
function Input({ className, type, touch, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
    type,
    "data-slot": "input",
    className: cn(
      "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
      touch && "h-11",
      className,
    ),
    ...props,
  });
}
//#endregion
export { Input as t };
