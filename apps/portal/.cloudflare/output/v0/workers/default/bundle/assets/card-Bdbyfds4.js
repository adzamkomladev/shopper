import "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn } from "./createLucideIcon-DmKyVZgg.js";
require_react();
var import_jsx_runtime = require_jsx_runtime();
function Card({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "card",
    className: cn(
      "flex flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
      className,
    ),
    ...props,
  });
}
function CardHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "card-header",
    className: cn(
      "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
      className,
    ),
    ...props,
  });
}
function CardTitle({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "card-title",
    className: cn("leading-none font-semibold", className),
    ...props,
  });
}
function CardDescription({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "card-description",
    className: cn("text-sm text-muted-foreground", className),
    ...props,
  });
}
function CardContent({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "card-content",
    className: cn("px-6", className),
    ...props,
  });
}
function CardFooter({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "card-footer",
    className: cn("flex items-center px-6 [.border-t]:pt-6", className),
    ...props,
  });
}
//#endregion
export {
  CardHeader as a,
  CardFooter as i,
  CardContent as n,
  CardTitle as o,
  CardDescription as r,
  Card as t,
};
