import { r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn } from "./createLucideIcon-DmKyVZgg.js";
//#region ../../packages/ui/src/components/skeleton.tsx
var import_jsx_runtime = require_jsx_runtime();
function Skeleton({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "skeleton",
    className: cn("animate-pulse rounded-md bg-accent", className),
    ...props,
  });
}
//#endregion
export { Skeleton as t };
