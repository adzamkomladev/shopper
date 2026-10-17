import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { m as cn, p as cva, t as createLucideIcon } from "./createLucideIcon-DmKyVZgg.js";
import { o as Primitive } from "./alert-Cl5zWfQH.js";
//#region ../../node_modules/.pnpm/@radix-ui+react-label@2.1.16_@types+react-dom@19.3.0_@types+react@19.3.0__@types+react@_a0d6e2f71ba73dadad94263bc45ff639/node_modules/@radix-ui/react-label/dist/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var __defProp$1 = Object.defineProperty;
var __name$1 = (target, value) =>
  __defProp$1(target, "name", {
    value,
    configurable: true,
  });
var Label$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name$1(function Label2(props, forwardedRef) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.label, {
      ...props,
      ref: forwardedRef,
      onMouseDown: (event) => {
        if (event.target.closest("button, input, select, textarea")) return;
        props.onMouseDown?.(event);
        if (!event.defaultPrevented && event.detail > 1) event.preventDefault();
      },
    });
  }, "Label"),
);
//#endregion
//#region ../../node_modules/.pnpm/@radix-ui+react-separator@1.1.16_@types+react-dom@19.3.0_@types+react@19.3.0__@types+re_3362b368140d816e1acd323eb561483d/node_modules/@radix-ui/react-separator/dist/index.mjs
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", {
    value,
    configurable: true,
  });
var Orientation = {
  Horizontal: "horizontal",
  Vertical: "vertical",
};
var DEFAULT_ORIENTATION = Orientation.Horizontal;
var ORIENTATIONS = Object.values(Orientation);
var Separator$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function Separator2(props, forwardedRef) {
    const { decorative, orientation: orientationProp = DEFAULT_ORIENTATION, ...domProps } = props;
    const orientation = isValidOrientation(orientationProp) ? orientationProp : DEFAULT_ORIENTATION;
    const ariaOrientation = orientation === Orientation.Vertical ? orientation : void 0;
    const semanticProps = decorative
      ? { role: "none" }
      : {
          "aria-orientation": ariaOrientation,
          role: "separator",
        };
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.div, {
      "data-orientation": orientation,
      ...semanticProps,
      ...domProps,
      ref: forwardedRef,
    });
  }, "Separator"),
);
function isValidOrientation(orientation) {
  return ORIENTATIONS.includes(orientation);
}
__name(isValidOrientation, "isValidOrientation");
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/circle-alert.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData = {
  name: "circle-alert",
  size: 24,
  node: [
    [
      "circle",
      {
        cx: "12",
        cy: "12",
        r: "10",
        key: "1mglay",
      },
    ],
    [
      "line",
      {
        x1: "12",
        x2: "12",
        y1: "8",
        y2: "12",
        key: "1pkeuh",
      },
    ],
    [
      "line",
      {
        x1: "12",
        x2: "12.01",
        y1: "16",
        y2: "16",
        key: "4dfq90",
      },
    ],
  ],
  aliases: ["alert-circle"],
};
__iconData.node;
var CircleAlert = createLucideIcon(__iconData);
//#endregion
//#region ../../packages/ui/src/components/label.tsx
function Label({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label$1, {
    "data-slot": "label",
    className: cn(
      "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className,
    ),
    ...props,
  });
}
//#endregion
//#region ../../packages/ui/src/components/separator.tsx
function Separator({ className, orientation = "horizontal", decorative = true, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator$1, {
    "data-slot": "separator",
    decorative,
    orientation,
    className: cn(
      "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
      className,
    ),
    ...props,
  });
}
//#endregion
//#region ../../packages/ui/src/components/field.tsx
function FieldSet({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("fieldset", {
    "data-slot": "field-set",
    className: cn(
      "flex flex-col gap-6",
      "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
      className,
    ),
    ...props,
  });
}
function FieldLegend({ className, variant = "legend", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
    "data-slot": "field-legend",
    "data-variant": variant,
    className: cn(
      "mb-3 font-medium",
      "data-[variant=legend]:text-base",
      "data-[variant=label]:text-sm",
      className,
    ),
    ...props,
  });
}
function FieldGroup({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "field-group",
    className: cn(
      "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4",
      className,
    ),
    ...props,
  });
}
var fieldVariants = cva("group/field flex w-full gap-3 data-[invalid=true]:text-destructive", {
  variants: {
    orientation: {
      vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
      horizontal: [
        "flex-row items-center",
        "[&>[data-slot=field-label]]:flex-auto",
        "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      ],
      responsive: [
        "flex-col @md/field-group:flex-row @md/field-group:items-center [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto",
        "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
        "@md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      ],
    },
  },
  defaultVariants: { orientation: "vertical" },
});
function Field({ className, orientation = "vertical", ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    role: "group",
    "data-slot": "field",
    "data-orientation": orientation,
    className: cn(fieldVariants({ orientation }), className),
    ...props,
  });
}
function FieldContent({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    "data-slot": "field-content",
    className: cn("group/field-content flex flex-1 flex-col gap-1.5 leading-snug", className),
    ...props,
  });
}
function FieldLabel({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
    "data-slot": "field-label",
    className: cn(
      "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50",
      "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-4",
      "has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5 dark:has-data-[state=checked]:bg-primary/10",
      className,
    ),
    ...props,
  });
}
function FieldDescription({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
    "data-slot": "field-description",
    className: cn(
      "text-sm leading-normal font-normal text-muted-foreground group-has-[[data-orientation=horizontal]]/field:text-balance",
      "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
      "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
      className,
    ),
    ...props,
  });
}
function FieldError({ className, children, errors, ...props }) {
  const content = (0, import_react.useMemo)(() => {
    if (children) return children;
    if (!errors?.length) return null;
    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()];
    if (uniqueErrors?.length == 1) return uniqueErrors[0]?.message;
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
      className: "ml-4 flex list-disc flex-col gap-1",
      children: uniqueErrors.map(
        (error, index) =>
          error?.message &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: error.message }, index),
      ),
    });
  }, [children, errors]);
  if (!content) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    role: "alert",
    "data-slot": "field-error",
    className: cn("text-sm font-normal text-destructive", className),
    ...props,
    children: content,
  });
}
//#endregion
export {
  FieldGroup as a,
  FieldSet as c,
  CircleAlert as d,
  FieldError as i,
  Separator as l,
  FieldContent as n,
  FieldLabel as o,
  FieldDescription as r,
  FieldLegend as s,
  Field as t,
  Label as u,
};
