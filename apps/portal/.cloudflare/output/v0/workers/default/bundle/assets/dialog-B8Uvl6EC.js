import "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { c as Button, m as cn } from "./createLucideIcon-DmKyVZgg.js";
import {
  a as DialogDescription$1,
  c as DialogTitle$1,
  i as DialogContent$1,
  n as Dialog$1,
  o as DialogOverlay$1,
  r as DialogClose$1,
  s as DialogPortal$1,
  t as X,
} from "./x-CZUobvN7.js";
require_react();
var import_jsx_runtime = require_jsx_runtime();
function Dialog({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog$1, {
    "data-slot": "dialog",
    ...props,
  });
}
function DialogPortal({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogPortal$1, {
    "data-slot": "dialog-portal",
    ...props,
  });
}
function DialogClose({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose$1, {
    "data-slot": "dialog-close",
    ...props,
  });
}
function DialogOverlay({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay$1, {
    "data-slot": "dialog-overlay",
    className: cn(
      "fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
      className,
    ),
    ...props,
  });
}
function DialogContent({ className, children, showCloseButton = true, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, {
    "data-slot": "dialog-portal",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, {}),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent$1, {
        "data-slot": "dialog-content",
        className: cn(
          "fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          className,
        ),
        ...props,
        children: [
          children,
          showCloseButton &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose$1, {
              "data-slot": "dialog-close",
              className:
                "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {}),
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
function DialogHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "dialog-header",
    className: cn("flex flex-col gap-2 text-center sm:text-left", className),
    ...props,
  });
}
function DialogFooter({ className, showCloseButton = false, children, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    "data-slot": "dialog-footer",
    className: cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
    ...props,
    children: [
      children,
      showCloseButton &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose$1, {
          asChild: true,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            variant: "outline",
            children: "Close",
          }),
        }),
    ],
  });
}
function DialogTitle({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle$1, {
    "data-slot": "dialog-title",
    className: cn("text-lg leading-none font-semibold", className),
    ...props,
  });
}
function DialogDescription({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription$1, {
    "data-slot": "dialog-description",
    className: cn("text-sm text-muted-foreground", className),
    ...props,
  });
}
//#endregion
export {
  DialogFooter as a,
  DialogDescription as i,
  DialogClose as n,
  DialogHeader as o,
  DialogContent as r,
  DialogTitle as s,
  Dialog as t,
};
