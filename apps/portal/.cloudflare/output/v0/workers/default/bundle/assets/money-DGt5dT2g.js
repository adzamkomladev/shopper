import { r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { M as formatGHS } from "./inputs-CH80xucg.js";
import { m as cn } from "./createLucideIcon-DmKyVZgg.js";
//#region ../../packages/ui/src/components/money.tsx
var import_jsx_runtime = require_jsx_runtime();
function Money({ amount, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
    className: cn("block text-right tabular-nums", className),
    children: formatGHS(amount),
  });
}
//#endregion
export { Money as t };
