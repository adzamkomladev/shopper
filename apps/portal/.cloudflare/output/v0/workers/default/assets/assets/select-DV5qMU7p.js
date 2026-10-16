import {
  Bt as e,
  Ht as t,
  Vt as n,
  Wt as r,
  _ as i,
  f as a,
  g as o,
  m as s,
  t as c,
} from "./createLucideIcon-BBeoGZx-.js";
import { a as l, o as u } from "./alert-BTZapdK4.js";
import {
  C as d,
  S as f,
  _ as p,
  b as m,
  d as h,
  f as g,
  l as _,
  p as v,
  u as y,
  v as b,
  w as x,
  x as S,
  y as C,
} from "./x-B76tEvwZ.js";
import { a as w, i as T, n as E, o as D, r as O, s as k, t as A } from "./check-bZy7kAyE.js";
import { i as j, o as ee, t as te } from "./field-BUpdDBSZ.js";
var M = r(n(), 1),
  N = r(t(), 1),
  P = e(),
  F = Object.freeze({
    position: `absolute`,
    border: 0,
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: `hidden`,
    clip: `rect(0, 0, 0, 0)`,
    whiteSpace: `nowrap`,
    wordWrap: `normal`,
  }),
  I = Object.defineProperty,
  ne = (e, t) => I(e, `name`, { value: t, configurable: !0 });
function L(e) {
  let t = N.useRef({ value: e, previous: e });
  return N.useMemo(
    () => (
      t.current.value !== e && ((t.current.previous = t.current.value), (t.current.value = e)),
      t.current.previous
    ),
    [e],
  );
}
ne(L, `usePrevious`);
var R = Object.defineProperty,
  z = (e, t) => R(e, `name`, { value: t, configurable: !0 });
function B(e, [t, n]) {
  return Math.min(n, Math.max(t, e));
}
z(B, `clamp`);
var V = Object.defineProperty,
  H = (e, t) => V(e, `name`, { value: t, configurable: !0 }),
  re = { ItemAligned: `item-aligned`, Popper: `popper` },
  ie = { LTR: `ltr`, RTL: `rtl` },
  ae = [` `, `Enter`, `ArrowUp`, `ArrowDown`],
  oe = [` `, `Enter`],
  U = `Select`,
  [W, G, se] = k(U),
  [K, ce] = x(U, [se, w]),
  le = w(),
  [ue, q] = K(U),
  [de, fe] = K(U);
