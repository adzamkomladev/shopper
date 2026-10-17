import "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn } from "./createLucideIcon-DmKyVZgg.js";
import {
  a as DialogDescription,
  c as DialogTitle,
  i as DialogContent,
  n as Dialog,
  o as DialogOverlay,
  r as DialogClose,
  s as DialogPortal,
  t as X,
} from "./x-CZUobvN7.js";
require_react();
var import_jsx_runtime = require_jsx_runtime();
function Sheet({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
    "data-slot": "sheet",
    ...props,
  });
}
function SheetClose({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
    "data-slot": "sheet-close",
    ...props,
  });
}
function SheetPortal({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogPortal, {
    "data-slot": "sheet-portal",
    ...props,
  });
}
function SheetOverlay({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {
    "data-slot": "sheet-overlay",
    className: cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
      className,
    ),
    ...props,
  });
}
function SheetContent({ className, children, side = "right", showCloseButton = true, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetPortal, {
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetOverlay, {}),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
        "data-slot": "sheet-content",
        className: cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:animate-in data-[state=open]:duration-500",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className,
        ),
        ...props,
        children: [
          children,
          showCloseButton &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
              className:
                "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-secondary",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                  className: "sr-only",
                  children: "Close",
                }),
              ],
            }),
        ],
      }),
    ],
  });
}
function SheetHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "sheet-header",
    className: cn("flex flex-col gap-1.5 p-4", className),
    ...props,
  });
}
function SheetFooter({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "sheet-footer",
    className: cn("mt-auto flex flex-col gap-2 p-4", className),
    ...props,
  });
}
function SheetTitle({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
    "data-slot": "sheet-title",
    className: cn("font-semibold text-foreground", className),
    ...props,
  });
}
function SheetDescription({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
    "data-slot": "sheet-description",
    className: cn("text-sm text-muted-foreground", className),
    ...props,
  });
}
//#endregion
export {
  SheetFooter as a,
  SheetDescription as i,
  SheetClose as n,
  SheetHeader as o,
  SheetContent as r,
  SheetTitle as s,
  Sheet as t,
};
