import {
  Bt as e,
  Ht as t,
  Wt as n,
  _ as r,
  f as i,
  g as a,
  m as o,
  p as s,
  t as c,
} from "./createLucideIcon-BBeoGZx-.js";
import { o as l } from "./alert-BTZapdK4.js";
import {
  C as u,
  _ as d,
  b as f,
  d as p,
  f as m,
  g as h,
  h as g,
  i as _,
  l as v,
  m as y,
  n as b,
  o as x,
  p as S,
  s as C,
  u as w,
  w as T,
  x as ee,
  y as E,
} from "./x-B76tEvwZ.js";
import { a as D, i as O, n as k, r as A } from "./check-bZy7kAyE.js";
import { i as j, o as M, r as N, s as P, t as F } from "./dialog-CiSY6Yg1.js";
var I = n(t(), 1),
  L = e(),
  te = Object.defineProperty,
  R = (e, t) => te(e, `name`, { value: t, configurable: !0 }),
  ne = `Popover`,
  [re, ie] = T(ne, [D]),
  ae = D(),
  [oe, z] = re(ne),
  se = R((e) => {
    let {
        __scopePopover: t,
        children: n,
        open: r,
        defaultOpen: i,
        onOpenChange: a,
        modal: o = !1,
      } = e,
      s = ae(t),
      c = I.useRef(null),
      [l, u] = I.useState(!1),
      [d, f] = I.useState(0),
      [p, m] = I.useState(0),
      [h, g] = ee({ prop: r, defaultProp: i ?? !1, onChange: a, caller: ne });
    return (0, L.jsx)(k, {
      ...s,
      children: (0, L.jsx)(oe, {
        scope: t,
        contentId: E(),
        titleId: E(),
        descriptionId: E(),
        titlePresent: d > 0,
        descriptionPresent: p > 0,
        setTitleCount: f,
        setDescriptionCount: m,
        triggerRef: c,
        open: h,
        onOpenChange: g,
        onOpenToggle: I.useCallback(() => g((e) => !e), [g]),
        hasCustomAnchor: l,
        onCustomAnchorAdd: I.useCallback(() => u(!0), []),
        onCustomAnchorRemove: I.useCallback(() => u(!1), []),
        modal: o,
        children: n,
      }),
    });
  }, `Popover`),
  ce = `PopoverTrigger`,
  le = I.forwardRef(
    R(function (e, t) {
      let { __scopePopover: n, ...r } = e,
        i = z(ce, n),
        a = ae(n),
        s = o(t, i.triggerRef),
        c = (0, L.jsx)(l.button, {
          type: `button`,
          "aria-haspopup": `dialog`,
          "aria-expanded": i.open,
          "aria-controls": i.open ? i.contentId : void 0,
          "data-state": V(i.open),
          ...r,
          ref: s,
          onClick: u(e.onClick, i.onOpenToggle),
        });
      return i.hasCustomAnchor ? c : (0, L.jsx)(A, { asChild: !0, ...a, children: c });
    }, `PopoverTrigger`),
  ),
  ue = `PopoverPortal`,
  [de, fe] = re(ue, { forceMount: void 0 }),
  pe = R((e) => {
    let { __scopePopover: t, forceMount: n, children: r, container: i } = e,
      a = z(ue, t);
    return (0, L.jsx)(de, {
      scope: t,
      forceMount: n,
      children: (0, L.jsx)(f, {
        present: n || a.open,
        children: (0, L.jsx)(m, { asChild: !0, container: i, children: r }),
      }),
    });
  }, `PopoverPortal`),
  B = `PopoverContent`,
  me = I.forwardRef(
    R(function (e, t) {
      let n = fe(B, e.__scopePopover),
        { forceMount: r = n.forceMount, ...i } = e,
        a = z(B, e.__scopePopover);
      return (0, L.jsx)(f, {
        present: r || a.open,
        children: a.modal ? (0, L.jsx)(ge, { ...i, ref: t }) : (0, L.jsx)(_e, { ...i, ref: t }),
      });
    }, `PopoverContent`),
  ),
  he = i(`PopoverContent.RemoveScroll`),
  ge = I.forwardRef(
    R(function (e, t) {
      let n = z(B, e.__scopePopover),
        r = I.useRef(null),
        i = o(t, r),
        a = I.useRef(!1),
        { nodes: s, registry: c } = h();
      return (
        I.useEffect(() => {
          let e = r.current;
          if (e) return v(e);
        }, []),
        (0, L.jsx)(w, {
          as: he,
          allowPinchZoom: !0,
          shards: I.useMemo(() => [r, ...s.map((e) => ({ current: e }))], [r, s]),
          children: (0, L.jsx)(ve, {
            ...e,
            ref: i,
            branchNodes: s,
            branchRegistry: c,
            trapFocus: n.open,
            disableOutsidePointerEvents: !0,
            onCloseAutoFocus: u(e.onCloseAutoFocus, (e) => {
              (e.preventDefault(), a.current || n.triggerRef.current?.focus());
            }),
            onPointerDownOutside: u(
              e.onPointerDownOutside,
              (e) => {
                let t = e.detail.originalEvent,
                  n = t.button === 0 && t.ctrlKey === !0,
                  r = t.button === 2 || n;
                a.current = r;
              },
              { checkForDefaultPrevented: !1 },
            ),
            onFocusOutside: u(e.onFocusOutside, (e) => e.preventDefault(), {
              checkForDefaultPrevented: !1,
            }),
          }),
        })
      );
    }, `PopoverContentModal`),
  ),
  _e = I.forwardRef(
    R(function (e, t) {
      let n = z(B, e.__scopePopover),
        r = I.useRef(!1),
        i = I.useRef(!1);
      return (0, L.jsx)(ve, {
        ...e,
        ref: t,
        trapFocus: !1,
        disableOutsidePointerEvents: !1,
        onCloseAutoFocus: (t) => {
          (e.onCloseAutoFocus?.(t),
            t.defaultPrevented || (r.current || n.triggerRef.current?.focus(), t.preventDefault()),
            (r.current = !1),
            (i.current = !1));
        },
        onInteractOutside: (t) => {
          (e.onInteractOutside?.(t),
            t.defaultPrevented ||
              ((r.current = !0),
              t.detail.originalEvent.type === `pointerdown` && (i.current = !0)));
          let a = t.target;
          (n.triggerRef.current?.contains(a) && t.preventDefault(),
            t.detail.originalEvent.type === `focusin` && i.current && t.preventDefault());
        },
      });
    }, `PopoverContentNonModal`),
  ),
  ve = I.forwardRef(
    R(function (e, t) {
      let {
          __scopePopover: n,
          trapFocus: r,
          onOpenAutoFocus: i,
          onCloseAutoFocus: a,
          disableOutsidePointerEvents: s,
          onEscapeKeyDown: c,
          onPointerDownOutside: l,
          onFocusOutside: u,
          onInteractOutside: f,
          "aria-describedby": m,
          branchNodes: h,
          branchRegistry: _,
          ...v
        } = e,
        b = z(B, n),
        x = ae(n),
        [C, w] = I.useState(null),
        T = o(t, w);
      return (
        g(C),
        p(),
        (0, L.jsx)(y, {
          registry: _,
          children: (0, L.jsx)(S, {
            asChild: !0,
            loop: !0,
            trapped: r,
            branches: h,
            onMountAutoFocus: i,
            onUnmountAutoFocus: a,
            children: (0, L.jsx)(d, {
              asChild: !0,
              disableOutsidePointerEvents: s,
              onInteractOutside: f,
              onEscapeKeyDown: c,
              onPointerDownOutside: l,
              onFocusOutside: u,
              onDismiss: () => b.onOpenChange(!1),
              deferPointerDownOutside: !0,
              children: (0, L.jsx)(O, {
                "data-state": V(b.open),
                role: `dialog`,
                id: b.contentId,
                "aria-labelledby": b.titlePresent ? b.titleId : void 0,
                "aria-describedby": b.descriptionPresent ? ye(m, b.descriptionId) : m,
                ...x,
                ...v,
                ref: T,
                style: {
                  ...v.style,
                  "--radix-popover-content-transform-origin": `var(--radix-popper-transform-origin)`,
                  "--radix-popover-content-available-width": `var(--radix-popper-available-width)`,
                  "--radix-popover-content-available-height": `var(--radix-popper-available-height)`,
                  "--radix-popover-trigger-width": `var(--radix-popper-anchor-width)`,
                  "--radix-popover-trigger-height": `var(--radix-popper-anchor-height)`,
                },
              }),
            }),
          }),
        })
      );
    }, `PopoverContentImpl`),
  );