function pe(e) {
  let {
      __scopeSelect: t,
      children: n,
      open: r,
      defaultOpen: i,
      onOpenChange: a,
      value: o,
      defaultValue: s,
      onValueChange: c,
      dir: l,
      name: u,
      autoComplete: d,
      disabled: f,
      required: p,
      form: m,
      internal_do_not_use_render: h,
    } = e,
    g = le(t),
    [_, v] = N.useState(null),
    [y, b] = N.useState(null),
    [x, w] = N.useState(!1),
    T = D(l),
    [O, k] = S({ prop: r, defaultProp: i ?? !1, onChange: a, caller: U }),
    [A, j] = S({ prop: o, defaultProp: s, onChange: c, caller: U }),
    ee = N.useRef(null),
    te = N.useRef(A);
  N.useEffect(() => {
    let e = m ? _?.ownerDocument.getElementById(m) : _?.form;
    if (e instanceof HTMLFormElement) {
      let t = H(() => j(te.current), `reset`);
      return (e.addEventListener(`reset`, t), () => e.removeEventListener(`reset`, t));
    }
  }, [m, _, j]);
  let M = !_ || !!m || !!_.closest(`form`),
    [F, I] = N.useState(new Set()),
    ne = C(),
    L = Array.from(F)
      .map((e) => e.props.value)
      .join(`;`),
    R = N.useCallback((e) => {
      I((t) => new Set(t).add(e));
    }, []),
    z = N.useCallback((e) => {
      I((t) => {
        let n = new Set(t);
        return (n.delete(e), n);
      });
    }, []),
    B = {
      required: p,
      trigger: _,
      onTriggerChange: v,
      valueNode: y,
      onValueNodeChange: b,
      valueNodeHasChildren: x,
      onValueNodeHasChildrenChange: w,
      contentId: ne,
      value: A,
      onValueChange: j,
      open: O,
      onOpenChange: k,
      dir: T,
      triggerPointerDownPosRef: ee,
      disabled: f,
      name: u,
      autoComplete: d,
      form: m,
      nativeOptions: F,
      nativeSelectKey: L,
      isFormControl: M,
    };
  return (0, P.jsx)(E, {
    ...g,
    children: (0, P.jsx)(ue, {
      scope: t,
      ...B,
      children: (0, P.jsx)(W.Provider, {
        scope: t,
        children: (0, P.jsx)(de, {
          scope: t,
          onNativeOptionAdd: R,
          onNativeOptionRemove: z,
          children: Xe(h) ? h(B) : n,
        }),
      }),
    }),
  });
}
H(pe, `SelectProvider`);
var me = H((e) => {
    let { __scopeSelect: t, children: n, ...r } = e;
    return (0, P.jsx)(pe, {
      __scopeSelect: t,
      ...r,
      internal_do_not_use_render: ({ isFormControl: e }) =>
        (0, P.jsxs)(P.Fragment, { children: [n, e ? (0, P.jsx)(Ye, { __scopeSelect: t }) : null] }),
    });
  }, `Select`),
  he = `SelectTrigger`,
  ge = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, disabled: r = !1, ...i } = e,
        a = le(n),
        o = q(he, n),
        c = o.disabled || r,
        l = s(t, o.onTriggerChange),
        f = G(n),
        p = N.useRef(`touch`),
        [m, h, g] = Ze((e) => {
          let t = f().filter((e) => !e.disabled),
            n = Qe(
              t,
              e,
              t.find((e) => e.value === o.value),
            );
          n !== void 0 && o.onValueChange(n.value);
        }),
        _ = H((e) => {
          (c || (o.onOpenChange(!0), g()),
            e &&
              (o.triggerPointerDownPosRef.current = {
                x: Math.round(e.pageX),
                y: Math.round(e.pageY),
              }));
        }, `handleOpen`);
      return (0, P.jsx)(O, {
        asChild: !0,
        ...a,
        children: (0, P.jsx)(u.button, {
          type: `button`,
          role: `combobox`,
          "aria-controls": o.open ? o.contentId : void 0,
          "aria-expanded": o.open,
          "aria-required": o.required,
          "aria-autocomplete": `none`,
          dir: o.dir,
          "data-state": o.open ? `open` : `closed`,
          disabled: c,
          "data-disabled": c ? `` : void 0,
          "data-placeholder": Q(o.value) ? `` : void 0,
          ...i,
          ref: l,
          onClick: d(i.onClick, (e) => {
            (e.currentTarget.focus(), p.current !== `mouse` && _(e));
          }),
          onPointerDown: d(i.onPointerDown, (e) => {
            p.current = e.pointerType;
            let t = e.target;
            (t.hasPointerCapture(e.pointerId) && t.releasePointerCapture(e.pointerId),
              e.button === 0 &&
                e.ctrlKey === !1 &&
                e.pointerType === `mouse` &&
                (_(e), e.preventDefault()));
          }),
          onKeyDown: d(i.onKeyDown, (e) => {
            let t = m.current !== ``;
            (!(e.ctrlKey || e.altKey || e.metaKey) && e.key.length === 1 && h(e.key),
              !(t && e.key === ` `) && ae.includes(e.key) && (_(), e.preventDefault()));
          }),
        }),
      });
    }, `SelectTrigger`),
  ),
  _e = `SelectValue`,
  ve = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, className: r, style: i, children: a, placeholder: o = ``, ...c } = e,
        l = q(_e, n),
        { onValueNodeHasChildrenChange: d } = l,
        p = a !== void 0,
        m = s(t, l.onValueNodeChange);
      f(() => {
        d(p);
      }, [d, p]);
      let h = Q(l.value);
      return (0, P.jsx)(u.span, {
        ...c,
        asChild: !h && c.asChild,
        ref: m,
        style: { pointerEvents: `none` },
        children: (0, P.jsx)(N.Fragment, { children: h ? o : a }, h ? `placeholder` : `value`),
      });
    }, `SelectValue`),
  ),
  ye = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, children: r, ...i } = e;
      return (0, P.jsx)(u.span, { "aria-hidden": !0, ...i, ref: t, children: r || `▼` });
    }, `SelectIcon`),
  ),
  [be, xe] = K(`SelectPortal`, { forceMount: void 0 }),
  Se = H((e) => {
    let { __scopeSelect: t, forceMount: n, ...r } = e;
    return (0, P.jsx)(be, {
      scope: e.__scopeSelect,
      forceMount: n,
      children: (0, P.jsx)(g, { asChild: !0, ...r }),
    });
  }, `SelectPortal`),
  J = `SelectContent`,
  Ce = N.forwardRef(
    H(function (e, t) {
      let n = xe(J, e.__scopeSelect),
        { forceMount: r = n.forceMount, ...i } = e,
        a = q(J, e.__scopeSelect),
        [o, s] = N.useState();
      return (
        f(() => {
          s(new DocumentFragment());
        }, []),
        (0, P.jsx)(m, {
          present: r || a.open,
          children: ({ present: e }) =>
            e ? (0, P.jsx)(De, { ...i, ref: t }) : (0, P.jsx)(we, { ...i, fragment: o }),
        })
      );
    }, `SelectContent`),
  ),
  we = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, children: r, fragment: i } = e;
      return i
        ? M.createPortal(
            (0, P.jsx)(Te, {
              scope: n,
              children: (0, P.jsx)(W.Slot, {
                scope: n,
                children: (0, P.jsx)(`div`, { ref: t, children: r }),
              }),
            }),
            i,
          )
        : null;
    }, `SelectContentFragment`),
  ),
  Y = 10,
  [Te, X] = K(J),
  Ee = a(`SelectContent.RemoveScroll`),
  De = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n } = e,
        {
          position: r = re.ItemAligned,
          onCloseAutoFocus: i,
          onEscapeKeyDown: a,
          onPointerDownOutside: o,
          side: c,
          sideOffset: l,
          align: u,
          alignOffset: f,
          arrowPadding: m,
          collisionBoundary: g,
          collisionPadding: b,
          sticky: x,
          hideWhenDetached: S,
          avoidCollisions: C,
          ...w
        } = e,
        T = q(J, n),
        [E, D] = N.useState(null),
        [O, k] = N.useState(null),
        A = s(t, D),
        [j, ee] = N.useState(null),
        [te, M] = N.useState(null),
        F = G(n),
        [I, ne] = N.useState(!1),
        L = N.useRef(!1);
      (N.useEffect(() => {
        if (E) return _(E);
      }, [E]),
        h());
      let R = N.useCallback(
          (e) => {
            let [t, ...n] = F().map((e) => e.ref.current),
              [r] = n.slice(-1),
              i = document.activeElement;
            for (let n of e)
              if (
                n === i ||
                (n?.scrollIntoView({ block: `nearest` }),
                n === t && O && (O.scrollTop = 0),
                n === r && O && (O.scrollTop = O.scrollHeight),
                n?.focus(),
                document.activeElement !== i)
              )
                return;
          },
          [F, O],
        ),
        z = N.useCallback(() => R([j, E]), [R, j, E]);
      N.useEffect(() => {
        I && z();
      }, [I, z]);
      let { onOpenChange: B, triggerPointerDownPosRef: V } = T;
      (N.useEffect(() => {
        if (E) {
          let e = { x: 0, y: 0 },
            t = H((t) => {
              e = {
                x: Math.abs(Math.round(t.pageX) - (V.current?.x ?? 0)),
                y: Math.abs(Math.round(t.pageY) - (V.current?.y ?? 0)),
              };
            }, `handlePointerMove`),
            n = H((n) => {
              (e.x <= 10 && e.y <= 10 ? n.preventDefault() : n.composedPath().includes(E) || B(!1),
                document.removeEventListener(`pointermove`, t),
                (V.current = null));
            }, `handlePointerUp`);
          return (
            V.current !== null &&
              (document.addEventListener(`pointermove`, t),
              document.addEventListener(`pointerup`, n, { capture: !0, once: !0 })),
            () => {
              (document.removeEventListener(`pointermove`, t),
                document.removeEventListener(`pointerup`, n, { capture: !0 }));
            }
          );
        }
      }, [E, B, V]),
        N.useEffect(() => {
          let e = H(() => B(!1), `close`);
          return (
            window.addEventListener(`blur`, e),
            window.addEventListener(`resize`, e),
            () => {
              (window.removeEventListener(`blur`, e), window.removeEventListener(`resize`, e));
            }
          );
        }, [B]));
      let [ie, ae] = Ze((e) => {
          let t = F().filter((e) => !e.disabled),
            n = Qe(
              t,
              e,
              t.find((e) => e.ref.current === document.activeElement),
            );
          n && setTimeout(() => n.ref.current?.focus());
        }),
        oe = N.useCallback(
          (e, t, n) => {
            let r = !L.current && !n;
            ((T.value !== void 0 && T.value === t) || r) && (ee(e), r && (L.current = !0));
          },
          [T.value],
        ),
        U = N.useCallback(() => E?.focus(), [E]),
        W = N.useCallback(
          (e, t, n) => {
            let r = !L.current && !n;
            ((T.value !== void 0 && T.value === t) || r) && M(e);
          },
          [T.value],
        ),
        se = r === re.Popper ? ke : Oe,
        K =
          se === ke
            ? {
                side: c,
                sideOffset: l,
                align: u,
                alignOffset: f,
                arrowPadding: m,
                collisionBoundary: g,
                collisionPadding: b,
                sticky: x,
                hideWhenDetached: S,
                avoidCollisions: C,
              }
            : {};
      return (0, P.jsx)(Te, {
        scope: n,
        content: E,
        viewport: O,
        onViewportChange: k,
        itemRefCallback: oe,
        selectedItem: j,
        onItemLeave: U,
        itemTextRefCallback: W,
        focusSelectedItem: z,
        selectedItemText: te,
        position: r,
        isPositioned: I,
        searchRef: ie,
        children: (0, P.jsx)(y, {
          as: Ee,
          allowPinchZoom: !0,
          children: (0, P.jsx)(v, {
            asChild: !0,
            trapped: T.open,
            onMountAutoFocus: (e) => {
              e.preventDefault();
            },
            onUnmountAutoFocus: d(i, (e) => {
              (T.trigger?.focus({ preventScroll: !0 }), e.preventDefault());
            }),
            children: (0, P.jsx)(p, {
              asChild: !0,
              disableOutsidePointerEvents: !0,
              onEscapeKeyDown: a,
              onPointerDownOutside: o,
              onFocusOutside: (e) => e.preventDefault(),
              onDismiss: () => T.onOpenChange(!1),
              children: (0, P.jsx)(se, {
                role: `listbox`,
                id: T.contentId,
                "data-state": T.open ? `open` : `closed`,
                dir: T.dir,
                onContextMenu: (e) => e.preventDefault(),
                ...w,
                ...K,
                onPlaced: () => ne(!0),
                ref: A,
                style: { display: `flex`, flexDirection: `column`, outline: `none`, ...w.style },
                onKeyDown: d(w.onKeyDown, (e) => {
                  let t = e.ctrlKey || e.altKey || e.metaKey;
                  if (
                    (e.key === `Tab` && e.preventDefault(),
                    !t && e.key.length === 1 && ae(e.key),
                    [`ArrowUp`, `ArrowDown`, `Home`, `End`].includes(e.key))
                  ) {
                    let t = F()
                      .filter((e) => !e.disabled)
                      .map((e) => e.ref.current);
                    if (
                      ([`ArrowUp`, `End`].includes(e.key) && (t = t.slice().reverse()),
                      [`ArrowUp`, `ArrowDown`].includes(e.key))
                    ) {
                      let n = e.target,
                        r = t.indexOf(n);
                      t = t.slice(r + 1);
                    }
                    (setTimeout(() => R(t)), e.preventDefault());
                  }
                }),
              }),
            }),
          }),
        }),
      });
    }, `SelectContentImpl`),
  ),
  Oe = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, onPlaced: r, ...i } = e,
        a = q(J, n),
        o = X(J, n),
        [c, l] = N.useState(null),
        [d, p] = N.useState(null),
        m = s(t, p),
        h = G(n),
        g = N.useRef(!1),
        _ = N.useRef(!0),
        { viewport: v, selectedItem: y, selectedItemText: b, focusSelectedItem: x } = o,
        S = N.useCallback(() => {
          if (a.trigger && a.valueNode && c && d && v && y && b) {
            let e = a.trigger.getBoundingClientRect(),
              t = d.getBoundingClientRect(),
              n = a.valueNode.getBoundingClientRect(),
              i = b.getBoundingClientRect();
            if (a.dir !== ie.RTL) {
              let r = i.left - t.left,
                a = n.left - r,
                o = e.left - a,
                s = e.width + o,
                l = Math.max(s, t.width),
                u = window.innerWidth - Y,
                d = B(a, [Y, Math.max(Y, u - l)]);
              ((c.style.minWidth = s + `px`), (c.style.left = d + `px`));
            } else {
              let r = t.right - i.right,
                a = window.innerWidth - n.right - r,
                o = window.innerWidth - e.right - a,
                s = e.width + o,
                l = Math.max(s, t.width),
                u = window.innerWidth - Y,
                d = B(a, [Y, Math.max(Y, u - l)]);
              ((c.style.minWidth = s + `px`), (c.style.right = d + `px`));
            }
            let o = h(),
              s = window.innerHeight - Y * 2,
              l = v.scrollHeight,
              u = window.getComputedStyle(d),
              f = parseInt(u.borderTopWidth, 10),
              p = parseInt(u.paddingTop, 10),
              m = parseInt(u.borderBottomWidth, 10),
              _ = parseInt(u.paddingBottom, 10),
              x = f + p + l + _ + m,
              S = Math.min(y.offsetHeight * 5, x),
              C = window.getComputedStyle(v),
              w = parseInt(C.paddingTop, 10),
              T = parseInt(C.paddingBottom, 10),
              E = e.top + e.height / 2 - Y,
              D = s - E,
              O = y.offsetHeight / 2,
              k = y.offsetTop + O,
              A = f + p + k,
              j = x - A;
            if (A <= E) {
              let e = o.length > 0 && y === o[o.length - 1].ref.current;
              c.style.bottom = `0px`;
              let t = d.clientHeight - v.offsetTop - v.offsetHeight,
                n = A + Math.max(D, O + (e ? T : 0) + t + m);
              c.style.height = n + `px`;
            } else {
              let e = o.length > 0 && y === o[0].ref.current;
              c.style.top = `0px`;
              let t = Math.max(E, f + v.offsetTop + (e ? w : 0) + O) + j;
              ((c.style.height = t + `px`), (v.scrollTop = A - E + v.offsetTop));
            }
            ((c.style.margin = `${Y}px 0`),
              (c.style.minHeight = S + `px`),
              (c.style.maxHeight = s + `px`),
              r?.(),
              requestAnimationFrame(() => (g.current = !0)));
          }
        }, [h, a.trigger, a.valueNode, c, d, v, y, b, a.dir, r]);
      f(() => S(), [S]);
      let [C, w] = N.useState();
      f(() => {
        d && w(window.getComputedStyle(d).zIndex);
      }, [d]);
      let T = N.useCallback(
        (e) => {
          e && _.current === !0 && (S(), x?.(), (_.current = !1));
        },
        [S, x],
      );
      return (0, P.jsx)(Ae, {
        scope: n,
        contentWrapper: c,
        shouldExpandOnScrollRef: g,
        onScrollButtonChange: T,
        children: (0, P.jsx)(`div`, {
          ref: l,
          style: { display: `flex`, flexDirection: `column`, position: `fixed`, zIndex: C },
          children: (0, P.jsx)(u.div, {
            ...i,
            ref: m,
            style: { boxSizing: `border-box`, maxHeight: `100%`, ...i.style },
          }),
        }),
      });
    }, `SelectItemAlignedPosition`),
  ),
  ke = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, align: r = `start`, collisionPadding: i = Y, ...a } = e,
        o = le(n);
      return (0, P.jsx)(T, {
        ...o,
        ...a,
        ref: t,
        align: r,
        collisionPadding: i,
        style: {
          boxSizing: `border-box`,
          ...a.style,
          "--radix-select-content-transform-origin": `var(--radix-popper-transform-origin)`,
          "--radix-select-content-available-width": `var(--radix-popper-available-width)`,
          "--radix-select-content-available-height": `var(--radix-popper-available-height)`,
          "--radix-select-trigger-width": `var(--radix-popper-anchor-width)`,
          "--radix-select-trigger-height": `var(--radix-popper-anchor-height)`,
        },
      });
    }, `SelectPopperPosition`),
  ),
  [Ae, je] = K(J, {}),
  Me = `SelectViewport`,
  Ne = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, nonce: r, ...i } = e,
        a = X(Me, n),
        o = je(Me, n),
        c = s(t, a.onViewportChange),
        l = N.useRef(0);
      return (0, P.jsxs)(P.Fragment, {
        children: [
          (0, P.jsx)(`style`, {
            dangerouslySetInnerHTML: {
              __html: `[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}`,
            },
            nonce: r,
          }),
          (0, P.jsx)(W.Slot, {
            scope: n,
            children: (0, P.jsx)(u.div, {
              "data-radix-select-viewport": ``,
              role: `presentation`,
              ...i,
              ref: c,
              style: { position: `relative`, flex: 1, overflow: `hidden auto`, ...i.style },
              onScroll: d(i.onScroll, (e) => {
                let t = e.currentTarget,
                  { contentWrapper: n, shouldExpandOnScrollRef: r } = o;
                if (r?.current && n) {
                  let e = Math.abs(l.current - t.scrollTop);
                  if (e > 0) {
                    let r = window.innerHeight - Y * 2,
                      i = parseFloat(n.style.minHeight),
                      a = parseFloat(n.style.height),
                      o = Math.max(i, a);
                    if (o < r) {
                      let i = o + e,
                        a = Math.min(r, i),
                        s = i - a;
                      ((n.style.height = a + `px`),
                        n.style.bottom === `0px` &&
                          ((t.scrollTop = s > 0 ? s : 0), (n.style.justifyContent = `flex-end`)));
                    }
                  }
                }
                l.current = t.scrollTop;
              }),
            }),
          }),
        ],
      });
    }, `SelectViewport`),
  ),
  [Pe, Fe] = K(`SelectGroup`),
  Ie = `SelectItem`,
  [Le, Re] = K(Ie),
  ze = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, value: r, disabled: i = !1, textValue: a, ...o } = e,
        c = q(Ie, n),
        l = X(Ie, n),
        f = c.value === r,
        [p, m] = N.useState(a ?? ``),
        [h, g] = N.useState(!1),
        _ = b((e) => l.itemRefCallback?.(e, r, i)),
        v = s(t, _),
        y = C(),
        x = N.useRef(`touch`),
        S = H(() => {
          (c.onValueChange(r), c.onOpenChange(!1));
        }, `handleSelect`);
      return (0, P.jsx)(Le, {
        scope: n,
        value: r,
        disabled: i,
        textId: y,
        isSelected: f,
        onItemTextChange: N.useCallback((e) => {
          m((t) => t || (e?.textContent ?? ``).trim());
        }, []),
        children: (0, P.jsx)(W.ItemSlot, {
          scope: n,
          value: r,
          disabled: i,
          textValue: p,
          children: (0, P.jsx)(u.div, {
            role: `option`,
            "aria-labelledby": y,
            "data-highlighted": h ? `` : void 0,
            "aria-selected": f && h,
            "data-state": f ? `checked` : `unchecked`,
            "aria-disabled": i || void 0,
            "data-disabled": i ? `` : void 0,
            tabIndex: i ? void 0 : -1,
            ...o,
            ref: v,
            onFocus: d(o.onFocus, () => g(!0)),
            onBlur: d(o.onBlur, () => g(!1)),
            onClick: d(o.onClick, () => {
              i || (x.current !== `mouse` && S());
            }),
            onPointerUp: d(o.onPointerUp, () => {
              i || (x.current === `mouse` && S());
            }),
            onPointerDown: d(o.onPointerDown, (e) => {
              x.current = e.pointerType;
            }),
            onPointerMove: d(o.onPointerMove, (e) => {
              ((x.current = e.pointerType),
                i
                  ? l.onItemLeave?.()
                  : x.current === `mouse` && e.currentTarget.focus({ preventScroll: !0 }));
            }),
            onPointerLeave: d(o.onPointerLeave, (e) => {
              e.currentTarget === document.activeElement && l.onItemLeave?.();
            }),
            onKeyDown: d(o.onKeyDown, (e) => {
              i ||
                e.target !== e.currentTarget ||
                ((l.searchRef?.current === `` || e.key !== ` `) &&
                  (oe.includes(e.key) && S(), e.key === ` ` && e.preventDefault()));
            }),
          }),
        }),
      });
    }, `SelectItem`),
  ),
  Z = `SelectItemText`,
  Be = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, className: r, style: i, ...a } = e,
        o = q(Z, n),
        c = X(Z, n),
        l = Re(Z, n),
        d = fe(Z, n),
        [p, m] = N.useState(null),
        h = b((e) => c.itemTextRefCallback?.(e, l.value, l.disabled)),
        g = s(t, m, l.onItemTextChange, h),
        _ = p?.textContent,
        v = N.useMemo(
          () =>
            (0, P.jsx)(`option`, { value: l.value, disabled: l.disabled, children: _ }, l.value),
          [l.disabled, l.value, _],
        ),
        { onNativeOptionAdd: y, onNativeOptionRemove: x } = d;
      return (
        f(() => (y(v), () => x(v)), [y, x, v]),
        (0, P.jsxs)(P.Fragment, {
          children: [
            (0, P.jsx)(u.span, { id: l.textId, ...a, ref: g }),
            l.isSelected && o.valueNode && !o.valueNodeHasChildren && !Q(o.value)
              ? M.createPortal(a.children, o.valueNode)
              : null,
          ],
        })
      );
    }, `SelectItemText`),
  ),
  Ve = `SelectItemIndicator`,
  He = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, ...r } = e;
      return Re(Ve, n).isSelected ? (0, P.jsx)(u.span, { "aria-hidden": !0, ...r, ref: t }) : null;
    }, `SelectItemIndicator`),
  ),
  Ue = `SelectScrollUpButton`,
  We = N.forwardRef(
    H(function (e, t) {
      let n = X(Ue, e.__scopeSelect),
        r = je(Ue, e.__scopeSelect),
        [i, a] = N.useState(!1),
        o = s(t, r.onScrollButtonChange);
      return (
        f(() => {
          if (n.viewport && n.isPositioned) {
            let e = function () {
              let e = t.scrollTop > 0;
              a(e);
            };
            H(e, `handleScroll`);
            let t = n.viewport;
            return (e(), t.addEventListener(`scroll`, e), () => t.removeEventListener(`scroll`, e));
          }
        }, [n.viewport, n.isPositioned]),
        i
          ? (0, P.jsx)(qe, {
              ...e,
              ref: o,
              onAutoScroll: () => {
                let { viewport: e, selectedItem: t } = n;
                e && t && (e.scrollTop -= t.offsetHeight);
              },
            })
          : null
      );
    }, `SelectScrollUpButton`),
  ),
  Ge = `SelectScrollDownButton`,
  Ke = N.forwardRef(
    H(function (e, t) {
      let n = X(Ge, e.__scopeSelect),
        r = je(Ge, e.__scopeSelect),
        [i, a] = N.useState(!1),
        o = s(t, r.onScrollButtonChange);
      return (
        f(() => {
          if (n.viewport && n.isPositioned) {
            let e = function () {
              let e = t.scrollHeight - t.clientHeight,
                n = Math.ceil(t.scrollTop) < e;
              a(n);
            };
            H(e, `handleScroll`);
            let t = n.viewport;
            return (e(), t.addEventListener(`scroll`, e), () => t.removeEventListener(`scroll`, e));
          }
        }, [n.viewport, n.isPositioned]),
        i
          ? (0, P.jsx)(qe, {
              ...e,
              ref: o,
              onAutoScroll: () => {
                let { viewport: e, selectedItem: t } = n;
                e && t && (e.scrollTop += t.offsetHeight);
              },
            })
          : null
      );
    }, `SelectScrollDownButton`),
  ),
  qe = N.forwardRef(
    H(function (e, t) {
      let { __scopeSelect: n, onAutoScroll: r, ...i } = e,
        a = X(`SelectScrollButton`, n),
        o = N.useRef(null),
        s = G(n),
        c = N.useCallback(() => {
          o.current !== null && (window.clearInterval(o.current), (o.current = null));
        }, []);
      return (
        N.useEffect(() => () => c(), [c]),
        f(() => {
          s()
            .find((e) => e.ref.current === document.activeElement)
            ?.ref.current?.scrollIntoView({ block: `nearest` });
        }, [s]),
        (0, P.jsx)(u.div, {
          "aria-hidden": !0,
          ...i,
          ref: t,
          style: { flexShrink: 0, ...i.style },
          onPointerDown: d(i.onPointerDown, () => {
            o.current === null && (o.current = window.setInterval(r, 50));
          }),
          onPointerMove: d(i.onPointerMove, () => {
            (a.onItemLeave?.(), o.current === null && (o.current = window.setInterval(r, 50)));
          }),
          onPointerLeave: d(i.onPointerLeave, () => {
            c();
          }),
        })
      );
    }, `SelectScrollButtonImpl`),
  ),
  Je = `SelectBubbleInput`,
  Ye = N.forwardRef(
    H(function ({ __scopeSelect: e, ...t }, n) {
      let r = q(Je, e),
        {
          value: i,
          onValueChange: a,
          required: o,
          disabled: c,
          name: l,
          autoComplete: d,
          form: f,
        } = r,
        { nativeOptions: p, nativeSelectKey: m } = r,
        h = N.useRef(null),
        g = s(n, h),
        _ = i ?? ``,
        v = L(_),
        y = Array.from(p).some((e) => (e.props.value ?? ``) === ``);
      return (
        N.useEffect(() => {
          let e = h.current;
          if (!e) return;
          let t = window.HTMLSelectElement.prototype,
            n = Object.getOwnPropertyDescriptor(t, `value`).set;
          if (v !== _ && n) {
            let t = new Event(`change`, { bubbles: !0 });
            (n.call(e, _), e.dispatchEvent(t));
          }
        }, [v, _]),
        (0, P.jsxs)(
          u.select,
          {
            "aria-hidden": !0,
            required: o,
            tabIndex: -1,
            name: l,
            autoComplete: d,
            disabled: c,
            form: f,
            onChange: (e) => a(e.target.value),
            ...t,
            style: { ...F, ...t.style },
            ref: g,
            defaultValue: _,
            children: [Q(i) && !y ? (0, P.jsx)(`option`, { value: `` }) : null, Array.from(p)],
          },
          m,
        )
      );
    }, `SelectBubbleInput`),
  );
