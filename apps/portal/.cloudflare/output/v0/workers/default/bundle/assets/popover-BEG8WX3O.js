import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import {
  d as composeRefs,
  f as useComposedRefs,
  m as cn,
  t as createLucideIcon,
  u as createSlot,
} from "./createLucideIcon-DmKyVZgg.js";
import { o as Primitive } from "./alert-Cl5zWfQH.js";
import {
  C as composeEventHandlers,
  _ as DismissableLayer,
  b as Presence,
  d as useFocusGuards,
  f as Portal,
  g as useFocusScopeBranchRegistry,
  h as useFocusScopeBranch,
  i as DialogContent,
  l as hideOthers,
  m as FocusScopeBranchProvider,
  n as Dialog,
  o as DialogOverlay,
  p as FocusScope,
  s as DialogPortal,
  u as ReactRemoveScroll,
  w as createContextScope,
  x as useControllableState,
  y as useId,
} from "./x-CZUobvN7.js";
import {
  a as createPopperScope,
  i as PopperContent,
  n as Popper,
  r as PopperAnchor,
} from "./check-B_zEzfYT.js";
import {
  i as DialogDescription,
  o as DialogHeader,
  r as DialogContent$1,
  s as DialogTitle,
  t as Dialog$1,
} from "./dialog-B8Uvl6EC.js";
//#region ../../node_modules/.pnpm/@radix-ui+react-popover@1.2.0_@types+react-dom@19.3.0_@types+react@19.3.0__@types+react_a8ff70808089aae633d13b9a606299ae/node_modules/@radix-ui/react-popover/dist/index.mjs
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", {
    value,
    configurable: true,
  });