function V(e) {
  return e ? `open` : `closed`;
}
R(V, `getState`);
function ye(...e) {
  let t = new Set();
  for (let n of e)
    if (typeof n == `string`) for (let e of String(n).trim().split(/\s+/)) e && t.add(e);
  return t.size > 0 ? Array.from(t).join(` `) : void 0;
}
R(ye, `concatAriaDescribedby`);
var be = {
  name: `plus`,
  size: 24,
  node: [
    [`path`, { d: `M5 12h14`, key: `1ays0h` }],
    [`path`, { d: `M12 5v14`, key: `s699le` }],
  ],
};
be.node;
var xe = c(be),
  Se = {
    name: `search`,
    size: 24,
    node: [
      [`path`, { d: `m21 21-4.34-4.34`, key: `14j7rj` }],
      [`circle`, { cx: `11`, cy: `11`, r: `8`, key: `4ej97u` }],
    ],
  };
Se.node;
var Ce = c(Se),
  H = r(),
  we = 1,
  Te = 0.9,
  Ee = 0.8,
  De = 0.17,
  U = 0.1,
  W = 0.999,
  Oe = 0.9999,
  ke = 0.99,
  Ae = /[\\/_+.#"@[({&]/,
  je = /[\\/_+.#"@[({&]/g,
  Me = /[\s-]/,
  Ne = /[\s-]/g;
function G(e, t, n, r, i, a, o) {
  if (a === t.length) return i === e.length ? we : ke;
  var s = `${i},${a}`;
  if (o[s] !== void 0) return o[s];
  for (var c = r.charAt(a), l = n.indexOf(c, i), u = 0, d, f, p, m; l >= 0;)
    ((d = G(e, t, n, r, l + 1, a + 1, o)),
      d > u &&
        (l === i
          ? (d *= we)
          : Ae.test(e.charAt(l - 1))
            ? ((d *= Ee), (p = e.slice(i, l - 1).match(je)), p && i > 0 && (d *= W ** +p.length))
            : Me.test(e.charAt(l - 1))
              ? ((d *= Te), (m = e.slice(i, l - 1).match(Ne)), m && i > 0 && (d *= W ** +m.length))
              : ((d *= De), i > 0 && (d *= W ** +(l - i))),
        e.charAt(l) !== t.charAt(a) && (d *= Oe)),
      ((d < U && n.charAt(l - 1) === r.charAt(a + 1)) ||
        (r.charAt(a + 1) === r.charAt(a) && n.charAt(l - 1) !== r.charAt(a))) &&
        ((f = G(e, t, n, r, l + 1, a + 2, o)), f * U > d && (d = f * U)),
      d > u && (u = d),
      (l = n.indexOf(c, l + 1)));
  return ((o[s] = u), u);
}
function Pe(e) {
  return e.toLowerCase().replace(Ne, ` `);
}
function Fe(e, t, n) {
  return (
    (e = n && n.length > 0 ? `${e + ` ` + n.join(` `)}` : e), G(e, t, Pe(e), Pe(t), 0, 0, {})
  );
}
var K = `[cmdk-group=""]`,
  Ie = `[cmdk-group-items=""]`,
  Le = `[cmdk-group-heading=""]`,
  Re = `[cmdk-item=""]`,
  ze = `${Re}:not([aria-disabled="true"])`,
  Be = `cmdk-item-select`,
  q = `data-value`,
  Ve = (e, t, n) => Fe(e, t, n),
  He = I.createContext(void 0),
  J = () => I.useContext(He),
  Ue = I.createContext(void 0),
  We = () => I.useContext(Ue),
  Ge = I.createContext(void 0),
  Ke = I.forwardRef((e, t) => {
    let n = Z(() => ({
        search: ``,
        value: e.value ?? e.defaultValue ?? ``,
        selectedItemId: void 0,
        filtered: { count: 0, items: new Map(), groups: new Set() },
      })),
      r = Z(() => new Set()),
      i = Z(() => new Map()),
      a = Z(() => new Map()),
      o = Z(() => new Set()),
      s = rt(e),
      {
        label: c,
        children: u,
        value: d,
        onValueChange: f,
        filter: p,
        shouldFilter: m,
        loop: h,
        disablePointerSelection: g = !1,
        vimBindings: _ = !0,
        ...v
      } = e,
      y = E(),
      b = E(),
      x = E(),
      S = I.useRef(null),
      C = at();
    (X(() => {
      if (d !== void 0) {
        let e = d.trim();
        ((n.current.value = e), w.emit());
      }
    }, [d]),
      X(() => {
        C(6, A);
      }, []));
    let w = I.useMemo(
        () => ({
          subscribe: (e) => (o.current.add(e), () => o.current.delete(e)),
          snapshot: () => n.current,
          setState: (e, t, r) => {
            var i, a, o;
            if (!Object.is(n.current[e], t)) {
              if (((n.current[e] = t), e === `search`)) (k(), D(), C(1, O));
              else if (e === `value`) {
                if (
                  document.activeElement.hasAttribute(`cmdk-input`) ||
                  document.activeElement.hasAttribute(`cmdk-root`)
                ) {
                  let e = document.getElementById(x);
                  e ? e.focus() : (i = document.getElementById(y)) == null || i.focus();
                }
                if (
                  (C(7, () => {
                    ((n.current.selectedItemId = j()?.id), w.emit());
                  }),
                  r || C(5, A),
                  s.current?.value !== void 0)
                ) {
                  let e = t ?? ``;
                  (o = (a = s.current).onValueChange) == null || o.call(a, e);
                  return;
                }
              }
              w.emit();
            }
          },
          emit: () => {
            o.current.forEach((e) => e());
          },
        }),
        [],
      ),
      T = I.useMemo(
        () => ({
          value: (e, t, r) => {
            t !== a.current.get(e)?.value &&
              (a.current.set(e, { value: t, keywords: r }),
              n.current.filtered.items.set(e, ee(t, r)),
              C(2, () => {
                (D(), w.emit());
              }));
          },
          item: (e, t) => (
            r.current.add(e),
            t && (i.current.has(t) ? i.current.get(t).add(e) : i.current.set(t, new Set([e]))),
            C(3, () => {
              (k(), D(), n.current.value || O(), w.emit());
            }),
            () => {
              (a.current.delete(e), r.current.delete(e), n.current.filtered.items.delete(e));
              let t = j();
              C(4, () => {
                (k(), t?.getAttribute(`id`) === e && O(), w.emit());
              });
            }
          ),
          group: (e) => (
            i.current.has(e) || i.current.set(e, new Set()),
            () => {
              (a.current.delete(e), i.current.delete(e));
            }
          ),
          filter: () => s.current.shouldFilter,
          label: c || e[`aria-label`],
          getDisablePointerSelection: () => s.current.disablePointerSelection,
          listId: y,
          inputId: x,
          labelId: b,
          listInnerRef: S,
        }),
        [],
      );
    function ee(e, t) {
      let r = s.current?.filter ?? Ve;
      return e ? r(e, n.current.search, t) : 0;
    }
    function D() {
      if (!n.current.search || s.current.shouldFilter === !1) return;
      let e = n.current.filtered.items,
        t = [];
      n.current.filtered.groups.forEach((n) => {
        let r = i.current.get(n),
          a = 0;
        (r.forEach((t) => {
          let n = e.get(t);
          a = Math.max(n, a);
        }),
          t.push([n, a]));
      });
      let r = S.current;
      (M()
        .sort((t, n) => {
          let r = t.getAttribute(`id`),
            i = n.getAttribute(`id`);
          return (e.get(i) ?? 0) - (e.get(r) ?? 0);
        })
        .forEach((e) => {
          let t = e.closest(Ie);
          t
            ? t.appendChild(e.parentElement === t ? e : e.closest(`${Ie} > *`))
            : r.appendChild(e.parentElement === r ? e : e.closest(`${Ie} > *`));
        }),
        t
          .sort((e, t) => t[1] - e[1])
          .forEach((e) => {
            let t = S.current?.querySelector(`${K}[${q}="${encodeURIComponent(e[0])}"]`);
            t?.parentElement.appendChild(t);
          }));
    }
    function O() {
      let e = M()
        .find((e) => e.getAttribute(`aria-disabled`) !== `true`)
        ?.getAttribute(q);
      w.setState(`value`, e || void 0);
    }
    function k() {
      if (!n.current.search || s.current.shouldFilter === !1) {
        n.current.filtered.count = r.current.size;
        return;
      }
      n.current.filtered.groups = new Set();
      let e = 0;
      for (let t of r.current) {
        let r = ee(a.current.get(t)?.value ?? ``, a.current.get(t)?.keywords ?? []);
        (n.current.filtered.items.set(t, r), r > 0 && e++);
      }
      for (let [e, t] of i.current)
        for (let r of t)
          if (n.current.filtered.items.get(r) > 0) {
            n.current.filtered.groups.add(e);
            break;
          }
      n.current.filtered.count = e;
    }
    function A() {
      var e;
      let t = j();
      t &&
        (t.parentElement?.firstChild === t &&
          ((e = t.closest(K)?.querySelector(Le)) == null || e.scrollIntoView({ block: `nearest` })),
        t.scrollIntoView({ block: `nearest` }));
    }
    function j() {
      return S.current?.querySelector(`${Re}[aria-selected="true"]`);
    }
    function M() {
      return Array.from(S.current?.querySelectorAll(ze) || []);
    }
    function N(e) {
      let t = M()[e];
      t && w.setState(`value`, t.getAttribute(q));
    }
    function P(e) {
      var t;
      let n = j(),
        r = M(),
        i = r.findIndex((e) => e === n),
        a = r[i + e];
      ((t = s.current) != null &&
        t.loop &&
        (a = i + e < 0 ? r[r.length - 1] : i + e === r.length ? r[0] : r[i + e]),
        a && w.setState(`value`, a.getAttribute(q)));
    }
    function F(e) {
      let t = j()?.closest(K),
        n;
      for (; t && !n;) ((t = e > 0 ? tt(t, K) : nt(t, K)), (n = t?.querySelector(ze)));
      n ? w.setState(`value`, n.getAttribute(q)) : P(e);
    }
    let L = () => N(M().length - 1),
      te = (e) => {
        (e.preventDefault(), e.metaKey ? L() : e.altKey ? F(1) : P(1));
      },
      R = (e) => {
        (e.preventDefault(), e.metaKey ? N(0) : e.altKey ? F(-1) : P(-1));
      };
    return I.createElement(
      l.div,
      {
        ref: t,
        tabIndex: -1,
        ...v,
        "cmdk-root": ``,
        onKeyDown: (e) => {
          var t;
          (t = v.onKeyDown) == null || t.call(v, e);
          let n = e.nativeEvent.isComposing || e.keyCode === 229;
          if (!(e.defaultPrevented || n))
            switch (e.key) {
              case `n`:
              case `j`:
                _ && e.ctrlKey && te(e);
                break;
              case `ArrowDown`:
                te(e);
                break;
              case `p`:
              case `k`:
                _ && e.ctrlKey && R(e);
                break;
              case `ArrowUp`:
                R(e);
                break;
              case `Home`:
                (e.preventDefault(), N(0));
                break;
              case `End`:
                (e.preventDefault(), L());
                break;
              case `Enter`: {
                e.preventDefault();
                let t = j();
                if (t) {
                  let e = new Event(Be);
                  t.dispatchEvent(e);
                }
              }
            }
        },
      },
      I.createElement(
        `label`,
        { "cmdk-label": ``, htmlFor: T.inputId, id: T.labelId, style: st },
        c,
      ),
      $(e, (e) =>
        I.createElement(Ue.Provider, { value: w }, I.createElement(He.Provider, { value: T }, e)),
      ),
    );
  }),
  qe = I.forwardRef((e, t) => {
    let n = E(),
      r = I.useRef(null),
      i = I.useContext(Ge),
      a = J(),
      o = rt(e),
      c = o.current?.forceMount ?? i?.forceMount;
    X(() => {
      if (!c) return a.item(n, i?.id);
    }, [c]);
    let u = it(n, r, [e.value, e.children, r], e.keywords),
      d = We(),
      f = Q((e) => e.value && e.value === u.current),
      p = Q((e) => (c || a.filter() === !1 ? !0 : !e.search || e.filtered.items.get(n) > 0));
    I.useEffect(() => {
      let t = r.current;
      if (t && !e.disabled) return (t.addEventListener(Be, m), () => t.removeEventListener(Be, m));
    }, [p, e.onSelect, e.disabled]);
    function m() {
      var e, t;
      (h(), (t = (e = o.current).onSelect) == null || t.call(e, u.current));
    }
    function h() {
      d.setState(`value`, u.current, !0);
    }
    if (!p) return null;
    let { disabled: g, value: _, onSelect: v, forceMount: y, keywords: b, ...x } = e;
    return I.createElement(
      l.div,
      {
        ref: s(r, t),
        ...x,
        id: n,
        "cmdk-item": ``,
        role: `option`,
        "aria-disabled": !!g,
        "aria-selected": !!f,
        "data-disabled": !!g,
        "data-selected": !!f,
        onPointerMove: g || a.getDisablePointerSelection() ? void 0 : h,
        onClick: g ? void 0 : m,
      },
      e.children,
    );
  }),
  Je = I.forwardRef((e, t) => {
    let { heading: n, children: r, forceMount: i, ...a } = e,
      o = E(),
      c = I.useRef(null),
      u = I.useRef(null),
      d = E(),
      f = J(),
      p = Q((e) => (i || f.filter() === !1 ? !0 : !e.search || e.filtered.groups.has(o)));
    (X(() => f.group(o), []), it(o, c, [e.value, e.heading, u]));
    let m = I.useMemo(() => ({ id: o, forceMount: i }), [i]);
    return I.createElement(
      l.div,
      { ref: s(c, t), ...a, "cmdk-group": ``, role: `presentation`, hidden: !p || void 0 },
      n &&
        I.createElement(`div`, { ref: u, "cmdk-group-heading": ``, "aria-hidden": !0, id: d }, n),
      $(e, (e) =>
        I.createElement(
          `div`,
          { "cmdk-group-items": ``, role: `group`, "aria-labelledby": n ? d : void 0 },
          I.createElement(Ge.Provider, { value: m }, e),
        ),
      ),
    );
  }),
  Ye = I.forwardRef((e, t) => {
    let { alwaysRender: n, ...r } = e,
      i = I.useRef(null),
      a = Q((e) => !e.search);
    return !n && !a
      ? null
      : I.createElement(l.div, { ref: s(i, t), ...r, "cmdk-separator": ``, role: `separator` });
  }),
  Xe = I.forwardRef((e, t) => {
    let { onValueChange: n, ...r } = e,
      i = e.value != null,
      a = We(),
      o = Q((e) => e.search),
      s = Q((e) => e.selectedItemId),
      c = J();
    return (
      I.useEffect(() => {
        e.value != null && a.setState(`search`, e.value);
      }, [e.value]),
      I.createElement(l.input, {
        ref: t,
        ...r,
        "cmdk-input": ``,
        autoComplete: `off`,
        autoCorrect: `off`,
        spellCheck: !1,
        "aria-autocomplete": `list`,
        role: `combobox`,
        "aria-expanded": !0,
        "aria-controls": c.listId,
        "aria-labelledby": c.labelId,
        "aria-activedescendant": s,
        id: c.inputId,
        type: `text`,
        value: i ? e.value : o,
        onChange: (e) => {
          (i || a.setState(`search`, e.target.value), n?.(e.target.value));
        },
      })
    );
  }),
  Ze = I.forwardRef((e, t) => {
    let { children: n, label: r = `Suggestions`, ...i } = e,
      a = I.useRef(null),
      o = I.useRef(null),
      c = Q((e) => e.selectedItemId),
      u = J();
    return (
      I.useEffect(() => {
        if (o.current && a.current) {
          let e = o.current,
            t = a.current,
            n,
            r = new ResizeObserver(() => {
              n = requestAnimationFrame(() => {
                let n = e.offsetHeight;
                t.style.setProperty(`--cmdk-list-height`, n.toFixed(1) + `px`);
              });
            });
          return (
            r.observe(e),
            () => {
              (cancelAnimationFrame(n), r.unobserve(e));
            }
          );
        }
      }, []),
      I.createElement(
        l.div,
        {
          ref: s(a, t),
          ...i,
          "cmdk-list": ``,
          role: `listbox`,
          tabIndex: -1,
          "aria-activedescendant": c,
          "aria-label": r,
          id: u.listId,
        },
        $(e, (e) =>
          I.createElement(`div`, { ref: s(o, u.listInnerRef), "cmdk-list-sizer": `` }, e),
        ),
      )
    );
  }),
  Qe = I.forwardRef((e, t) => {
    let {
      open: n,
      onOpenChange: r,
      overlayClassName: i,
      contentClassName: a,
      container: o,
      ...s
    } = e;
    return I.createElement(
      b,
      { open: n, onOpenChange: r },
      I.createElement(
        C,
        { container: o },
        I.createElement(x, { "cmdk-overlay": ``, className: i }),
        I.createElement(
          _,
          { "aria-label": e.label, "cmdk-dialog": ``, className: a },
          I.createElement(Ke, { ref: t, ...s }),
        ),
      ),
    );
  }),
  $e = I.forwardRef((e, t) =>
    Q((e) => e.filtered.count === 0)
      ? I.createElement(l.div, { ref: t, ...e, "cmdk-empty": ``, role: `presentation` })
      : null,
  ),
  et = I.forwardRef((e, t) => {
    let { progress: n, children: r, label: i = `Loading...`, ...a } = e;
    return I.createElement(
      l.div,
      {
        ref: t,
        ...a,
        "cmdk-loading": ``,
        role: `progressbar`,
        "aria-valuenow": n,
        "aria-valuemin": 0,
        "aria-valuemax": 100,
        "aria-label": i,
      },
      $(e, (e) => I.createElement(`div`, { "aria-hidden": !0 }, e)),
    );
  }),
  Y = Object.assign(Ke, {
    List: Ze,
    Item: qe,
    Input: Xe,
    Group: Je,
    Separator: Ye,
    Dialog: Qe,
    Empty: $e,
    Loading: et,
  });
function tt(e, t) {
  let n = e.nextElementSibling;
  for (; n;) {
    if (n.matches(t)) return n;
    n = n.nextElementSibling;
  }
}
function nt(e, t) {
  let n = e.previousElementSibling;
  for (; n;) {
    if (n.matches(t)) return n;
    n = n.previousElementSibling;
  }
}
function rt(e) {
  let t = I.useRef(e);
  return (
    X(() => {
      t.current = e;
    }),
    t
  );
}
var X = typeof window > `u` ? I.useEffect : I.useLayoutEffect;
function Z(e) {
  let t = I.useRef();
  return (t.current === void 0 && (t.current = e()), t);
}
function Q(e) {
  let t = We(),
    n = () => e(t.snapshot());
  return I.useSyncExternalStore(t.subscribe, n, n);
}
function it(e, t, n, r = []) {
  let i = I.useRef(),
    a = J();
  return (
    X(() => {
      var o;
      let s = (() => {
          for (let e of n) {
            if (typeof e == `string`) return e.trim();
            if (typeof e == `object` && `current` in e)
              return e.current ? e.current.textContent?.trim() : i.current;
          }
        })(),
        c = r.map((e) => e.trim());
      (a.value(e, s, c), (o = t.current) == null || o.setAttribute(q, s), (i.current = s));
    }),
    i
  );
}
var at = () => {
  let [e, t] = I.useState(),
    n = Z(() => new Map());
  return (
    X(() => {
      (n.current.forEach((e) => e()), (n.current = new Map()));
    }, [e]),
    (e, r) => {
      (n.current.set(e, r), t({}));
    }
  );
};
function ot(e) {
  let t = e.type;
  return typeof t == `function` ? t(e.props) : `render` in t ? t.render(e.props) : e;
}
function $({ asChild: e, children: t }, n) {
  return e && I.isValidElement(t)
    ? I.cloneElement(ot(t), { ref: t.ref }, n(t.props.children))
    : n(t);
}
var st = {
  position: `absolute`,
  width: `1px`,
  height: `1px`,
  padding: `0`,
  margin: `-1px`,
  overflow: `hidden`,
  clip: `rect(0, 0, 0, 0)`,
  whiteSpace: `nowrap`,
  borderWidth: `0`,
};
function ct(e) {
  let t = (0, H.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = a(
        `flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, L.jsx)(Y, { "data-slot": `command`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function lt(e) {
  let t = (0, H.c)(28),
    n,
    r,
    i,
    o,
    s,
    c,
    l;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]), (o = t[4]), (s = t[5]), (c = t[6]), (l = t[7]))
    : (({
        title: s,
        description: c,
        children: n,
        className: r,
        showCloseButton: l,
        onCloseAutoFocus: i,
        ...o
      } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = i),
      (t[4] = o),
      (t[5] = s),
      (t[6] = c),
      (t[7] = l));
  let u = s === void 0 ? `Command Palette` : s,
    d = c === void 0 ? `Search for a command to run...` : c,
    f = l === void 0 || l,
    p;
  t[8] === u ? (p = t[9]) : ((p = (0, L.jsx)(P, { children: u })), (t[8] = u), (t[9] = p));
  let m;
  t[10] === d ? (m = t[11]) : ((m = (0, L.jsx)(j, { children: d })), (t[10] = d), (t[11] = m));
  let h;
  t[12] !== p || t[13] !== m
    ? ((h = (0, L.jsxs)(M, { className: `sr-only`, children: [p, m] })),
      (t[12] = p),
      (t[13] = m),
      (t[14] = h))
    : (h = t[14]);
  let g;
  t[15] === r ? (g = t[16]) : ((g = a(`overflow-hidden p-0`, r)), (t[15] = r), (t[16] = g));
  let _;
  t[17] === n
    ? (_ = t[18])
    : ((_ = (0, L.jsx)(ct, {
        className: `**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5`,
        children: n,
      })),
      (t[17] = n),
      (t[18] = _));
  let v;
  t[19] !== i || t[20] !== f || t[21] !== g || t[22] !== _
    ? ((v = (0, L.jsx)(N, { className: g, showCloseButton: f, onCloseAutoFocus: i, children: _ })),
      (t[19] = i),
      (t[20] = f),
      (t[21] = g),
      (t[22] = _),
      (t[23] = v))
    : (v = t[23]);
  let y;
  return (
    t[24] !== o || t[25] !== h || t[26] !== v
      ? ((y = (0, L.jsxs)(F, { ...o, children: [h, v] })),
        (t[24] = o),
        (t[25] = h),
        (t[26] = v),
        (t[27] = y))
      : (y = t[27]),
    y
  );
}
function ut(e) {
  let t = (0, H.c)(9),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((i = (0, L.jsx)(Ce, { className: `size-4 shrink-0 opacity-50` })), (t[3] = i))
    : (i = t[3]);
  let o;
  t[4] === n
    ? (o = t[5])
    : ((o = a(
        `flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50`,
        n,
      )),
      (t[4] = n),
      (t[5] = o));
  let s;
  return (
    t[6] !== r || t[7] !== o
      ? ((s = (0, L.jsxs)(`div`, {
          "data-slot": `command-input-wrapper`,
          className: `flex h-9 items-center gap-2 border-b px-3`,
          children: [i, (0, L.jsx)(Y.Input, { "data-slot": `command-input`, className: o, ...r })],
        })),
        (t[6] = r),
        (t[7] = o),
        (t[8] = s))
      : (s = t[8]),
    s
  );
}
function dt(e) {
  let t = (0, H.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = a(`max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto`, n)),
      (t[3] = n),
      (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, L.jsx)(Y.List, { "data-slot": `command-list`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function ft(e) {
  let t = (0, H.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, L.jsx)(Y.Empty, {
          "data-slot": `command-empty`,
          className: `py-6 text-center text-sm`,
          ...n,
        })),
        (t[2] = n),
        (t[3] = r)),
    r
  );
}
function pt(e) {
  let t = (0, H.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = a(
        `overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, L.jsx)(Y.Group, { "data-slot": `command-group`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function mt(e) {
  let t = (0, H.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = a(
        `relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, L.jsx)(Y.Item, { "data-slot": `command-item`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function ht(e) {
  let t = (0, H.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, L.jsx)(se, { "data-slot": `popover`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function gt(e) {
  let t = (0, H.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, L.jsx)(le, { "data-slot": `popover-trigger`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function _t(e) {
  let t = (0, H.c)(12),
    n,
    r,
    i,
    o;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]), (o = t[4]))
    : (({ className: n, align: i, sideOffset: o, ...r } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = i),
      (t[4] = o));
  let s = i === void 0 ? `center` : i,
    c = o === void 0 ? 4 : o,
    l;
  t[5] === n
    ? (l = t[6])
    : ((l = a(
        `z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,
        n,
      )),
      (t[5] = n),
      (t[6] = l));
  let u;
  return (
    t[7] !== s || t[8] !== r || t[9] !== c || t[10] !== l
      ? ((u = (0, L.jsx)(pe, {
          children: (0, L.jsx)(me, {
            "data-slot": `popover-content`,
            align: s,
            sideOffset: c,
            className: l,
            ...r,
          }),
        })),
        (t[7] = s),
        (t[8] = r),
        (t[9] = c),
        (t[10] = l),
        (t[11] = u))
      : (u = t[11]),
    u
  );
}
export {
  lt as a,
  ut as c,
  Ce as d,
  xe as f,
  ct as i,
  mt as l,
  _t as n,
  ft as o,
  gt as r,
  pt as s,
  ht as t,
  dt as u,
};