function Xe(e) {
  return typeof e == `function`;
}
H(Xe, `isFunction`);
function Q(e) {
  return e === `` || e === void 0;
}
H(Q, `shouldShowPlaceholder`);
function Ze(e) {
  let t = b(e),
    n = N.useRef(``),
    r = N.useRef(0),
    i = N.useCallback(
      (e) => {
        let i = n.current + e;
        (t(i),
          H(function e(t) {
            ((n.current = t),
              window.clearTimeout(r.current),
              t !== `` && (r.current = window.setTimeout(() => e(``), 1e3)));
          }, `updateSearch`)(i));
      },
      [t],
    ),
    a = N.useCallback(() => {
      ((n.current = ``), window.clearTimeout(r.current));
    }, []);
  return (N.useEffect(() => () => window.clearTimeout(r.current), []), [n, i, a]);
}
H(Ze, `useTypeaheadSearch`);
function Qe(e, t, n) {
  let r = t.length > 1 && Array.from(t).every((e) => e === t[0]) ? t[0] : t,
    i = n ? e.indexOf(n) : -1,
    a = $e(e, Math.max(i, 0));
  r.length === 1 && (a = a.filter((e) => e !== n));
  let o = a.find((e) => e.textValue.toLowerCase().startsWith(r.toLowerCase()));
  return o === n ? void 0 : o;
}
H(Qe, `findNextItem`);
function $e(e, t) {
  return e.map((n, r) => e[(t + r) % e.length]);
}
H($e, `wrapArray`);
var et = { name: `chevron-down`, size: 24, node: [[`path`, { d: `m6 9 6 6 6-6`, key: `qrunsl` }]] };
et.node;
var tt = c(et),
  nt = { name: `chevron-up`, size: 24, node: [[`path`, { d: `m18 15-6-6-6 6`, key: `153udz` }]] };
