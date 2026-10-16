import { r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn, p as cva } from "./createLucideIcon-DmKyVZgg.js";
//#region ../../packages/ui/src/components/empty.tsx
var import_jsx_runtime = require_jsx_runtime();
function Empty({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "empty",
    className: cn(
      "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 rounded-lg border-dashed p-6 text-center text-balance md:p-12",
      className,
    ),
    ...props,
  });
}
function EmptyHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "empty-header",
    className: cn("flex max-w-sm flex-col items-center gap-2 text-center", className),
    ...props,
  });
}
var emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
function EmptyMedia({ className, variant = "default", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "empty-icon",
    "data-variant": variant,
    className: cn(
      emptyMediaVariants({
        variant,
        className,
      }),
    ),
    ...props,
  });
}
function EmptyTitle({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "empty-title",
    className: cn("text-lg font-medium tracking-tight", className),
    ...props,
  });
}
function EmptyDescription({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "empty-description",
    className: cn(
      "text-sm/relaxed text-muted-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
      className,
    ),
    ...props,
  });
}
function EmptyContent({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "empty-content",
    className: cn(
      "flex w-full max-w-sm min-w-0 flex-col items-center gap-4 text-sm text-balance",
      className,
    ),
    ...props,
  });
}
//#endregion
export {
  EmptyMedia as a,
  EmptyHeader as i,
  EmptyContent as n,
  EmptyTitle as o,
  EmptyDescription as r,
  Empty as t,
};