var POPOVER_NAME = "Popover";
var [createPopoverContext, createPopoverScope] = createContextScope(POPOVER_NAME, [
  createPopperScope,
]);
var usePopperScope = createPopperScope();
var [PopoverProvider, usePopoverContext] = createPopoverContext(POPOVER_NAME);
var Popover$1 = /* @__PURE__ */ __name((props) => {
  const {
    __scopePopover,
    children,
    open: openProp,
    defaultOpen,
    onOpenChange,
    modal = false,
  } = props;
  const popperScope = usePopperScope(__scopePopover);
  const triggerRef = import_react.useRef(null);
  const [hasCustomAnchor, setHasCustomAnchor] = import_react.useState(false);
  const [titleCount, setTitleCount] = import_react.useState(0);
  const [descriptionCount, setDescriptionCount] = import_react.useState(0);
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen ?? false,
    onChange: onOpenChange,
    caller: POPOVER_NAME,
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Popper, {
    ...popperScope,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverProvider, {
      scope: __scopePopover,
      contentId: useId(),
      titleId: useId(),
      descriptionId: useId(),
      titlePresent: titleCount > 0,
      descriptionPresent: descriptionCount > 0,
      setTitleCount,
      setDescriptionCount,
      triggerRef,
      open,
      onOpenChange: setOpen,
      onOpenToggle: import_react.useCallback(() => setOpen((prevOpen) => !prevOpen), [setOpen]),
      hasCustomAnchor,
      onCustomAnchorAdd: import_react.useCallback(() => setHasCustomAnchor(true), []),
      onCustomAnchorRemove: import_react.useCallback(() => setHasCustomAnchor(false), []),
      modal,
      children,
    }),
  });
}, "Popover");
var TRIGGER_NAME = "PopoverTrigger";
var PopoverTrigger$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function PopoverTrigger2(props, forwardedRef) {
    const { __scopePopover, ...triggerProps } = props;
    const context = usePopoverContext(TRIGGER_NAME, __scopePopover);
    const popperScope = usePopperScope(__scopePopover);
    const composedTriggerRef = useComposedRefs(forwardedRef, context.triggerRef);
    const trigger = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Primitive.button, {
      type: "button",
      "aria-haspopup": "dialog",
      "aria-expanded": context.open,
      "aria-controls": context.open ? context.contentId : void 0,
      "data-state": getState(context.open),
      ...triggerProps,
      ref: composedTriggerRef,
      onClick: composeEventHandlers(props.onClick, context.onOpenToggle),
    });
    return context.hasCustomAnchor
      ? trigger
      : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopperAnchor, {
          asChild: true,
          ...popperScope,
          children: trigger,
        });
  }, "PopoverTrigger"),
);
var PORTAL_NAME = "PopoverPortal";
var [PortalProvider, usePortalContext] = createPopoverContext(PORTAL_NAME, { forceMount: void 0 });
var PopoverPortal = /* @__PURE__ */ __name((props) => {
  const { __scopePopover, forceMount, children, container } = props;
  const context = usePopoverContext(PORTAL_NAME, __scopePopover);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PortalProvider, {
    scope: __scopePopover,
    forceMount,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Presence, {
      present: forceMount || context.open,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Portal, {
        asChild: true,
        container,
        children,
      }),
    }),
  });
}, "PopoverPortal");
var CONTENT_NAME = "PopoverContent";
var PopoverContent$1 = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function PopoverContent2(props, forwardedRef) {
    const portalContext = usePortalContext(CONTENT_NAME, props.__scopePopover);
    const { forceMount = portalContext.forceMount, ...contentProps } = props;
    const context = usePopoverContext(CONTENT_NAME, props.__scopePopover);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Presence, {
      present: forceMount || context.open,
      children: context.modal
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContentModal, {
            ...contentProps,
            ref: forwardedRef,
          })
        : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContentNonModal, {
            ...contentProps,
            ref: forwardedRef,
          }),
    });
  }, "PopoverContent"),
);
var Slot = createSlot("PopoverContent.RemoveScroll");
var PopoverContentModal = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function PopoverContentModal2(props, forwardedRef) {
    const context = usePopoverContext(CONTENT_NAME, props.__scopePopover);
    const contentRef = import_react.useRef(null);
    const composedRefs = useComposedRefs(forwardedRef, contentRef);
    const isRightClickOutsideRef = import_react.useRef(false);
    const { nodes: branchNodes, registry: branchRegistry } = useFocusScopeBranchRegistry();
    import_react.useEffect(() => {
      const content = contentRef.current;
      if (content) return hideOthers(content);
    }, []);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReactRemoveScroll, {
      as: Slot,
      allowPinchZoom: true,
      shards: import_react.useMemo(
        () => [contentRef, ...branchNodes.map((node) => ({ current: node }))],
        [contentRef, branchNodes],
      ),
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContentImpl, {
        ...props,
        ref: composedRefs,
        branchNodes,
        branchRegistry,
        trapFocus: context.open,
        disableOutsidePointerEvents: true,
        onCloseAutoFocus: composeEventHandlers(props.onCloseAutoFocus, (event) => {
          event.preventDefault();
          if (!isRightClickOutsideRef.current) context.triggerRef.current?.focus();
        }),
        onPointerDownOutside: composeEventHandlers(
          props.onPointerDownOutside,
          (event) => {
            const originalEvent = event.detail.originalEvent;
            const ctrlLeftClick = originalEvent.button === 0 && originalEvent.ctrlKey === true;
            const isRightClick = originalEvent.button === 2 || ctrlLeftClick;
            isRightClickOutsideRef.current = isRightClick;
          },
          { checkForDefaultPrevented: false },
        ),
        onFocusOutside: composeEventHandlers(
          props.onFocusOutside,
          (event) => event.preventDefault(),
          { checkForDefaultPrevented: false },
        ),
      }),
    });
  }, "PopoverContentModal"),
);
var PopoverContentNonModal = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function PopoverContentNonModal2(props, forwardedRef) {
    const context = usePopoverContext(CONTENT_NAME, props.__scopePopover);
    const hasInteractedOutsideRef = import_react.useRef(false);
    const hasPointerDownOutsideRef = import_react.useRef(false);
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContentImpl, {
      ...props,
      ref: forwardedRef,
      trapFocus: false,
      disableOutsidePointerEvents: false,
      onCloseAutoFocus: (event) => {
        props.onCloseAutoFocus?.(event);
        if (!event.defaultPrevented) {
          if (!hasInteractedOutsideRef.current) context.triggerRef.current?.focus();
          event.preventDefault();
        }
        hasInteractedOutsideRef.current = false;
        hasPointerDownOutsideRef.current = false;
      },
      onInteractOutside: (event) => {
        props.onInteractOutside?.(event);
        if (!event.defaultPrevented) {
          hasInteractedOutsideRef.current = true;
          if (event.detail.originalEvent.type === "pointerdown")
            hasPointerDownOutsideRef.current = true;
        }
        const target = event.target;
        if (context.triggerRef.current?.contains(target)) event.preventDefault();
        if (event.detail.originalEvent.type === "focusin" && hasPointerDownOutsideRef.current)
          event.preventDefault();
      },
    });
  }, "PopoverContentNonModal"),
);
var PopoverContentImpl = /* @__PURE__ */ import_react.forwardRef(
  /* @__PURE__ */ __name(function PopoverContentImpl2(props, forwardedRef) {
    const {
      __scopePopover,
      trapFocus,
      onOpenAutoFocus,
      onCloseAutoFocus,
      disableOutsidePointerEvents,
      onEscapeKeyDown,
      onPointerDownOutside,
      onFocusOutside,
      onInteractOutside,
      "aria-describedby": ariaDescribedby,
      branchNodes,
      branchRegistry,
      ...contentProps
    } = props;
    const context = usePopoverContext(CONTENT_NAME, __scopePopover);
    const popperScope = usePopperScope(__scopePopover);
    const [contentNode, setContentNode] = import_react.useState(null);
    const composedRefs = useComposedRefs(forwardedRef, setContentNode);
    useFocusScopeBranch(contentNode);
    useFocusGuards();
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FocusScopeBranchProvider, {
      registry: branchRegistry,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FocusScope, {
        asChild: true,
        loop: true,
        trapped: trapFocus,
        branches: branchNodes,
        onMountAutoFocus: onOpenAutoFocus,
        onUnmountAutoFocus: onCloseAutoFocus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DismissableLayer, {
          asChild: true,
          disableOutsidePointerEvents,
          onInteractOutside,
          onEscapeKeyDown,
          onPointerDownOutside,
          onFocusOutside,
          onDismiss: () => context.onOpenChange(false),
          deferPointerDownOutside: true,
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopperContent, {
            "data-state": getState(context.open),
            role: "dialog",
            id: context.contentId,
            "aria-labelledby": context.titlePresent ? context.titleId : void 0,
            "aria-describedby": context.descriptionPresent
              ? concatAriaDescribedby(ariaDescribedby, context.descriptionId)
              : ariaDescribedby,
            ...popperScope,
            ...contentProps,
            ref: composedRefs,
            style: {
              ...contentProps.style,
              "--radix-popover-content-transform-origin": "var(--radix-popper-transform-origin)",
              "--radix-popover-content-available-width": "var(--radix-popper-available-width)",
              "--radix-popover-content-available-height": "var(--radix-popper-available-height)",
              "--radix-popover-trigger-width": "var(--radix-popper-anchor-width)",
              "--radix-popover-trigger-height": "var(--radix-popper-anchor-height)",
            },
          }),
        }),
      }),
    });
  }, "PopoverContentImpl"),
);
function getState(open) {
  return open ? "open" : "closed";
}
__name(getState, "getState");
function concatAriaDescribedby(...values) {
  const ids = /* @__PURE__ */ new Set();
  for (const value of values) {
    if (typeof value !== "string") continue;
    for (const id of String(value).trim().split(/\s+/)) if (id) ids.add(id);
  }
  return ids.size > 0 ? Array.from(ids).join(" ") : void 0;
}
__name(concatAriaDescribedby, "concatAriaDescribedby");
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/plus.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$1 = {
  name: "plus",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M5 12h14",
        key: "1ays0h",
      },
    ],
    [
      "path",
      {
        d: "M12 5v14",
        key: "s699le",
      },
    ],
  ],
};
__iconData$1.node;
var Plus = createLucideIcon(__iconData$1);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/search.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData = {
  name: "search",
  size: 24,
  node: [
    [
      "path",
      {
        d: "m21 21-4.34-4.34",
        key: "14j7rj",
      },
    ],
    [
      "circle",
      {
        cx: "11",
        cy: "11",
        r: "8",
        key: "4ej97u",
      },
    ],
  ],
};
__iconData.node;
var Search = createLucideIcon(__iconData);
//#endregion
//#region ../../node_modules/.pnpm/cmdk@1.1.1_@types+react-dom@19.3.0_@types+react@19.3.0__@types+react@19.3.0_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/cmdk/dist/chunk-NZJY6EH4.mjs
var U = 1;
var Y$1 = 0.9;
var H = 0.8;
var J = 0.17;
var p = 0.1;
var u = 0.999;
var $ = 0.9999;
var k$1 = 0.99;
var m = /[\\/_+.#"@[({&]/;
var B$1 = /[\\/_+.#"@[({&]/g;
var K$1 = /[\s-]/;
var X = /[\s-]/g;
function G(_, C, h, P, A, f, O) {
  if (f === C.length) return A === _.length ? U : k$1;
  var T = `${A},${f}`;
  if (O[T] !== void 0) return O[T];
  for (var L = P.charAt(f), c = h.indexOf(L, A), S = 0, E, N, R, M; c >= 0;)
    ((E = G(_, C, h, P, c + 1, f + 1, O)),
      E > S &&
        (c === A
          ? (E *= U)
          : m.test(_.charAt(c - 1))
            ? ((E *= H),
              (R = _.slice(A, c - 1).match(B$1)),
              R && A > 0 && (E *= Math.pow(u, R.length)))
            : K$1.test(_.charAt(c - 1))
              ? ((E *= Y$1),
                (M = _.slice(A, c - 1).match(X)),
                M && A > 0 && (E *= Math.pow(u, M.length)))
              : ((E *= J), A > 0 && (E *= Math.pow(u, c - A))),
        _.charAt(c) !== C.charAt(f) && (E *= $)),
      ((E < p && h.charAt(c - 1) === P.charAt(f + 1)) ||
        (P.charAt(f + 1) === P.charAt(f) && h.charAt(c - 1) !== P.charAt(f))) &&
        ((N = G(_, C, h, P, c + 1, f + 2, O)), N * p > E && (E = N * p)),
      E > S && (S = E),
      (c = h.indexOf(L, c + 1)));
  return ((O[T] = S), S);
}
function D(_) {
  return _.toLowerCase().replace(X, " ");
}
function W(_, C, h) {
  return ((_ = h && h.length > 0 ? `${_ + " " + h.join(" ")}` : _), G(_, C, D(_), D(C), 0, 0, {}));
}
//#endregion
//#region ../../node_modules/.pnpm/cmdk@1.1.1_@types+react-dom@19.3.0_@types+react@19.3.0__@types+react@19.3.0_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/cmdk/dist/index.mjs
var N = '[cmdk-group=""]';
var Y = '[cmdk-group-items=""]';
var be = '[cmdk-group-heading=""]';
var le = '[cmdk-item=""]';
var ce = `${le}:not([aria-disabled="true"])`;
var Z = "cmdk-item-select";
var T = "data-value";
var Re = (r, o, n) => W(r, o, n);
var ue = import_react.createContext(void 0);
var K = () => import_react.useContext(ue);
var de = import_react.createContext(void 0);
var ee = () => import_react.useContext(de);
var fe = import_react.createContext(void 0);
var me = import_react.forwardRef((r, o) => {
  let n = L(() => {
      var e, a;
      return {
        search: "",
        value: (a = (e = r.value) != null ? e : r.defaultValue) != null ? a : "",
        selectedItemId: void 0,
        filtered: {
          count: 0,
          items: /* @__PURE__ */ new Map(),
          groups: /* @__PURE__ */ new Set(),
        },
      };
    }),
    u = L(() => /* @__PURE__ */ new Set()),
    c = L(() => /* @__PURE__ */ new Map()),
    d = L(() => /* @__PURE__ */ new Map()),
    f = L(() => /* @__PURE__ */ new Set()),
    p = pe(r),
    {
      label: b,
      children: m,
      value: R,
      onValueChange: x,
      filter: C,
      shouldFilter: S,
      loop: A,
      disablePointerSelection: ge = !1,
      vimBindings: j = !0,
      ...O
    } = r,
    $ = useId(),
    q = useId(),
    _ = useId(),
    I = import_react.useRef(null),
    v = ke();
  (k(() => {
    if (R !== void 0) {
      let e = R.trim();
      ((n.current.value = e), E.emit());
    }
  }, [R]),
    k(() => {
      v(6, ne);
    }, []));
  let E = import_react.useMemo(
      () => ({
        subscribe: (e) => (f.current.add(e), () => f.current.delete(e)),
        snapshot: () => n.current,
        setState: (e, a, s) => {
          var i, l, g, y;
          if (!Object.is(n.current[e], a)) {
            if (((n.current[e] = a), e === "search")) (J(), z(), v(1, W));
            else if (e === "value") {
              if (
                document.activeElement.hasAttribute("cmdk-input") ||
                document.activeElement.hasAttribute("cmdk-root")
              ) {
                let h = document.getElementById(_);
                h ? h.focus() : (i = document.getElementById($)) == null || i.focus();
              }
              if (
                (v(7, () => {
                  var h;
                  ((n.current.selectedItemId = (h = M()) == null ? void 0 : h.id), E.emit());
                }),
                s || v(5, ne),
                ((l = p.current) == null ? void 0 : l.value) !== void 0)
              ) {
                let h = a != null ? a : "";
                (y = (g = p.current).onValueChange) == null || y.call(g, h);
                return;
              }
            }
            E.emit();
          }
        },
        emit: () => {
          f.current.forEach((e) => e());
        },
      }),
      [],
    ),
    U = import_react.useMemo(
      () => ({
        value: (e, a, s) => {
          var i;
          a !== ((i = d.current.get(e)) == null ? void 0 : i.value) &&
            (d.current.set(e, {
              value: a,
              keywords: s,
            }),
            n.current.filtered.items.set(e, te(a, s)),
            v(2, () => {
              (z(), E.emit());
            }));
        },
        item: (e, a) => (
          u.current.add(e),
          a &&
            (c.current.has(a)
              ? c.current.get(a).add(e)
              : c.current.set(a, /* @__PURE__ */ new Set([e]))),
          v(3, () => {
            (J(), z(), n.current.value || W(), E.emit());
          }),
          () => {
            (d.current.delete(e), u.current.delete(e), n.current.filtered.items.delete(e));
            let s = M();
            v(4, () => {
              (J(), (s == null ? void 0 : s.getAttribute("id")) === e && W(), E.emit());
            });
          }
        ),
        group: (e) => (
          c.current.has(e) || c.current.set(e, /* @__PURE__ */ new Set()),
          () => {
            (d.current.delete(e), c.current.delete(e));
          }
        ),
        filter: () => p.current.shouldFilter,
        label: b || r["aria-label"],
        getDisablePointerSelection: () => p.current.disablePointerSelection,
        listId: $,
        inputId: _,
        labelId: q,
        listInnerRef: I,
      }),
      [],
    );
  function te(e, a) {
    var i, l;
    let s = (l = (i = p.current) == null ? void 0 : i.filter) != null ? l : Re;
    return e ? s(e, n.current.search, a) : 0;
  }
  function z() {
    if (!n.current.search || p.current.shouldFilter === !1) return;
    let e = n.current.filtered.items,
      a = [];
    n.current.filtered.groups.forEach((i) => {
      let l = c.current.get(i),
        g = 0;
      (l.forEach((y) => {
        let h = e.get(y);
        g = Math.max(h, g);
      }),
        a.push([i, g]));
    });
    let s = I.current;
    (V()
      .sort((i, l) => {
        var h, F;
        let g = i.getAttribute("id"),
          y = l.getAttribute("id");
        return ((h = e.get(y)) != null ? h : 0) - ((F = e.get(g)) != null ? F : 0);
      })
      .forEach((i) => {
        let l = i.closest(Y);
        l
          ? l.appendChild(i.parentElement === l ? i : i.closest(`${Y} > *`))
          : s.appendChild(i.parentElement === s ? i : i.closest(`${Y} > *`));
      }),
      a
        .sort((i, l) => l[1] - i[1])
        .forEach((i) => {
          var g;
          let l =
            (g = I.current) == null
              ? void 0
              : g.querySelector(`${N}[${T}="${encodeURIComponent(i[0])}"]`);
          l?.parentElement.appendChild(l);
        }));
  }
  function W() {
    let e = V().find((s) => s.getAttribute("aria-disabled") !== "true"),
      a = e == null ? void 0 : e.getAttribute(T);
    E.setState("value", a || void 0);
  }
  function J() {
    var a, s, i, l;
    if (!n.current.search || p.current.shouldFilter === !1) {
      n.current.filtered.count = u.current.size;
      return;
    }
    n.current.filtered.groups = /* @__PURE__ */ new Set();
    let e = 0;
    for (let g of u.current) {
      let F = te(
        (s = (a = d.current.get(g)) == null ? void 0 : a.value) != null ? s : "",
        (l = (i = d.current.get(g)) == null ? void 0 : i.keywords) != null ? l : [],
      );
      (n.current.filtered.items.set(g, F), F > 0 && e++);
    }
    for (let [g, y] of c.current)
      for (let h of y)
        if (n.current.filtered.items.get(h) > 0) {
          n.current.filtered.groups.add(g);
          break;
        }
    n.current.filtered.count = e;
  }
  function ne() {
    var a, s, i;
    let e = M();
    e &&
      (((a = e.parentElement) == null ? void 0 : a.firstChild) === e &&
        ((i = (s = e.closest(N)) == null ? void 0 : s.querySelector(be)) == null ||
          i.scrollIntoView({ block: "nearest" })),
      e.scrollIntoView({ block: "nearest" }));
  }
  function M() {
    var e;
    return (e = I.current) == null ? void 0 : e.querySelector(`${le}[aria-selected="true"]`);
  }
  function V() {
    var e;
    return Array.from(((e = I.current) == null ? void 0 : e.querySelectorAll(ce)) || []);
  }
  function X(e) {
    let s = V()[e];
    s && E.setState("value", s.getAttribute(T));
  }
  function Q(e) {
    var g;
    let a = M(),
      s = V(),
      i = s.findIndex((y) => y === a),
      l = s[i + e];
    ((g = p.current) != null &&
      g.loop &&
      (l = i + e < 0 ? s[s.length - 1] : i + e === s.length ? s[0] : s[i + e]),
      l && E.setState("value", l.getAttribute(T)));
  }
  function re(e) {
    let a = M(),
      s = a == null ? void 0 : a.closest(N),
      i;
    for (; s && !i;)
      ((s = e > 0 ? we(s, N) : De(s, N)), (i = s == null ? void 0 : s.querySelector(ce)));
    i ? E.setState("value", i.getAttribute(T)) : Q(e);
  }
  let oe = () => X(V().length - 1),
    ie = (e) => {
      (e.preventDefault(), e.metaKey ? oe() : e.altKey ? re(1) : Q(1));
    },
    se = (e) => {
      (e.preventDefault(), e.metaKey ? X(0) : e.altKey ? re(-1) : Q(-1));
    };
  return import_react.createElement(
    Primitive.div,
    {
      ref: o,
      tabIndex: -1,
      ...O,
      "cmdk-root": "",
      onKeyDown: (e) => {
        var s;
        (s = O.onKeyDown) == null || s.call(O, e);
        let a = e.nativeEvent.isComposing || e.keyCode === 229;
        if (!(e.defaultPrevented || a))
          switch (e.key) {
            case "n":
            case "j":
              j && e.ctrlKey && ie(e);
              break;
            case "ArrowDown":
              ie(e);
              break;
            case "p":
            case "k":
              j && e.ctrlKey && se(e);
              break;
            case "ArrowUp":
              se(e);
              break;
            case "Home":
              (e.preventDefault(), X(0));
              break;
            case "End":
              (e.preventDefault(), oe());
              break;
            case "Enter": {
              e.preventDefault();
              let i = M();
              if (i) {
                let l = new Event(Z);
                i.dispatchEvent(l);
              }
            }
          }
      },
    },
    import_react.createElement(
      "label",
      {
        "cmdk-label": "",
        htmlFor: U.inputId,
        id: U.labelId,
        style: Te,
      },
      b,
    ),
    B(r, (e) =>
      import_react.createElement(
        de.Provider,
        { value: E },
        import_react.createElement(ue.Provider, { value: U }, e),
      ),
    ),
  );
});
var he = import_react.forwardRef((r, o) => {
  var _, I;
  let n = useId(),
    u = import_react.useRef(null),
    c = import_react.useContext(fe),
    d = K(),
    f = pe(r),
    p =
      (I = (_ = f.current) == null ? void 0 : _.forceMount) != null
        ? I
        : c == null
          ? void 0
          : c.forceMount;
  k(() => {
    if (!p) return d.item(n, c == null ? void 0 : c.id);
  }, [p]);
  let b = ve(n, u, [r.value, r.children, u], r.keywords),
    m = ee(),
    R = P((v) => v.value && v.value === b.current),
    x = P((v) => (p || d.filter() === !1 ? !0 : v.search ? v.filtered.items.get(n) > 0 : !0));
  import_react.useEffect(() => {
    let v = u.current;
    if (!(!v || r.disabled)) return (v.addEventListener(Z, C), () => v.removeEventListener(Z, C));
  }, [x, r.onSelect, r.disabled]);
  function C() {
    var v, E;
    (S(), (E = (v = f.current).onSelect) == null || E.call(v, b.current));
  }
  function S() {
    m.setState("value", b.current, !0);
  }
  if (!x) return null;
  let { disabled: A, value: ge, onSelect: j, forceMount: O, keywords: $, ...q } = r;
  return import_react.createElement(
    Primitive.div,
    {
      ref: composeRefs(u, o),
      ...q,
      id: n,
      "cmdk-item": "",
      role: "option",
      "aria-disabled": !!A,
      "aria-selected": !!R,
      "data-disabled": !!A,
      "data-selected": !!R,
      onPointerMove: A || d.getDisablePointerSelection() ? void 0 : S,
      onClick: A ? void 0 : C,
    },
    r.children,
  );
});
var Ee = import_react.forwardRef((r, o) => {
  let { heading: n, children: u, forceMount: c, ...d } = r,
    f = useId(),
    p = import_react.useRef(null),
    b = import_react.useRef(null),
    m = useId(),
    R = K(),
    x = P((S) => (c || R.filter() === !1 ? !0 : S.search ? S.filtered.groups.has(f) : !0));
  (k(() => R.group(f), []), ve(f, p, [r.value, r.heading, b]));
  let C = import_react.useMemo(
    () => ({
      id: f,
      forceMount: c,
    }),
    [c],
  );
  return import_react.createElement(
    Primitive.div,
    {
      ref: composeRefs(p, o),
      ...d,
      "cmdk-group": "",
      role: "presentation",
      hidden: x ? void 0 : !0,
    },
    n &&
      import_react.createElement(
        "div",
        {
          ref: b,
          "cmdk-group-heading": "",
          "aria-hidden": !0,
          id: m,
        },
        n,
      ),
    B(r, (S) =>
      import_react.createElement(
        "div",
        {
          "cmdk-group-items": "",
          role: "group",
          "aria-labelledby": n ? m : void 0,
        },
        import_react.createElement(fe.Provider, { value: C }, S),
      ),
    ),
  );
});
var ye = import_react.forwardRef((r, o) => {
  let { alwaysRender: n, ...u } = r,
    c = import_react.useRef(null),
    d = P((f) => !f.search);
  return !n && !d
    ? null
    : import_react.createElement(Primitive.div, {
        ref: composeRefs(c, o),
        ...u,
        "cmdk-separator": "",
        role: "separator",
      });
});
var Se = import_react.forwardRef((r, o) => {
  let { onValueChange: n, ...u } = r,
    c = r.value != null,
    d = ee(),
    f = P((m) => m.search),
    p = P((m) => m.selectedItemId),
    b = K();
  return (
    import_react.useEffect(() => {
      r.value != null && d.setState("search", r.value);
    }, [r.value]),
    import_react.createElement(Primitive.input, {
      ref: o,
      ...u,
      "cmdk-input": "",
      autoComplete: "off",
      autoCorrect: "off",
      spellCheck: !1,
      "aria-autocomplete": "list",
      role: "combobox",
      "aria-expanded": !0,
      "aria-controls": b.listId,
      "aria-labelledby": b.labelId,
      "aria-activedescendant": p,
      id: b.inputId,
      type: "text",
      value: c ? r.value : f,
      onChange: (m) => {
        (c || d.setState("search", m.target.value), n?.(m.target.value));
      },
    })
  );
});
var Ce = import_react.forwardRef((r, o) => {
  let { children: n, label: u = "Suggestions", ...c } = r,
    d = import_react.useRef(null),
    f = import_react.useRef(null),
    p = P((m) => m.selectedItemId),
    b = K();
  return (
    import_react.useEffect(() => {
      if (f.current && d.current) {
        let m = f.current,
          R = d.current,
          x,
          C = new ResizeObserver(() => {
            x = requestAnimationFrame(() => {
              let S = m.offsetHeight;
              R.style.setProperty("--cmdk-list-height", S.toFixed(1) + "px");
            });
          });
        return (
          C.observe(m),
          () => {
            (cancelAnimationFrame(x), C.unobserve(m));
          }
        );
      }
    }, []),
    import_react.createElement(
      Primitive.div,
      {
        ref: composeRefs(d, o),
        ...c,
        "cmdk-list": "",
        role: "listbox",
        tabIndex: -1,
        "aria-activedescendant": p,
        "aria-label": u,
        id: b.listId,
      },
      B(r, (m) =>
        import_react.createElement(
          "div",
          {
            ref: composeRefs(f, b.listInnerRef),
            "cmdk-list-sizer": "",
          },
          m,
        ),
      ),
    )
  );
});
var xe = import_react.forwardRef((r, o) => {
  let {
    open: n,
    onOpenChange: u,
    overlayClassName: c,
    contentClassName: d,
    container: f,
    ...p
  } = r;
  return import_react.createElement(
    Dialog,
    {
      open: n,
      onOpenChange: u,
    },
    import_react.createElement(
      DialogPortal,
      { container: f },
      import_react.createElement(DialogOverlay, {
        "cmdk-overlay": "",
        className: c,
      }),
      import_react.createElement(
        DialogContent,
        {
          "aria-label": r.label,
          "cmdk-dialog": "",
          className: d,
        },
        import_react.createElement(me, {
          ref: o,
          ...p,
        }),
      ),
    ),
  );
});
var Ie = import_react.forwardRef((r, o) =>
  P((u) => u.filtered.count === 0)
    ? import_react.createElement(Primitive.div, {
        ref: o,
        ...r,
        "cmdk-empty": "",
        role: "presentation",
      })
    : null,
);
var Pe = import_react.forwardRef((r, o) => {
  let { progress: n, children: u, label: c = "Loading...", ...d } = r;
  return import_react.createElement(
    Primitive.div,
    {
      ref: o,
      ...d,
      "cmdk-loading": "",
      role: "progressbar",
      "aria-valuenow": n,
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-label": c,
    },
    B(r, (f) => import_react.createElement("div", { "aria-hidden": !0 }, f)),
  );
});
var _e = Object.assign(me, {
  List: Ce,
  Item: he,
  Input: Se,
  Group: Ee,
  Separator: ye,
  Dialog: xe,
  Empty: Ie,
  Loading: Pe,
});
function we(r, o) {
  let n = r.nextElementSibling;
  for (; n;) {
    if (n.matches(o)) return n;
    n = n.nextElementSibling;
  }
}
function De(r, o) {
  let n = r.previousElementSibling;
  for (; n;) {
    if (n.matches(o)) return n;
    n = n.previousElementSibling;
  }
}
function pe(r) {
  let o = import_react.useRef(r);
  return (
    k(() => {
      o.current = r;
    }),
    o
  );
}
var k = typeof window == "undefined" ? import_react.useEffect : import_react.useLayoutEffect;
function L(r) {
  let o = import_react.useRef();
  return (o.current === void 0 && (o.current = r()), o);
}
function P(r) {
  let o = ee(),
    n = () => r(o.snapshot());
  return import_react.useSyncExternalStore(o.subscribe, n, n);
}
function ve(r, o, n, u = []) {
  let c = import_react.useRef(),
    d = K();
  return (
    k(() => {
      var b;
      let f = (() => {
          var m;
          for (let R of n) {
            if (typeof R == "string") return R.trim();
            if (typeof R == "object" && "current" in R)
              return R.current
                ? (m = R.current.textContent) == null
                  ? void 0
                  : m.trim()
                : c.current;
          }
        })(),
        p = u.map((m) => m.trim());
      (d.value(r, f, p), (b = o.current) == null || b.setAttribute(T, f), (c.current = f));
    }),
    c
  );
}
var ke = () => {
  let [r, o] = import_react.useState(),
    n = L(() => /* @__PURE__ */ new Map());
  return (
    k(() => {
      (n.current.forEach((u) => u()), (n.current = /* @__PURE__ */ new Map()));
    }, [r]),
    (u, c) => {
      (n.current.set(u, c), o({}));
    }
  );
};
function Me(r) {
  let o = r.type;
  return typeof o == "function" ? o(r.props) : "render" in o ? o.render(r.props) : r;
}
function B({ asChild: r, children: o }, n) {
  return r && import_react.isValidElement(o)
    ? import_react.cloneElement(Me(o), { ref: o.ref }, n(o.props.children))
    : n(o);
}
var Te = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: "0",
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: "0",
};
//#endregion
//#region ../../packages/ui/src/components/command.tsx
function Command({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e, {
    "data-slot": "command",
    className: cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    ),
    ...props,
  });
}
function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = true,
  onCloseAutoFocus,
  ...props
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Dialog$1, {
    ...props,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
        className: "sr-only",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, { children: description }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogContent$1, {
        className: cn("overflow-hidden p-0", className),
        showCloseButton,
        onCloseAutoFocus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Command, {
          className:
            "**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5",
          children,
        }),
      }),
    ],
  });
}
function CommandInput({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    "data-slot": "command-input-wrapper",
    className: "flex h-9 items-center gap-2 border-b px-3",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
        className: "size-4 shrink-0 opacity-50",
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Input, {
        "data-slot": "command-input",
        className: cn(
          "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ),
        ...props,
      }),
    ],
  });
}
function CommandList({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.List, {
    "data-slot": "command-list",
    className: cn("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto", className),
    ...props,
  });
}
function CommandEmpty({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Empty, {
    "data-slot": "command-empty",
    className: "py-6 text-center text-sm",
    ...props,
  });
}
function CommandGroup({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Group, {
    "data-slot": "command-group",
    className: cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    ),
    ...props,
  });
}
function CommandItem({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(_e.Item, {
    "data-slot": "command-item",
    className: cn(
      "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
      className,
    ),
    ...props,
  });
}
//#endregion
//#region ../../packages/ui/src/components/popover.tsx
function Popover({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Popover$1, {
    "data-slot": "popover",
    ...props,
  });
}
function PopoverTrigger({ ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverTrigger$1, {
    "data-slot": "popover-trigger",
    ...props,
  });
}
function PopoverContent({ className, align = "center", sideOffset = 4, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverPortal, {
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PopoverContent$1, {
      "data-slot": "popover-content",
      align,
      sideOffset,
      className: cn(
        "z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      ),
      ...props,
    }),
  });
}
//#endregion
export {
  CommandDialog as a,
  CommandInput as c,
  Search as d,
  Plus as f,
  Command as i,
  CommandItem as l,
  PopoverContent as n,
  CommandEmpty as o,
  PopoverTrigger as r,
  CommandGroup as s,
  Popover as t,
  CommandList as u,
};