nt.node;
var rt = c(nt),
  $ = i();
function it(e) {
  let t = (0, $.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, P.jsx)(me, { "data-slot": `select`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function at(e) {
  let t = (0, $.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, P.jsx)(ve, { "data-slot": `select-value`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function ot(e) {
  let t = (0, $.c)(13),
    n,
    r,
    i,
    a;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]), (a = t[4]))
    : (({ className: r, size: a, children: n, ...i } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = i),
      (t[4] = a));
  let s = a === void 0 ? `default` : a,
    c;
  t[5] === r
    ? (c = t[6])
    : ((c = o(
        `flex w-fit items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[placeholder]:text-muted-foreground data-[size=default]:h-9 data-[size=sm]:h-8 data-[size=touch]:h-11 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground`,
        r,
      )),
      (t[5] = r),
      (t[6] = c));
  let l;
  t[7] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((l = (0, P.jsx)(ye, {
        asChild: !0,
        children: (0, P.jsx)(tt, { className: `size-4 opacity-50` }),
      })),
      (t[7] = l))
    : (l = t[7]);
  let u;
  return (
    t[8] !== n || t[9] !== i || t[10] !== s || t[11] !== c
      ? ((u = (0, P.jsxs)(ge, {
          "data-slot": `select-trigger`,
          "data-size": s,
          className: c,
          ...i,
          children: [n, l],
        })),
        (t[8] = n),
        (t[9] = i),
        (t[10] = s),
        (t[11] = c),
        (t[12] = u))
      : (u = t[12]),
    u
  );
}
function st(e) {
  let t = (0, $.c)(22),
    n,
    r,
    i,
    a,
    s;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]), (a = t[4]), (s = t[5]))
    : (({ className: r, children: n, position: a, align: s, ...i } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = i),
      (t[4] = a),
      (t[5] = s));
  let c = a === void 0 ? `item-aligned` : a,
    l = s === void 0 ? `center` : s,
    u =
      c === `popper` &&
      `data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1`,
    d;
  t[6] !== r || t[7] !== u
    ? ((d = o(
        `relative z-50 max-h-(--radix-select-content-available-height) min-w-[8rem] origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,
        u,
        r,
      )),
      (t[6] = r),
      (t[7] = u),
      (t[8] = d))
    : (d = t[8]);
  let f;
  t[9] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((f = (0, P.jsx)(lt, {})), (t[9] = f))
    : (f = t[9]);
  let p =
      c === `popper` &&
      `h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)] scroll-my-1`,
    m;
  t[10] === p ? (m = t[11]) : ((m = o(`p-1`, p)), (t[10] = p), (t[11] = m));
  let h;
  t[12] !== n || t[13] !== m
    ? ((h = (0, P.jsx)(Ne, { className: m, children: n })), (t[12] = n), (t[13] = m), (t[14] = h))
    : (h = t[14]);
  let g;
  t[15] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((g = (0, P.jsx)(ut, {})), (t[15] = g))
    : (g = t[15]);
  let _;
  return (
    t[16] !== l || t[17] !== c || t[18] !== i || t[19] !== d || t[20] !== h
      ? ((_ = (0, P.jsx)(Se, {
          children: (0, P.jsxs)(Ce, {
            "data-slot": `select-content`,
            className: d,
            position: c,
            align: l,
            ...i,
            children: [f, h, g],
          }),
        })),
        (t[16] = l),
        (t[17] = c),
        (t[18] = i),
        (t[19] = d),
        (t[20] = h),
        (t[21] = _))
      : (_ = t[21]),
    _
  );
}
function ct(e) {
  let t = (0, $.c)(13),
    n,
    r,
    i;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]))
    : (({ className: r, children: n, ...i } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = i));
  let a;
  t[4] === r
    ? (a = t[5])
    : ((a = o(
        `relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2`,
        r,
      )),
      (t[4] = r),
      (t[5] = a));
  let s;
  t[6] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((s = (0, P.jsx)(`span`, {
        "data-slot": `select-item-indicator`,
        className: `absolute right-2 flex size-3.5 items-center justify-center`,
        children: (0, P.jsx)(He, { children: (0, P.jsx)(A, { className: `size-4` }) }),
      })),
      (t[6] = s))
    : (s = t[6]);
  let c;
  t[7] === n ? (c = t[8]) : ((c = (0, P.jsx)(Be, { children: n })), (t[7] = n), (t[8] = c));
  let l;
  return (
    t[9] !== i || t[10] !== a || t[11] !== c
      ? ((l = (0, P.jsxs)(ze, {
          "data-slot": `select-item`,
          className: a,
          ...i,
          children: [s, c],
        })),
        (t[9] = i),
        (t[10] = a),
        (t[11] = c),
        (t[12] = l))
      : (l = t[12]),
    l
  );
}
function lt(e) {
  let t = (0, $.c)(9),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = o(`flex cursor-default items-center justify-center py-1`, n)), (t[3] = n), (t[4] = i));
  let a;
  t[5] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = (0, P.jsx)(rt, { className: `size-4` })), (t[5] = a))
    : (a = t[5]);
  let s;
  return (
    t[6] !== r || t[7] !== i
      ? ((s = (0, P.jsx)(We, {
          "data-slot": `select-scroll-up-button`,
          className: i,
          ...r,
          children: a,
        })),
        (t[6] = r),
        (t[7] = i),
        (t[8] = s))
      : (s = t[8]),
    s
  );
}
function ut(e) {
  let t = (0, $.c)(9),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = o(`flex cursor-default items-center justify-center py-1`, n)), (t[3] = n), (t[4] = i));
  let a;
  t[5] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = (0, P.jsx)(tt, { className: `size-4` })), (t[5] = a))
    : (a = t[5]);
  let s;
  return (
    t[6] !== r || t[7] !== i
      ? ((s = (0, P.jsx)(Ke, {
          "data-slot": `select-scroll-down-button`,
          className: i,
          ...r,
          children: a,
        })),
        (t[6] = r),
        (t[7] = i),
        (t[8] = s))
      : (s = t[8]),
    s
  );
}
function dt(e) {
  let t = (0, $.c)(28),
    { field: n, label: r, options: i, placeholder: a, autoFocus: o } = e,
    s = n.state.meta.errors[0]?.message,
    c = `${n.name}-error`,
    u = !!s,
    d;
  t[0] !== n.name || t[1] !== r
    ? ((d = (0, P.jsx)(ee, { htmlFor: n.name, children: r })),
      (t[0] = n.name),
      (t[1] = r),
      (t[2] = d))
    : (d = t[2]);
  let f = n.state.value,
    p = n.handleChange,
    m = o ? l : void 0,
    h = !!s,
    g = s ? c : void 0,
    _;
  t[3] === a ? (_ = t[4]) : ((_ = (0, P.jsx)(at, { placeholder: a })), (t[3] = a), (t[4] = _));
  let v;
  t[5] !== n.name || t[6] !== m || t[7] !== h || t[8] !== g || t[9] !== _
    ? ((v = (0, P.jsx)(ot, {
        id: n.name,
        ref: m,
        className: `w-full`,
        "aria-invalid": h,
        "aria-describedby": g,
        children: _,
      })),
      (t[5] = n.name),
      (t[6] = m),
      (t[7] = h),
      (t[8] = g),
      (t[9] = _),
      (t[10] = v))
    : (v = t[10]);
  let y;
  t[11] === i ? (y = t[12]) : ((y = i.map(ft)), (t[11] = i), (t[12] = y));
  let b;
  t[13] === y ? (b = t[14]) : ((b = (0, P.jsx)(st, { children: y })), (t[13] = y), (t[14] = b));
  let x;
  t[15] !== n.handleChange || t[16] !== n.state.value || t[17] !== b || t[18] !== v
    ? ((x = (0, P.jsxs)(it, { value: f, onValueChange: p, children: [v, b] })),
      (t[15] = n.handleChange),
      (t[16] = n.state.value),
      (t[17] = b),
      (t[18] = v),
      (t[19] = x))
    : (x = t[19]);
  let S;
  t[20] !== c || t[21] !== s
    ? ((S = s && (0, P.jsx)(j, { id: c, children: s })), (t[20] = c), (t[21] = s), (t[22] = S))
    : (S = t[22]);
  let C;
  return (
    t[23] !== u || t[24] !== x || t[25] !== S || t[26] !== d
      ? ((C = (0, P.jsxs)(te, { "data-invalid": u, children: [d, x, S] })),
        (t[23] = u),
        (t[24] = x),
        (t[25] = S),
        (t[26] = d),
        (t[27] = C))
      : (C = t[27]),
    C
  );
}
function ft(e) {
  return (0, P.jsx)(ct, { value: e.value, children: e.label }, e.value);
}
export { ot as a, ct as i, it as n, at as o, st as r, tt as s, dt as t };
