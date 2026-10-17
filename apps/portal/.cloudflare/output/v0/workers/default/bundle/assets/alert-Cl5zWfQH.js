import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  i as require_react,
  r as require_jsx_runtime,
  t as require_react_dom,
} from "./react-dom-BCYT53bd.js";
import { m as cn, p as cva, u as createSlot } from "./createLucideIcon-DmKyVZgg.js";
//#region ../../node_modules/.pnpm/@radix-ui+react-primitive@2.1.11_@types+react-dom@19.3.0_@types+react@19.3.0__@types+re_2d61650df3f0a7a7bdba633a6dcc8d9a/node_modules/@radix-ui/react-primitive/dist/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom(), 1);
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", {
    value,
    configurable: true,
  });
var Primitive = [
  "a",
  "button",
  "div",
  "form",
  "h2",
  "h3",
  "img",
  "input",
  "label",
  "li",
  "nav",
  "ol",
  "p",
  "select",
  "span",
  "svg",
  "ul",
].reduce((primitive, node) => {
  const Slot = createSlot(`Primitive.${node}`);
  const Node = import_react.forwardRef((props, forwardedRef) => {
    const { asChild, ...primitiveProps } = props;
    const Comp = asChild ? Slot : node;
    if (typeof window !== "undefined") window[Symbol.for("radix-ui")] = true;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comp, {
      ...primitiveProps,
      ref: forwardedRef,
    });
  });
  Node.displayName = `Primitive.${node}`;
  return {
    ...primitive,
    [node]: Node,
  };
}, {});
function dispatchDiscreteCustomEvent(target, event) {
  if (target) import_react_dom.flushSync(() => target.dispatchEvent(event));
}
__name(dispatchDiscreteCustomEvent, "dispatchDiscreteCustomEvent");
//#endregion
//#region ../../packages/backoffice/src/lib/focus.ts
/** Ref callback: focuses the element when it mounts (React 19 ref callbacks replace a focus effect). */
function focusOnMount(node) {
  node?.focus();
}
/** Ref callback: focuses the element on mount unless something else already holds focus. */
function focusIfIdle(node) {
  if (node && document.activeElement === document.body) node.focus();
}
/** onSubmitInvalid handler: moves focus to the first field with an error (a field's id is its name). */
function focusFirstInvalid({ formApi }) {
  const invalid = Object.entries(formApi.state.fieldMeta).find(([, meta]) => meta?.errors.length);
  if (invalid) document.getElementById(invalid[0])?.focus();
}
//#endregion
//#region ../../packages/ui/src/components/alert.tsx
var alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-card text-destructive *:data-[slot=alert-description]:text-destructive [&>svg]:text-current",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
function Alert({ className, variant, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "alert",
    role: "alert",
    className: cn(alertVariants({ variant }), className),
    ...props,
  });
}
function AlertDescription({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "alert-description",
    className: cn(
      "col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed",
      className,
    ),
    ...props,
  });
}
//#endregion
export {
  focusOnMount as a,
  focusIfIdle as i,
  AlertDescription as n,
  Primitive as o,
  focusFirstInvalid as r,
  dispatchDiscreteCustomEvent as s,
  Alert as t,
};
