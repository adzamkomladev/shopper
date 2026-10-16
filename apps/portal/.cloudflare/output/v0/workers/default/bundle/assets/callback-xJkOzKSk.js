import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn, p as cva } from "./createLucideIcon-DmKyVZgg.js";
import { t as Input } from "./control-DkcwkdzM.js";
//#region ../../packages/ui/src/components/textarea.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
//#endregion
//#region ../../packages/ui/src/components/input/group.tsx
function InputGroup({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "input-group",
    role: "group",
    className: cn(
      "group/input-group relative flex w-full items-center rounded-md border border-input shadow-xs transition-[color,box-shadow] outline-none dark:bg-input/30",
      "h-9 min-w-0 has-[>textarea]:h-auto",
      "has-[>[data-align=inline-start]]:[&>input]:pl-2",
      "has-[>[data-align=inline-end]]:[&>input]:pr-2",
      "has-[>[data-align=block-start]]:h-auto has-[>[data-align=block-start]]:flex-col has-[>[data-align=block-start]]:[&>input]:pb-3",
      "has-[>[data-align=block-end]]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-end]]:[&>input]:pt-3",
      "has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:focus-ring",
      "has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40",
      className,
    ),
    ...props,
  });
}
var inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-3 has-[>button]:ml-[-0.45rem] has-[>kbd]:ml-[-0.35rem]",
        "inline-end": "order-last pr-3 has-[>button]:mr-[-0.45rem] has-[>kbd]:mr-[-0.35rem]",
        "block-start":
          "order-first w-full justify-start px-3 pt-3 group-has-[>input]/input-group:pt-2.5 [.border-b]:pb-3",
        "block-end":
          "order-last w-full justify-start px-3 pb-3 group-has-[>input]/input-group:pb-2.5 [.border-t]:pt-3",
      },
    },
    defaultVariants: { align: "inline-start" },
  },
);
function InputGroupAddon({ className, align = "inline-start", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    role: "group",
    "data-slot": "input-group-addon",
    "data-align": align,
    className: cn(inputGroupAddonVariants({ align }), className),
    onClick: (e) => {
      if (e.target.closest("button")) return;
      e.currentTarget.parentElement?.querySelector("input")?.focus();
    },
    ...props,
  });
}
cva("flex items-center gap-2 text-sm shadow-none", {
  variants: {
    size: {
      xs: "h-6 gap-1 rounded-[calc(var(--radius)-5px)] px-2 has-[>svg]:px-2 [&>svg:not([class*='size-'])]:size-3.5",
      sm: "h-8 gap-1.5 rounded-md px-2.5 has-[>svg]:px-2.5",
      "icon-xs": "size-6 rounded-[calc(var(--radius)-5px)] p-0 has-[>svg]:p-0",
      "icon-sm": "size-8 p-0 has-[>svg]:p-0",
    },
  },
  defaultVariants: { size: "xs" },
});
function InputGroupInput({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
    "data-slot": "input-group-control",
    className: cn(
      "flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent",
      className,
    ),
    ...props,
  });
}
//#endregion
//#region ../../packages/backoffice/src/hooks/debounced/callback.ts
/** Runs `callback` once `delayMs` have passed without another call; the last arguments win. */
function useDebouncedCallback(callback, delayMs) {
  const timer = (0, import_react.useRef)(void 0);
  const cancel = () => clearTimeout(timer.current);
  const call = (...args) => {
    cancel();
    timer.current = setTimeout(() => callback(...args), delayMs);
  };
  return Object.assign(call, { cancel });
}
//#endregion
export { InputGroupInput as i, InputGroup as n, InputGroupAddon as r, useDebouncedCallback as t };
