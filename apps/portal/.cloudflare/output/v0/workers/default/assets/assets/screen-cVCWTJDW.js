import {
  Bt as e,
  Et as t,
  Ht as n,
  Wt as r,
  _ as i,
  a,
  c as o,
  f as s,
  g as c,
  l,
  m as u,
  o as d,
  st as f,
  t as p,
  u as m,
  zt as h,
} from "./createLucideIcon-BBeoGZx-.js";
import { a as g, n as _, o as v } from "./session-C_gjqukj.js";
import { t as y } from "./link-BaidU34I.js";
import { t as b } from "./useQuery-DCYgzPRk.js";
import { t as x } from "./useSuspenseQuery-DGcWv8BO.js";
import { i as S, n as C, o as w, s as T, t as E } from "./alert-BTZapdK4.js";
import {
  C as D,
  S as O,
  _ as k,
  b as ee,
  d as te,
  f as ne,
  g as re,
  h as ie,
  l as ae,
  m as oe,
  p as se,
  u as ce,
  v as A,
  w as j,
  x as le,
  y as M,
} from "./x-B76tEvwZ.js";
import { a as N, i as ue, n as P, o as de, r as fe, s as pe, t as me } from "./check-bZy7kAyE.js";
import {
  a as F,
  c as he,
  d as ge,
  f as _e,
  i as ve,
  l as I,
  n as ye,
  o as be,
  r as xe,
  s as Se,
  t as Ce,
  u as we,
} from "./popover-CyW2k5kD.js";
import { h as Te } from "./schemas-CMFvL3XH.js";
import { t as Ee } from "./circle-check-qjEDsf6Y.js";
import { t as De } from "./git-branch-BuF_FEGU.js";
import { t as Oe } from "./loader-circle-4Q5UpSxt.js";
import { t as ke } from "./monitor-smartphone-DtjXIvTH.js";
import { t as Ae } from "./scan-barcode-q3BnZlwq.js";
import { t as je } from "./store-BMentYd9.js";
import { t as Me } from "./upload-Cq0t42XQ.js";
import {
  Bt as Ne,
  Dt as Pe,
  Ht as Fe,
  Ot as Ie,
  R as Le,
  Ut as L,
  Vt as Re,
  ct as ze,
  lt as Be,
  st as Ve,
  ut as He,
} from "./index-DZbZvBMN.js";
import { i as Ue, n as We, r as Ge, t as Ke } from "./online-B_7Uj1Wv.js";
import { i as qe, n as Je, r as Ye, t as Xe } from "./callback-Bk8_3X5T.js";
var R = r(n(), 1),
  z = e(),
  Ze = Object.defineProperty,
  B = (e, t) => Ze(e, `name`, { value: t, configurable: !0 }),
  Qe = `Avatar`,
  [$e, et] = j(Qe),
  V = { Idle: `idle`, Loading: `loading`, Loaded: `loaded`, Error: `error` },
  tt = [0, () => void 0],
  [nt, rt] = $e(Qe),
  it = R.forwardRef(
    B(function (e, t) {
      let { __scopeAvatar: n, ...r } = e,
        [i, a] = R.useState(V.Idle),
        [o, s] = lt();
      return (0, z.jsx)(nt, {
        scope: n,
        imageLoadingStatus: i,
        setImageLoadingStatus: a,
        imageCount: o,
        setImageCount: s,
        children: (0, z.jsx)(w.span, { ...r, ref: t }),
      });
    }, `Avatar`),
  ),
  at = `AvatarFallback`,
  ot = R.forwardRef(
    B(function (e, t) {
      let { __scopeAvatar: n, delayMs: r, ...i } = e,
        a = rt(at, n),
        [o, s] = R.useState(r === void 0);
      return (
        R.useEffect(() => {
          if (r !== void 0) {
            let e = window.setTimeout(() => s(!0), r);
            return () => window.clearTimeout(e);
          }
        }, [r]),
        o && a.imageLoadingStatus !== V.Loaded ? (0, z.jsx)(w.span, { ...i, ref: t }) : null
      );
    }, `AvatarFallback`),
  );
function st(e, { loadingStatus: t, setLoadingStatus: n, referrerPolicy: r, crossOrigin: i }) {
  return (
    O(() => {
      if (!e) {
        n(V.Error);
        return;
      }
      let t = new window.Image(),
        a = B((e) => {
          let t = e.currentTarget;
          n(ct(t));
        }, `handleLoad`),
        o = B(() => n(V.Error), `handleError`);
      return (
        t.addEventListener(`load`, a),
        t.addEventListener(`error`, o),
        r && (t.referrerPolicy = r),
        (t.crossOrigin = i ?? null),
        (t.src = e),
        n(ct(t)),
        () => {
          (t.removeEventListener(`load`, a), t.removeEventListener(`error`, o), n(V.Idle));
        }
      );
    }, [e, i, r, n]),
    t
  );
}
B(st, `useImageLoadingStatus`);
function ct(e) {
  return e.complete ? (e.naturalWidth > 0 ? V.Loaded : V.Error) : V.Loading;
}
B(ct, `getImageLoadingStatus`);
function lt() {
  return tt;
}
B(lt, `useImageCount`);
function ut(e) {}
B(ut, `useUpdateImageCount`);
var dt = Object.defineProperty,
  ft = (e, t) => dt(e, `name`, { value: t, configurable: !0 }),
  pt = !1;
function mt() {
  let [e, t] = R.useState(pt);
  return (
    R.useEffect(() => {
      pt || ((pt = !0), t(!0));
    }, []),
    e
  );
}
ft(mt, `useIsHydrated`);
var ht = R.useSyncExternalStore;
function gt() {
  return () => {};
}
ft(gt, `subscribe`);
function _t() {
  return ht(
    gt,
    () => !0,
    () => !1,
  );
}
ft(_t, `useIsHydratedModern`);
var vt = typeof ht == `function` ? _t : mt,
  yt = Object.defineProperty,
  H = (e, t) => yt(e, `name`, { value: t, configurable: !0 }),
  bt = `rovingFocusGroup.onEntryFocus`,
  xt = { bubbles: !1, cancelable: !0 },
  U = `RovingFocusGroup`,
  [St, Ct, wt] = pe(U),
  [Tt, Et] = j(U, [wt]),
  Dt = { Vertical: `vertical`, Horizontal: `horizontal` },
  Ot = { LTR: `ltr`, RTL: `rtl` },
  [kt, At] = Tt(U),
  jt = R.forwardRef(
    H(function (e, t) {
      return (0, z.jsx)(St.Provider, {
        scope: e.__scopeRovingFocusGroup,
        children: (0, z.jsx)(St.Slot, {
          scope: e.__scopeRovingFocusGroup,
          children: (0, z.jsx)(Mt, { ...e, ref: t }),
        }),
      });
    }, `RovingFocusGroup`),
  ),
  Mt = R.forwardRef(
    H(function (e, t) {
      let {
          __scopeRovingFocusGroup: n,
          orientation: r,
          loop: i = !1,
          dir: a,
          currentTabStopId: o,
          defaultCurrentTabStopId: s,
          onCurrentTabStopIdChange: c,
          onEntryFocus: l,
          preventScrollOnEntryFocus: d = !1,
          ...f
        } = e,
        p = R.useRef(null),
        m = u(t, p),
        h = de(a),
        [g, _] = le({ prop: o, defaultProp: s ?? null, onChange: c, caller: U }),
        [v, y] = R.useState(!1),
        b = A(l),
        x = Ct(n),
        S = R.useRef(!1),
        [C, T] = R.useState(0);
      return (
        R.useEffect(() => {
          let e = p.current;
          if (e) return (e.addEventListener(bt, b), () => e.removeEventListener(bt, b));
        }, [b]),
        (0, z.jsx)(kt, {
          scope: n,
          orientation: r,
          dir: h,
          loop: i,
          currentTabStopId: g,
          onItemFocus: R.useCallback((e) => _(e), [_]),
          onItemShiftTab: R.useCallback(() => y(!0), []),
          onFocusableItemAdd: R.useCallback(() => T((e) => e + 1), []),
          onFocusableItemRemove: R.useCallback(() => T((e) => e - 1), []),
          children: (0, z.jsx)(w.div, {
            tabIndex: v || C === 0 ? -1 : 0,
            "data-orientation": r,
            ...f,
            ref: m,
            style: { outline: `none`, ...e.style },
            onMouseDown: D(e.onMouseDown, () => {
              S.current = !0;
            }),
            onFocus: D(e.onFocus, (e) => {
              let t = !S.current;
              if (e.target === e.currentTarget && t && !v) {
                let t = new CustomEvent(bt, xt);
                if ((e.currentTarget.dispatchEvent(t), !t.defaultPrevented)) {
                  let e = x().filter((e) => e.focusable);
                  W(
                    [e.find((e) => e.active), e.find((e) => e.id === g), ...e]
                      .filter(Boolean)
                      .map((e) => e.ref.current),
                    d,
                  );
                }
              }
              S.current = !1;
            }),
            onBlur: D(e.onBlur, () => y(!1)),
          }),
        })
      );
    }, `RovingFocusGroupImpl`),
  ),
  Nt = `RovingFocusGroupItem`,
  Pt = R.forwardRef(
    H(function (e, t) {
      let {
          __scopeRovingFocusGroup: n,
          focusable: r = !0,
          active: i = !1,
          tabStopId: a,
          children: o,
          ...s
        } = e,
        c = M(),
        l = a || c,
        u = At(Nt, n),
        d = u.currentTabStopId === l,
        f = Ct(n),
        { onFocusableItemAdd: p, onFocusableItemRemove: m, currentTabStopId: h } = u,
        g = vt();
      return (
        O(() => {
          if (g && r) return (p(), () => m());
        }, [g, r, p, m]),
        R.useEffect(() => {
          if (!g && r) return (p(), () => m());
        }, [g, r, p, m]),
        (0, z.jsx)(St.ItemSlot, {
          scope: n,
          id: l,
          focusable: r,
          active: i,
          children: (0, z.jsx)(w.span, {
            tabIndex: d ? 0 : -1,
            "data-orientation": u.orientation,
            ...s,
            ref: t,
            onMouseDown: D(e.onMouseDown, (e) => {
              r ? u.onItemFocus(l) : e.preventDefault();
            }),
            onFocus: D(e.onFocus, () => u.onItemFocus(l)),
            onKeyDown: D(e.onKeyDown, (e) => {
              if (e.key === `Tab` && e.shiftKey) {
                u.onItemShiftTab();
                return;
              }
              if (e.target !== e.currentTarget) return;
              let t = Lt(e, u.orientation, u.dir);
              if (t !== void 0) {
                if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
                e.preventDefault();
                let n = f()
                  .filter((e) => e.focusable)
                  .map((e) => e.ref.current);
                if (t === `last`) n.reverse();
                else if (t === `prev` || t === `next`) {
                  t === `prev` && n.reverse();
                  let r = n.indexOf(e.currentTarget);
                  n = u.loop ? Rt(n, r + 1) : n.slice(r + 1);
                }
                setTimeout(() => W(n));
              }
            }),
            children:
              typeof o == `function` ? o({ isCurrentTabStop: d, hasTabStop: h != null }) : o,
          }),
        })
      );
    }, `RovingFocusGroupItem`),
  ),
  Ft = {
    ArrowLeft: `prev`,
    ArrowUp: `prev`,
    ArrowRight: `next`,
    ArrowDown: `next`,
    PageUp: `first`,
    Home: `first`,
    PageDown: `last`,
    End: `last`,
  };
function It(e, t) {
  return t === Ot.RTL
    ? e === `ArrowLeft`
      ? `ArrowRight`
      : e === `ArrowRight`
        ? `ArrowLeft`
        : e
    : e;
}
H(It, `getDirectionAwareKey`);
function Lt(e, t, n) {
  let r = It(e.key, n);
  if (
    !(t === Dt.Vertical && [`ArrowLeft`, `ArrowRight`].includes(r)) &&
    !(t === Dt.Horizontal && [`ArrowUp`, `ArrowDown`].includes(r))
  )
    return Ft[r];
}
H(Lt, `getFocusIntent`);
function W(e, t = !1) {
  let n = document.activeElement;
  for (let r of e)
    if (r === n || (r.focus({ preventScroll: t }), document.activeElement !== n)) return;
}
H(W, `focusFirst`);
function Rt(e, t) {
  return e.map((n, r) => e[(t + r) % e.length]);
}
H(Rt, `wrapArray`);
var zt = Object.defineProperty,
  G = (e, t) => zt(e, `name`, { value: t, configurable: !0 }),
  Bt = [`Enter`, ` `],
  Vt = [`ArrowDown`, `PageUp`, `Home`],
  Ht = [`ArrowUp`, `PageDown`, `End`],
  Ut = [...Vt, ...Ht];
([...Bt], [...Bt]);
var K = `Menu`,
  [Wt, Gt, Kt] = pe(K),
  [q, qt] = j(K, [Kt, N, Et]),
  Jt = N(),
  Yt = Et(),
  [Xt, J] = q(K),
  [Zt, Qt] = q(K),
  $t = G((e) => {
    let { __scopeMenu: t, open: n = !1, children: r, dir: i, onOpenChange: a, modal: o = !0 } = e,
      s = Jt(t),
      [c, l] = R.useState(null),
      u = R.useRef(!1),
      d = A(a),
      f = de(i);
    return (
      R.useEffect(() => {
        let e = G(() => {
            ((u.current = !0),
              document.addEventListener(`pointerdown`, t, { capture: !0, once: !0 }),
              document.addEventListener(`pointermove`, t, { capture: !0, once: !0 }));
          }, `handleKeyDown`),
          t = G(() => (u.current = !1), `handlePointer`);
        return (
          document.addEventListener(`keydown`, e, { capture: !0 }),
          () => {
            (document.removeEventListener(`keydown`, e, { capture: !0 }),
              document.removeEventListener(`pointerdown`, t, { capture: !0 }),
              document.removeEventListener(`pointermove`, t, { capture: !0 }));
          }
        );
      }, []),
      R.useEffect(() => {
        if (!n) return;
        let e = G(() => d(!1), `handleBlur`);
        return (window.addEventListener(`blur`, e), () => window.removeEventListener(`blur`, e));
      }, [n, d]),
      (0, z.jsx)(P, {
        ...s,
        children: (0, z.jsx)(Xt, {
          scope: t,
          open: n,
          onOpenChange: d,
          content: c,
          onContentChange: l,
          children: (0, z.jsx)(Zt, {
            scope: t,
            onClose: R.useCallback(() => d(!1), [d]),
            isUsingKeyboardRef: u,
            dir: f,
            modal: o,
            children: r,
          }),
        }),
      })
    );
  }, `Menu`),
  en = R.forwardRef(
    G(function (e, t) {
      let { __scopeMenu: n, ...r } = e,
        i = Jt(n);
      return (0, z.jsx)(fe, { ...i, ...r, ref: t });
    }, `MenuAnchor`),
  ),
  tn = `MenuPortal`,
  [nn, rn] = q(tn, { forceMount: void 0 }),
  an = G((e) => {
    let { __scopeMenu: t, forceMount: n, children: r, container: i } = e,
      a = J(tn, t);
    return (0, z.jsx)(nn, {
      scope: t,
      forceMount: n,
      children: (0, z.jsx)(ee, {
        present: n || a.open,
        children: (0, z.jsx)(ne, { asChild: !0, container: i, children: r }),
      }),
    });
  }, `MenuPortal`),
  Y = `MenuContent`,
  [on, sn] = q(Y),
  cn = R.forwardRef(
    G(function (e, t) {
      let n = rn(Y, e.__scopeMenu),
        { forceMount: r = n.forceMount, ...i } = e,
        a = J(Y, e.__scopeMenu),
        o = Qt(Y, e.__scopeMenu);
      return (0, z.jsx)(Wt.Provider, {
        scope: e.__scopeMenu,
        children: (0, z.jsx)(ee, {
          present: r || a.open,
          children: (0, z.jsx)(Wt.Slot, {
            scope: e.__scopeMenu,
            children: o.modal ? (0, z.jsx)(ln, { ...i, ref: t }) : (0, z.jsx)(un, { ...i, ref: t }),
          }),
        }),
      });
    }, `MenuContent`),
  ),
  ln = R.forwardRef(
    G(function (e, t) {
      let n = J(Y, e.__scopeMenu),
        r = R.useRef(null),
        i = u(t, r);
      return (
        R.useEffect(() => {
          let e = r.current;
          if (e) return ae(e);
        }, []),
        (0, z.jsx)(fn, {
          ...e,
          ref: i,
          trapFocus: n.open,
          disableOutsidePointerEvents: n.open,
          disableOutsideScroll: !0,
          onFocusOutside: D(e.onFocusOutside, (e) => e.preventDefault(), {
            checkForDefaultPrevented: !1,
          }),
          onDismiss: () => n.onOpenChange(!1),
        })
      );
    }, `MenuRootContentModal`),
  ),
  un = R.forwardRef(
    G(function (e, t) {
      let n = J(Y, e.__scopeMenu);
      return (0, z.jsx)(fn, {
        ...e,
        ref: t,
        trapFocus: !1,
        disableOutsidePointerEvents: !1,
        disableOutsideScroll: !1,
        onDismiss: () => n.onOpenChange(!1),
      });
    }, `MenuRootContentNonModal`),
  ),
  dn = s(`MenuContent.ScrollLock`),
  fn = R.forwardRef(
    G(function (e, t) {
      let {
          __scopeMenu: n,
          loop: r = !1,
          trapFocus: i,
          onOpenAutoFocus: a,
          onCloseAutoFocus: o,
          disableOutsidePointerEvents: s,
          onEntryFocus: c,
          onEscapeKeyDown: l,
          onPointerDownOutside: d,
          onFocusOutside: f,
          onInteractOutside: p,
          onDismiss: m,
          disableOutsideScroll: h,
          ...g
        } = e,
        _ = J(Y, n),
        v = Qt(Y, n),
        y = Jt(n),
        b = Yt(n),
        x = Gt(n),
        [S, C] = R.useState(null),
        w = R.useRef(null),
        [T, E] = R.useState(null);
      ie(T);
      let { nodes: O, registry: ee } = re(),
        ne = !!(i || h),
        ae = u(t, w, _.onContentChange, E),
        A = R.useRef(0),
        j = R.useRef(``),
        le = R.useRef(0),
        M = R.useRef(null),
        N = R.useRef(`right`),
        P = R.useRef(0),
        de = R.useMemo(() => (h ? [w, ...O.map((e) => ({ current: e }))] : []), [w, O, h]),
        fe = h ? ce : R.Fragment,
        pe = h ? { as: dn, allowPinchZoom: !0, shards: de } : void 0,
        me = G((e) => {
          let t = j.current + e,
            n = x().filter((e) => !e.disabled),
            r = document.activeElement,
            i = n.find((e) => e.ref.current === r)?.textValue,
            a = An(
              n.map((e) => e.textValue),
              t,
              i,
            ),
            o = n.find((e) => e.textValue === a)?.ref.current;
          (G(function e(t) {
            ((j.current = t),
              window.clearTimeout(A.current),
              t !== `` && (A.current = window.setTimeout(() => e(``), 1e3)));
          }, `updateSearch`)(t),
            o && setTimeout(() => o.focus()));
        }, `handleTypeaheadSearch`);
      (R.useEffect(() => () => window.clearTimeout(A.current), []), te());
      let F = R.useCallback((e) => N.current === M.current?.side && Mn(e, M.current?.area), []);
      return (0, z.jsx)(on, {
        scope: n,
        searchRef: j,
        onItemEnter: R.useCallback(
          (e) => {
            F(e) && e.preventDefault();
          },
          [F],
        ),
        onItemLeave: R.useCallback(
          (e) => {
            F(e) || (w.current?.focus(), C(null));
          },
          [F],
        ),
        onTriggerLeave: R.useCallback(
          (e) => {
            F(e) && e.preventDefault();
          },
          [F],
        ),
        pointerGraceTimerRef: le,
        onPointerGraceIntentChange: R.useCallback((e) => {
          M.current = e;
        }, []),
        children: (0, z.jsx)(oe, {
          registry: ne ? ee : null,
          children: (0, z.jsx)(fe, {
            ...pe,
            children: (0, z.jsx)(se, {
              asChild: !0,
              trapped: i,
              branches: O,
              onMountAutoFocus: D(a, (e) => {
                (e.preventDefault(), w.current?.focus({ preventScroll: !0 }));
              }),
              onUnmountAutoFocus: o,
              children: (0, z.jsx)(k, {
                asChild: !0,
                disableOutsidePointerEvents: s,
                onEscapeKeyDown: l,
                onPointerDownOutside: d,
                onFocusOutside: f,
                onInteractOutside: p,
                onDismiss: m,
                children: (0, z.jsx)(jt, {
                  asChild: !0,
                  ...b,
                  dir: v.dir,
                  orientation: `vertical`,
                  loop: r,
                  currentTabStopId: S,
                  onCurrentTabStopIdChange: C,
                  onEntryFocus: D(c, (e) => {
                    v.isUsingKeyboardRef.current || e.preventDefault();
                  }),
                  preventScrollOnEntryFocus: !0,
                  children: (0, z.jsx)(ue, {
                    role: `menu`,
                    "aria-orientation": `vertical`,
                    "data-state": Tn(_.open),
                    "data-radix-menu-content": ``,
                    dir: v.dir,
                    ...y,
                    ...g,
                    ref: ae,
                    style: { outline: `none`, ...g.style },
                    onKeyDown: D(g.onKeyDown, (e) => {
                      let t = e.target.closest(`[data-radix-menu-content]`) === e.currentTarget,
                        n = e.ctrlKey || e.altKey || e.metaKey,
                        r = e.key.length === 1;
                      t && (e.key === `Tab` && e.preventDefault(), !n && r && me(e.key));
                      let i = w.current;
                      if (e.target !== i || !Ut.includes(e.key)) return;
                      e.preventDefault();
                      let a = x()
                        .filter((e) => !e.disabled)
                        .map((e) => e.ref.current);
                      (Ht.includes(e.key) && a.reverse(), On(a));
                    }),
                    onBlur: D(e.onBlur, (e) => {
                      e.currentTarget.contains(e.target) ||
                        (window.clearTimeout(A.current), (j.current = ``));
                    }),
                    onPointerMove: D(
                      e.onPointerMove,
                      X((e) => {
                        let t = e.target,
                          n = P.current !== e.clientX;
                        if (e.currentTarget.contains(t) && n) {
                          let t = e.clientX > P.current ? `right` : `left`;
                          ((N.current = t), (P.current = e.clientX));
                        }
                      }),
                    ),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
    }, `MenuContentImpl`),
  ),
  pn = R.forwardRef(
    G(function (e, t) {
      let { __scopeMenu: n, ...r } = e;
      return (0, z.jsx)(w.div, { ...r, ref: t });
    }, `MenuLabel`),
  ),
  mn = `MenuItem`,
  hn = `menu.itemSelect`,
  gn = R.forwardRef(
    G(function (e, t) {
      let { disabled: n = !1, onSelect: r, ...i } = e,
        a = R.useRef(null),
        o = Qt(mn, e.__scopeMenu),
        s = sn(mn, e.__scopeMenu),
        c = u(t, a),
        l = R.useRef(!1),
        d = G(() => {
          let e = a.current;
          if (!n && e) {
            let t = new CustomEvent(hn, { bubbles: !0, cancelable: !0 });
            (e.addEventListener(hn, (e) => r?.(e), { once: !0 }),
              T(e, t),
              t.defaultPrevented ? (l.current = !1) : o.onClose());
          }
        }, `handleSelect`);
      return (0, z.jsx)(_n, {
        ...i,
        ref: c,
        disabled: n,
        onClick: D(e.onClick, d),
        onPointerDown: (t) => {
          (e.onPointerDown?.(t), (l.current = !0));
        },
        onPointerUp: D(e.onPointerUp, (e) => {
          l.current || e.currentTarget?.click();
        }),
        onKeyDown: D(e.onKeyDown, (e) => {
          n ||
            e.target !== e.currentTarget ||
            ((s.searchRef.current === `` || e.key !== ` `) &&
              Bt.includes(e.key) &&
              (e.currentTarget.click(), e.preventDefault()));
        }),
      });
    }, `MenuItem`),
  ),
  _n = R.forwardRef(
    G(function (e, t) {
      let { __scopeMenu: n, disabled: r = !1, textValue: i, ...a } = e,
        o = sn(mn, n),
        s = Yt(n),
        c = R.useRef(null),
        l = u(t, c),
        [d, f] = R.useState(!1),
        [p, m] = R.useState(``);
      return (
        R.useEffect(() => {
          let e = c.current;
          e && m((e.textContent ?? ``).trim());
        }, [a.children]),
        (0, z.jsx)(Wt.ItemSlot, {
          scope: n,
          disabled: r,
          textValue: i ?? p,
          children: (0, z.jsx)(Pt, {
            asChild: !0,
            ...s,
            focusable: !r,
            children: (0, z.jsx)(w.div, {
              role: `menuitem`,
              "data-highlighted": d ? `` : void 0,
              "aria-disabled": r || void 0,
              "data-disabled": r ? `` : void 0,
              ...a,
              ref: l,
              onPointerMove: D(
                e.onPointerMove,
                X((e) => {
                  r
                    ? o.onItemLeave(e)
                    : (o.onItemEnter(e),
                      e.defaultPrevented || e.currentTarget.focus({ preventScroll: !0 }));
                }),
              ),
              onPointerLeave: D(
                e.onPointerLeave,
                X((e) => o.onItemLeave(e)),
              ),
              onFocus: D(e.onFocus, () => f(!0)),
              onBlur: D(e.onBlur, () => f(!1)),
            }),
          }),
        })
      );
    }, `MenuItemImpl`),
  ),
  [vn, yn] = q(`MenuRadioGroup`, { value: void 0, onValueChange: G(() => {}, `onValueChange`) }),
  [bn, xn] = q(`MenuItemIndicator`, { checked: !1 }),
  Sn = R.forwardRef(
    G(function (e, t) {
      let { __scopeMenu: n, ...r } = e;
      return (0, z.jsx)(w.div, {
        role: `separator`,
        "aria-orientation": `horizontal`,
        ...r,
        ref: t,
      });
    }, `MenuSeparator`),
  ),
  [Cn, wn] = q(`MenuSub`);
function Tn(e) {
  return e ? `open` : `closed`;
}
G(Tn, `getOpenState`);
function En(e) {
  return e === `indeterminate`;
}
G(En, `isIndeterminate`);
function Dn(e) {
  return En(e) ? `indeterminate` : e ? `checked` : `unchecked`;
}
G(Dn, `getCheckedState`);
function On(e) {
  let t = document.activeElement;
  for (let n of e) if (n === t || (n.focus(), document.activeElement !== t)) return;
}
G(On, `focusFirst`);
function kn(e, t) {
  return e.map((n, r) => e[(t + r) % e.length]);
}
G(kn, `wrapArray`);
function An(e, t, n) {
  let r = t.length > 1 && Array.from(t).every((e) => e === t[0]) ? t[0] : t,
    i = n ? e.indexOf(n) : -1,
    a = kn(e, Math.max(i, 0));
  r.length === 1 && (a = a.filter((e) => e !== n));
  let o = a.find((e) => e.toLowerCase().startsWith(r.toLowerCase()));
  return o === n ? void 0 : o;
}
G(An, `getNextMatch`);
function jn(e, t) {
  let { x: n, y: r } = e,
    i = !1;
  for (let e = 0, a = t.length - 1; e < t.length; a = e++) {
    let o = t[e],
      s = t[a],
      c = o.x,
      l = o.y,
      u = s.x,
      d = s.y;
    l > r != d > r && n < ((u - c) * (r - l)) / (d - l) + c && (i = !i);
  }
  return i;
}
G(jn, `isPointInPolygon`);
function Mn(e, t) {
  return t ? jn({ x: e.clientX, y: e.clientY }, t) : !1;
}
G(Mn, `isPointerInGraceArea`);
function X(e) {
  return (t) => (t.pointerType === `mouse` ? e(t) : void 0);
}
G(X, `whenMouse`);
var Nn = Object.defineProperty,
  Z = (e, t) => Nn(e, `name`, { value: t, configurable: !0 }),
  Pn = `DropdownMenu`,
  [Fn, In] = j(Pn, [qt]),
  Q = qt(),
  [Ln, Rn] = Fn(Pn),
  zn = Z((e) => {
    let {
        __scopeDropdownMenu: t,
        children: n,
        dir: r,
        open: i,
        defaultOpen: a,
        onOpenChange: o,
        modal: s = !0,
      } = e,
      c = Q(t),
      l = R.useRef(null),
      [u, d] = le({ prop: i, defaultProp: a ?? !1, onChange: o, caller: Pn });
    return (0, z.jsx)(Ln, {
      scope: t,
      triggerId: M(),
      triggerRef: l,
      contentId: M(),
      open: u,
      onOpenChange: d,
      onOpenToggle: R.useCallback(() => d((e) => !e), [d]),
      modal: s,
      children: (0, z.jsx)($t, { ...c, open: u, onOpenChange: d, dir: r, modal: s, children: n }),
    });
  }, `DropdownMenu`),
  Bn = `DropdownMenuTrigger`,
  Vn = R.forwardRef(
    Z(function (e, t) {
      let { __scopeDropdownMenu: n, disabled: r = !1, ...i } = e,
        a = Rn(Bn, n),
        o = Q(n),
        s = u(t, a.triggerRef);
      return (0, z.jsx)(en, {
        asChild: !0,
        ...o,
        children: (0, z.jsx)(w.button, {
          type: `button`,
          id: a.triggerId,
          "aria-haspopup": `menu`,
          "aria-expanded": a.open,
          "aria-controls": a.open ? a.contentId : void 0,
          "data-state": a.open ? `open` : `closed`,
          "data-disabled": r ? `` : void 0,
          disabled: r,
          ...i,
          ref: s,
          onPointerDown: D(e.onPointerDown, (e) => {
            !r &&
              e.button === 0 &&
              e.ctrlKey === !1 &&
              (a.onOpenToggle(), a.open || e.preventDefault());
          }),
          onKeyDown: D(e.onKeyDown, (e) => {
            r ||
              ([`Enter`, ` `].includes(e.key) && a.onOpenToggle(),
              e.key === `ArrowDown` && a.onOpenChange(!0),
              [`Enter`, ` `, `ArrowDown`].includes(e.key) && e.preventDefault());
          }),
        }),
      });
    }, `DropdownMenuTrigger`),
  ),
  Hn = Z((e) => {
    let { __scopeDropdownMenu: t, ...n } = e,
      r = Q(t);
    return (0, z.jsx)(an, { ...r, ...n });
  }, `DropdownMenuPortal`),
  Un = `DropdownMenuContent`,
  Wn = R.forwardRef(
    Z(function (e, t) {
      let { __scopeDropdownMenu: n, ...r } = e,
        i = Rn(Un, n),
        a = Q(n),
        o = R.useRef(!1);
      return (0, z.jsx)(cn, {
        id: i.contentId,
        "aria-labelledby": i.triggerId,
        ...a,
        ...r,
        ref: t,
        onCloseAutoFocus: D(e.onCloseAutoFocus, (e) => {
          (o.current || i.triggerRef.current?.focus(), (o.current = !1), e.preventDefault());
        }),
        onInteractOutside: D(e.onInteractOutside, (e) => {
          let t = e.detail.originalEvent,
            n = t.button === 0 && t.ctrlKey === !0,
            r = t.button === 2 || n;
          (!i.modal || r) && (o.current = !0);
        }),
        style: {
          ...e.style,
          "--radix-dropdown-menu-content-transform-origin": `var(--radix-popper-transform-origin)`,
          "--radix-dropdown-menu-content-available-width": `var(--radix-popper-available-width)`,
          "--radix-dropdown-menu-content-available-height": `var(--radix-popper-available-height)`,
          "--radix-dropdown-menu-trigger-width": `var(--radix-popper-anchor-width)`,
          "--radix-dropdown-menu-trigger-height": `var(--radix-popper-anchor-height)`,
        },
      });
    }, `DropdownMenuContent`),
  ),
  Gn = R.forwardRef(
    Z(function (e, t) {
      let { __scopeDropdownMenu: n, ...r } = e,
        i = Q(n);
      return (0, z.jsx)(pn, { ...i, ...r, ref: t });
    }, `DropdownMenuLabel`),
  ),
  Kn = R.forwardRef(
    Z(function (e, t) {
      let { __scopeDropdownMenu: n, ...r } = e,
        i = Q(n);
      return (0, z.jsx)(gn, { ...i, ...r, ref: t });
    }, `DropdownMenuItem`),
  ),
  qn = R.forwardRef(
    Z(function (e, t) {
      let { __scopeDropdownMenu: n, ...r } = e,
        i = Q(n);
      return (0, z.jsx)(Sn, { ...i, ...r, ref: t });
    }, `DropdownMenuSeparator`),
  ),
  Jn = {
    name: `chevrons-up-down`,
    size: 24,
    node: [
      [`path`, { d: `m7 15 5 5 5-5`, key: `1hf1tw` }],
      [`path`, { d: `m7 9 5-5 5 5`, key: `sgt6xg` }],
    ],
  };
Jn.node;
var Yn = p(Jn),
  Xn = {
    name: `info`,
    size: 24,
    node: [
      [`circle`, { cx: `12`, cy: `12`, r: `10`, key: `1mglay` }],
      [`path`, { d: `M12 16v-4`, key: `1dtifu` }],
      [`path`, { d: `M12 8h.01`, key: `e9boi3` }],
    ],
  };
Xn.node;
var Zn = p(Xn),
  Qn = {
    name: `log-out`,
    size: 24,
    node: [
      [`path`, { d: `m16 17 5-5-5-5`, key: `1bji2h` }],
      [`path`, { d: `M21 12H9`, key: `dn1m92` }],
      [`path`, { d: `M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4`, key: `1uf3rs` }],
    ],
  };
Qn.node;
var $n = p(Qn),
  er = {
    name: `octagon-x`,
    size: 24,
    node: [
      [`path`, { d: `m15 9-6 6`, key: `1uzhvr` }],
      [
        `path`,
        {
          d: `M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z`,
          key: `2d38gg`,
        },
      ],
      [`path`, { d: `m9 9 6 6`, key: `z0biqf` }],
    ],
    aliases: [`x-octagon`],
  };
er.node;
var tr = p(er),
  nr = {
    name: `shield-check`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z`,
          key: `oel41y`,
        },
      ],
      [`path`, { d: `m9 12 2 2 4-4`, key: `dzmm74` }],
    ],
  };
nr.node;
var rr = p(nr),
  ir = {
    name: `triangle-alert`,
    size: 24,
    node: [
      [
        `path`,
        {
          d: `m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3`,
          key: `wmoenq`,
        },
      ],
      [`path`, { d: `M12 9v4`, key: `juzpu7` }],
      [`path`, { d: `M12 17h.01`, key: `p32p05` }],
    ],
    aliases: [`alert-triangle`],
  };
ir.node;
var ar = p(ir),
  or = {
    name: `users`,
    size: 24,
    node: [
      [`path`, { d: `M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2`, key: `1yyitq` }],
      [`path`, { d: `M16 3.128a4 4 0 0 1 0 7.744`, key: `16gr8j` }],
      [`path`, { d: `M22 21v-2a4 4 0 0 0-3-3.87`, key: `kshegd` }],
      [`circle`, { cx: `9`, cy: `7`, r: `4`, key: `nufk8` }],
    ],
  };
or.node;
var sr = p(or),
  $ = i(),
  cr = (e) => {
    let t = (0, $.c)(6),
      n;
    t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
    let r, i;
    t[2] === Symbol.for(`react.memo_cache_sentinel`)
      ? ((r = {
          success: (0, z.jsx)(Ee, { className: `size-4` }),
          info: (0, z.jsx)(Zn, { className: `size-4` }),
          warning: (0, z.jsx)(ar, { className: `size-4` }),
          error: (0, z.jsx)(tr, { className: `size-4` }),
          loading: (0, z.jsx)(Oe, { className: `size-4 animate-spin` }),
        }),
        (i = {
          "--normal-bg": `var(--popover)`,
          "--normal-text": `var(--popover-foreground)`,
          "--normal-border": `var(--border)`,
          "--border-radius": `var(--radius)`,
        }),
        (t[2] = r),
        (t[3] = i))
      : ((r = t[2]), (i = t[3]));
    let a;
    return (
      t[4] === n
        ? (a = t[5])
        : ((a = (0, z.jsx)(Pe, {
            theme: `system`,
            className: `toaster group`,
            icons: r,
            style: i,
            ...n,
          })),
          (t[4] = n),
          (t[5] = a)),
      a
    );
  };
function lr() {
  let e = (0, $.c)(1);
  if (Ke()) return null;
  let t;
  return (
    e[0] === Symbol.for(`react.memo_cache_sentinel`)
      ? ((t = (0, z.jsxs)(E, {
          role: `status`,
          className: `fixed inset-x-5 bottom-5 z-40 mx-auto max-w-2xl shadow-md`,
          children: [
            (0, z.jsx)(Be, { "aria-hidden": !0 }),
            (0, z.jsx)(C, {
              children: `You're offline. You can still look around, but changes can't be saved until you're back online.`,
            }),
          ],
        })),
        (e[0] = t))
      : (t = e[0]),
    t
  );
}
function ur() {
  let e = (0, $.c)(7),
    t = h(),
    n = L(),
    r;
  e[0] === t
    ? (r = e[1])
    : ((r = async (e) => (o(e.id), t.removeQueries({ predicate: _ }), t.fetchQuery(g()))),
      (e[0] = t),
      (e[1] = r));
  let i;
  e[2] === n
    ? (i = e[3])
    : ((i = (e, t) => n(e ? { to: `/products` } : { to: `/login`, search: { shop: t.slug } })),
      (e[2] = n),
      (e[3] = i));
  let a;
  return (
    e[4] !== r || e[5] !== i
      ? ((a = { mutationFn: r, onSuccess: i, onError: dr }), (e[4] = r), (e[5] = i), (e[6] = a))
      : (a = e[6]),
    f(a)
  );
}
function dr(e) {
  return Ie.error(e.message);
}
function fr() {
  let e = (0, $.c)(3),
    t = h(),
    n = L(),
    r;
  return (
    e[0] !== n || e[1] !== t
      ? ((r = {
          mutationFn: v,
          onSuccess: async () => {
            (await n({ to: `/login`, search: { shop: d()?.slug || void 0 } }),
              t.removeQueries({ predicate: _ }));
          },
          onError: pr,
        }),
        (e[0] = n),
        (e[1] = t),
        (e[2] = r))
      : (r = e[2]),
    f(r)
  );
}
function pr(e) {
  return Ie.error(e.message);
}
var mr = 8;
function hr(e, n) {
  let r = (0, $.c)(10),
    i;
  r[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((i = d()), (r[0] = i)) : (i = r[0]);
  let o = i,
    s;
  r[1] === e ? (s = r[2]) : ((s = e.trim()), (r[1] = e), (r[2] = s));
  let c = s,
    l,
    u;
  r[3] === c
    ? ((l = r[4]), (u = r[5]))
    : ((l = [`products`, `palette`, o?.id ?? `box`, c]),
      (u = () =>
        a(`/products?${new URLSearchParams({ q: c, limit: String(mr) })}`, Te, {
          shopId: o?.id ?? null,
        })),
      (r[3] = c),
      (r[4] = l),
      (r[5] = u));
  let f = n && c.length > 0,
    p;
  return (
    r[6] !== l || r[7] !== u || r[8] !== f
      ? ((p = { queryKey: l, queryFn: u, enabled: f, placeholderData: t }),
        (r[6] = l),
        (r[7] = u),
        (r[8] = f),
        (r[9] = p))
      : (p = r[9]),
    b(p)
  );
}
var gr = [
  { to: `/products`, label: `Products`, icon: He },
  { to: `/barcodes`, label: `Barcodes`, icon: Ae, permission: `product.read` },
  { to: `/imports`, label: `Import`, icon: Me },
  { to: `/stores`, label: `Stores`, icon: je, permission: `store.read` },
  { to: `/branches`, label: `Branches`, icon: De, permission: `branch.read` },
  { to: `/users`, label: `Users`, icon: sr, permission: `user.read` },
  { to: `/roles`, label: `Roles`, icon: rr, permission: `role.read` },
  { to: `/devices`, label: `Devices`, icon: ke, permission: `device.read` },
];
function _r() {
  let e = (0, $.c)(2),
    t = Le(),
    n;
  return (
    e[0] === t
      ? (n = e[1])
      : ((n = gr.filter((e) => {
          let { permission: n } = e;
          return !n || t?.includes(n);
        })),
        (e[0] = t),
        (e[1] = n)),
    n
  );
}
var vr = 200,
  yr = { open: !1, query: ``, term: `` };
function br(e) {
  let t = (0, $.c)(55),
    { state: n, onChange: r, onClosed: i } = e,
    a = L(),
    o = _r(),
    s = Ke(),
    { data: c, isFetching: l, isError: u } = hr(n.term, s),
    d;
  t[0] === r ? (d = t[1]) : ((d = (e) => r((t) => ({ ...t, term: e }))), (t[0] = r), (t[1] = d));
  let f = Xe(d, vr),
    p;
  t[2] !== r || t[3] !== f
    ? ((p = () => {
        (f.cancel(), r(yr));
      }),
      (t[2] = r),
      (t[3] = f),
      (t[4] = p))
    : (p = t[4]);
  let m = p,
    h;
  t[5] === n.term ? (h = t[6]) : ((h = n.term.trim()), (t[5] = n.term), (t[6] = h));
  let g = h !== ``,
    _ = n.open,
    v;
  t[7] !== m || t[8] !== r
    ? ((v = (e) => (e ? r((t) => ({ ...t, open: e })) : m())), (t[7] = m), (t[8] = r), (t[9] = v))
    : (v = t[9]);
  let y;
  t[10] === i
    ? (y = t[11])
    : ((y = (e) => {
        (e.preventDefault(), i());
      }),
      (t[10] = i),
      (t[11] = y));
  let b;
  t[12] !== r || t[13] !== f
    ? ((b = (e) => {
        (r((t) => ({ ...t, query: e })), f(e));
      }),
      (t[12] = r),
      (t[13] = f),
      (t[14] = b))
    : (b = t[14]);
  let x;
  t[15] !== n.query || t[16] !== b
    ? ((x = (0, z.jsx)(he, {
        placeholder: `Search products or jump to…`,
        value: n.query,
        onValueChange: b,
      })),
      (t[15] = n.query),
      (t[16] = b),
      (t[17] = x))
    : (x = t[17]);
  let S;
  t[18] !== s || t[19] !== g
    ? ((S = !s && g && (0, z.jsx)(xr, { children: `Can't search products offline.` })),
      (t[18] = s),
      (t[19] = g),
      (t[20] = S))
    : (S = t[20]);
  let C;
  t[21] !== u || t[22] !== s
    ? ((C = s && u && (0, z.jsx)(xr, { children: `Couldn't search products. Try again.` })),
      (t[21] = u),
      (t[22] = s),
      (t[23] = C))
    : (C = t[23]);
  let w;
  t[24] !== c?.items || t[25] !== u || t[26] !== l
    ? ((w = !l && !u && !c?.items.length && (0, z.jsx)(be, { children: `Nothing matches that.` })),
      (t[24] = c?.items),
      (t[25] = u),
      (t[26] = l),
      (t[27] = w))
    : (w = t[27]);
  let T;
  t[28] !== m || t[29] !== c || t[30] !== a || t[31] !== g || t[32] !== n.query
    ? ((T =
        g &&
        c &&
        c.items.length > 0 &&
        (0, z.jsx)(Se, {
          heading: `Products`,
          children: c.items.map((e) =>
            (0, z.jsxs)(
              I,
              {
                value: `${n.query} ${e.name} ${e.sku}`,
                onSelect: () => {
                  (m(), a({ to: `/products/$productId`, params: { productId: e.id } }));
                },
                children: [
                  (0, z.jsx)(`span`, { className: `flex-1 truncate`, children: e.name }),
                  (0, z.jsx)(`span`, {
                    className: `text-xs text-muted-foreground`,
                    children: e.sku,
                  }),
                ],
              },
              e.id,
            ),
          ),
        })),
      (t[28] = m),
      (t[29] = c),
      (t[30] = a),
      (t[31] = g),
      (t[32] = n.query),
      (t[33] = T))
    : (T = t[33]);
  let E;
  if (t[34] !== m || t[35] !== o || t[36] !== a) {
    let e;
    (t[38] !== m || t[39] !== a
      ? ((e = (e) => {
          let { to: t, label: n, icon: r } = e;
          return (0, z.jsxs)(
            I,
            {
              onSelect: () => {
                (m(), a({ to: t }));
              },
              children: [(0, z.jsx)(r, { "aria-hidden": !0 }), n],
            },
            t,
          );
        }),
        (t[38] = m),
        (t[39] = a),
        (t[40] = e))
      : (e = t[40]),
      (E = o.map(e)),
      (t[34] = m),
      (t[35] = o),
      (t[36] = a),
      (t[37] = E));
  } else E = t[37];
  let D;
  t[41] === E
    ? (D = t[42])
    : ((D = (0, z.jsx)(Se, { heading: `Go to`, children: E })), (t[41] = E), (t[42] = D));
  let O;
  t[43] !== C || t[44] !== w || t[45] !== T || t[46] !== D || t[47] !== S
    ? ((O = (0, z.jsxs)(we, { children: [S, C, w, T, D] })),
      (t[43] = C),
      (t[44] = w),
      (t[45] = T),
      (t[46] = D),
      (t[47] = S),
      (t[48] = O))
    : (O = t[48]);
  let k;
  return (
    t[49] !== n.open || t[50] !== O || t[51] !== v || t[52] !== y || t[53] !== x
      ? ((k = (0, z.jsxs)(F, {
          open: _,
          onOpenChange: v,
          onCloseAutoFocus: y,
          title: `Search`,
          description: `Search products or jump to a page`,
          children: [x, O],
        })),
        (t[49] = n.open),
        (t[50] = O),
        (t[51] = v),
        (t[52] = y),
        (t[53] = x),
        (t[54] = k))
      : (k = t[54]),
    k
  );
}
function xr(e) {
  let t = (0, $.c)(2),
    { children: n } = e,
    r;
  return (
    t[0] === n
      ? (r = t[1])
      : ((r = (0, z.jsx)(`p`, {
          role: `status`,
          className: `py-6 text-center text-sm text-muted-foreground`,
          children: n,
        })),
        (t[0] = n),
        (t[1] = r)),
    r
  );
}
function Sr(e) {
  let t = (0, $.c)(36),
    { shops: n, currentId: r } = e,
    [i, a] = (0, R.useState)(!1),
    o = ur(),
    s = L(),
    c;
  if (t[0] !== r || t[1] !== n) {
    let e;
    (t[3] === r ? (e = t[4]) : ((e = (e) => e.id === r), (t[3] = r), (t[4] = e)),
      (c = n.find(e)),
      (t[0] = r),
      (t[1] = n),
      (t[2] = c));
  } else c = t[2];
  let l = c,
    u = `Shop: ${l?.name ?? `none selected`}`,
    d;
  t[5] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((d = (0, z.jsx)(je, { "aria-hidden": !0 })), (t[5] = d))
    : (d = t[5]);
  let f = l?.name ?? `Select a shop`,
    p;
  t[6] === f
    ? (p = t[7])
    : ((p = (0, z.jsx)(`span`, { className: `flex-1 truncate text-left`, children: f })),
      (t[6] = f),
      (t[7] = p));
  let h;
  t[8] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((h = (0, z.jsx)(Yn, { "aria-hidden": !0, className: `opacity-50` })), (t[8] = h))
    : (h = t[8]);
  let g;
  t[9] !== i || t[10] !== u || t[11] !== p
    ? ((g = (0, z.jsx)(xe, {
        asChild: !0,
        children: (0, z.jsxs)(m, {
          variant: `outline`,
          role: `combobox`,
          "aria-label": u,
          "aria-expanded": i,
          className: `w-full justify-start font-medium sm:w-50`,
          children: [d, p, h],
        }),
      })),
      (t[9] = i),
      (t[10] = u),
      (t[11] = p),
      (t[12] = g))
    : (g = t[12]);
  let _;
  t[13] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((_ = (0, z.jsx)(he, { placeholder: `Find a shop` })), (t[13] = _))
    : (_ = t[13]);
  let v;
  t[14] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((v = (0, z.jsx)(be, { children: `No shop found.` })), (t[14] = v))
    : (v = t[14]);
  let y;
  if (t[15] !== r || t[16] !== o || t[17] !== n) {
    let e;
    (t[19] !== r || t[20] !== o
      ? ((e = (e) =>
          (0, z.jsxs)(
            I,
            {
              value: `${e.name} ${e.slug}`,
              onSelect: () => {
                (a(!1), e.id !== r && o.mutate(e));
              },
              children: [
                (0, z.jsx)(`span`, { className: `flex-1 truncate`, children: e.name }),
                e.id === r && (0, z.jsx)(me, { "aria-hidden": !0 }),
              ],
            },
            e.id,
          )),
        (t[19] = r),
        (t[20] = o),
        (t[21] = e))
      : (e = t[21]),
      (y = n.map(e)),
      (t[15] = r),
      (t[16] = o),
      (t[17] = n),
      (t[18] = y));
  } else y = t[18];
  let b;
  t[22] === y
    ? (b = t[23])
    : ((b = (0, z.jsxs)(ve, {
        children: [
          _,
          (0, z.jsxs)(we, {
            children: [v, (0, z.jsx)(Se, { heading: `Shops on this device`, children: y })],
          }),
        ],
      })),
      (t[22] = y),
      (t[23] = b));
  let x;
  t[24] === s
    ? (x = t[25])
    : ((x = () => {
        (a(!1), s({ to: `/login` }));
      }),
      (t[24] = s),
      (t[25] = x));
  let S;
  t[26] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((S = (0, z.jsx)(_e, { "aria-hidden": !0 })), (t[26] = S))
    : (S = t[26]);
  let C;
  t[27] === x
    ? (C = t[28])
    : ((C = (0, z.jsx)(`div`, {
        className: `border-t p-1`,
        children: (0, z.jsxs)(m, {
          variant: `ghost`,
          className: `w-full justify-start font-normal`,
          onClick: x,
          children: [S, `Add another shop`],
        }),
      })),
      (t[27] = x),
      (t[28] = C));
  let w;
  t[29] !== b || t[30] !== C
    ? ((w = (0, z.jsxs)(ye, {
        "aria-label": `Shops`,
        align: `start`,
        className: `w-(--radix-popover-trigger-width) min-w-56 p-0`,
        children: [b, C],
      })),
      (t[29] = b),
      (t[30] = C),
      (t[31] = w))
    : (w = t[31]);
  let T;
  return (
    t[32] !== i || t[33] !== w || t[34] !== g
      ? ((T = (0, z.jsxs)(Ce, { open: i, onOpenChange: a, children: [g, w] })),
        (t[32] = i),
        (t[33] = w),
        (t[34] = g),
        (t[35] = T))
      : (T = t[35]),
    T
  );
}
var Cr = Object.freeze({
  version: `0.1.0`,
  gitSha: `977d8108e32de8dc5d44fad2ef468c76abc92f1f`,
  buildDate: `2026-10-15T01:22:18.410Z`,
  schemaVersion: 14,
  syncProtocol: 2,
  archiveFormat: 1,
});
function wr(e) {
  let t = (0, $.c)(10),
    n,
    r,
    i;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]))
    : (({ className: n, size: i, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = i));
  let a = i === void 0 ? `default` : i,
    o;
  t[4] === n
    ? (o = t[5])
    : ((o = c(
        `group/avatar relative flex size-8 shrink-0 overflow-hidden rounded-full select-none data-[size=lg]:size-10 data-[size=sm]:size-6`,
        n,
      )),
      (t[4] = n),
      (t[5] = o));
  let s;
  return (
    t[6] !== r || t[7] !== a || t[8] !== o
      ? ((s = (0, z.jsx)(it, { "data-slot": `avatar`, "data-size": a, className: o, ...r })),
        (t[6] = r),
        (t[7] = a),
        (t[8] = o),
        (t[9] = s))
      : (s = t[9]),
    s
  );
}
function Tr(e) {
  let t = (0, $.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = c(
        `flex size-full items-center justify-center rounded-full bg-muted text-sm text-muted-foreground group-data-[size=sm]/avatar:text-xs`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let a;
  return (
    t[5] !== r || t[6] !== i
      ? ((a = (0, z.jsx)(ot, { "data-slot": `avatar-fallback`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = a))
      : (a = t[7]),
    a
  );
}
function Er(e) {
  let t = (0, $.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, z.jsx)(zn, { "data-slot": `dropdown-menu`, ...n })), (t[2] = n), (t[3] = r)),
    r
  );
}
function Dr(e) {
  let t = (0, $.c)(4),
    n;
  t[0] === e ? (n = t[1]) : (({ ...n } = e), (t[0] = e), (t[1] = n));
  let r;
  return (
    t[2] === n
      ? (r = t[3])
      : ((r = (0, z.jsx)(Vn, { "data-slot": `dropdown-menu-trigger`, ...n })),
        (t[2] = n),
        (t[3] = r)),
    r
  );
}
function Or(e) {
  let t = (0, $.c)(10),
    n,
    r,
    i;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]))
    : (({ className: n, sideOffset: i, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = i));
  let a = i === void 0 ? 4 : i,
    o;
  t[4] === n
    ? (o = t[5])
    : ((o = c(
        `z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95`,
        n,
      )),
      (t[4] = n),
      (t[5] = o));
  let s;
  return (
    t[6] !== r || t[7] !== a || t[8] !== o
      ? ((s = (0, z.jsx)(Hn, {
          children: (0, z.jsx)(Wn, {
            "data-slot": `dropdown-menu-content`,
            sideOffset: a,
            className: o,
            ...r,
          }),
        })),
        (t[6] = r),
        (t[7] = a),
        (t[8] = o),
        (t[9] = s))
      : (s = t[9]),
    s
  );
}
function kr(e) {
  let t = (0, $.c)(12),
    n,
    r,
    i,
    a;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]), (a = t[4]))
    : (({ className: n, inset: r, variant: a, ...i } = e),
      (t[0] = e),
      (t[1] = n),
      (t[2] = r),
      (t[3] = i),
      (t[4] = a));
  let o = a === void 0 ? `default` : a,
    s;
  t[5] === n
    ? (s = t[6])
    : ((s = c(
        `relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 data-[variant=destructive]:focus:text-destructive dark:data-[variant=destructive]:focus:bg-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground data-[variant=destructive]:*:[svg]:text-destructive!`,
        n,
      )),
      (t[5] = n),
      (t[6] = s));
  let l;
  return (
    t[7] !== r || t[8] !== i || t[9] !== s || t[10] !== o
      ? ((l = (0, z.jsx)(Kn, {
          "data-slot": `dropdown-menu-item`,
          "data-inset": r,
          "data-variant": o,
          className: s,
          ...i,
        })),
        (t[7] = r),
        (t[8] = i),
        (t[9] = s),
        (t[10] = o),
        (t[11] = l))
      : (l = t[11]),
    l
  );
}
function Ar(e) {
  let t = (0, $.c)(10),
    n,
    r,
    i;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (i = t[3]))
    : (({ className: n, inset: r, ...i } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = i));
  let a;
  t[4] === n
    ? (a = t[5])
    : ((a = c(`px-2 py-1.5 text-sm font-medium data-[inset]:pl-8`, n)), (t[4] = n), (t[5] = a));
  let o;
  return (
    t[6] !== r || t[7] !== i || t[8] !== a
      ? ((o = (0, z.jsx)(Gn, {
          "data-slot": `dropdown-menu-label`,
          "data-inset": r,
          className: a,
          ...i,
        })),
        (t[6] = r),
        (t[7] = i),
        (t[8] = a),
        (t[9] = o))
      : (o = t[9]),
    o
  );
}
function jr(e) {
  let t = (0, $.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n ? (i = t[4]) : ((i = c(`-mx-1 my-1 h-px bg-border`, n)), (t[3] = n), (t[4] = i));
  let a;
  return (
    t[5] !== r || t[6] !== i
      ? ((a = (0, z.jsx)(qn, { "data-slot": `dropdown-menu-separator`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = a))
      : (a = t[7]),
    a
  );
}
function Mr(e) {
  let t = (0, $.c)(28),
    { user: n } = e,
    r = fr(),
    i = n.name,
    a;
  t[0] === n.name ? (a = t[1]) : ((a = Nr(n.name)), (t[0] = n.name), (t[1] = a));
  let o;
  t[2] === a
    ? (o = t[3])
    : ((o = (0, z.jsx)(wr, {
        children: (0, z.jsx)(Tr, { className: `text-foreground`, children: a }),
      })),
      (t[2] = a),
      (t[3] = o));
  let s;
  t[4] !== o || t[5] !== n.name
    ? ((s = (0, z.jsx)(Dr, {
        asChild: !0,
        children: (0, z.jsx)(m, {
          variant: `ghost`,
          size: `icon`,
          className: `rounded-full`,
          "aria-label": i,
          children: o,
        }),
      })),
      (t[4] = o),
      (t[5] = n.name),
      (t[6] = s))
    : (s = t[6]);
  let c;
  t[7] === n.name
    ? (c = t[8])
    : ((c = (0, z.jsx)(`span`, { className: `truncate font-medium`, children: n.name })),
      (t[7] = n.name),
      (t[8] = c));
  let l;
  t[9] === n.email
    ? (l = t[10])
    : ((l = (0, z.jsx)(`span`, { className: `truncate text-muted-foreground`, children: n.email })),
      (t[9] = n.email),
      (t[10] = l));
  let u;
  t[11] !== c || t[12] !== l
    ? ((u = (0, z.jsxs)(Ar, { className: `flex flex-col gap-0.5 font-normal`, children: [c, l] })),
      (t[11] = c),
      (t[12] = l),
      (t[13] = u))
    : (u = t[13]);
  let d;
  t[14] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((d = (0, z.jsx)(jr, {})), (t[14] = d))
    : (d = t[14]);
  let f;
  t[15] === r ? (f = t[16]) : ((f = () => r.mutate()), (t[15] = r), (t[16] = f));
  let p;
  t[17] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((p = (0, z.jsx)($n, { "aria-hidden": !0 })), (t[17] = p))
    : (p = t[17]);
  let h;
  t[18] === f
    ? (h = t[19])
    : ((h = (0, z.jsxs)(kr, { onSelect: f, children: [p, `Sign out`] })), (t[18] = f), (t[19] = h));
  let g, _;
  t[20] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((g = (0, z.jsx)(jr, {})),
      (_ = (0, z.jsxs)(Ar, {
        className: `text-xs font-normal text-muted-foreground`,
        children: [`Shopper `, Cr.version],
      })),
      (t[20] = g),
      (t[21] = _))
    : ((g = t[20]), (_ = t[21]));
  let v;
  t[22] !== h || t[23] !== u
    ? ((v = (0, z.jsxs)(Or, { align: `end`, className: `w-64`, children: [u, d, h, g, _] })),
      (t[22] = h),
      (t[23] = u),
      (t[24] = v))
    : (v = t[24]);
  let y;
  return (
    t[25] !== v || t[26] !== s
      ? ((y = (0, z.jsxs)(Er, { modal: !1, children: [s, v] })),
        (t[25] = v),
        (t[26] = s),
        (t[27] = y))
      : (y = t[27]),
    y
  );
}
function Nr(e) {
  return e
    .split(/\s+/)
    .slice(0, 2)
    .map((e) => e[0]?.toUpperCase())
    .join(``);
}
function Pr(e) {
  let t = (0, $.c)(3),
    n;
  return (
    t[0] !== e.focusSearch || t[1] !== e.openPalette
      ? ((n = { "Mod+K": e.openPalette, "/": e.focusSearch }),
        (t[0] = e.focusSearch),
        (t[1] = e.openPalette),
        (t[2] = n))
      : (n = t[2]),
    Ue(n)
  );
}
function Fr(e) {
  let t = (0, $.c)(24),
    { shops: n, currentId: r, user: i } = e,
    [a, o] = (0, R.useState)(yr),
    s = _r(),
    c = (0, R.useRef)(null),
    l = (0, R.useRef)(null),
    u;
  t[0] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((u = (e) => {
        let t = e === void 0 ? `` : e;
        return o({ open: !0, query: t, term: t });
      }),
      (t[0] = u))
    : (u = t[0]);
  let d = u,
    f;
  t[1] === Symbol.for(`react.memo_cache_sentinel`) ? ((f = () => d()), (t[1] = f)) : (f = t[1]);
  let p = Pr({ openPalette: f, focusSearch: h });
  function h() {
    (c.current?.focus(), document.activeElement !== c.current && l.current?.focus());
  }
  let g;
  t[2] !== r || t[3] !== n
    ? ((g = (0, z.jsx)(`div`, {
        className: `flex min-w-0 flex-1 items-center gap-x-6 xl:flex-initial`,
        children: (0, z.jsx)(Sr, { shops: n, currentId: r }),
      })),
      (t[2] = r),
      (t[3] = n),
      (t[4] = g))
    : (g = t[4]);
  let _;
  t[5] === s ? (_ = t[6]) : ((_ = s.map(Ir)), (t[5] = s), (t[6] = _));
  let v;
  t[7] === _
    ? (v = t[8])
    : ((v = (0, z.jsx)(`div`, {
        className: `order-last flex w-full flex-wrap gap-x-6 gap-y-1 xl:order-none xl:w-auto xl:flex-nowrap`,
        children: _,
      })),
      (t[7] = _),
      (t[8] = v));
  let y;
  t[9] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((y = (0, z.jsx)(m, {
        ref: l,
        variant: `ghost`,
        size: `icon`,
        className: `xl:hidden`,
        "aria-label": `Search`,
        onClick: () => d(),
        children: (0, z.jsx)(ge, { "aria-hidden": !0 }),
      })),
      (t[9] = y))
    : (y = t[9]);
  let b;
  t[10] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((b = (0, z.jsx)(Ye, { children: (0, z.jsx)(ge, { "aria-hidden": !0 }) })), (t[10] = b))
    : (b = t[10]);
  let x;
  t[11] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((x = (0, z.jsx)(qe, {
        ref: c,
        value: ``,
        placeholder: `Search`,
        "aria-label": `Search`,
        "aria-keyshortcuts": `/ Control+K Meta+K`,
        onClick: () => d(),
        onChange: (e) => d(e.target.value),
      })),
      (t[11] = x))
    : (x = t[11]);
  let S;
  t[12] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((S = (0, z.jsxs)(Je, {
        className: `hidden w-72 xl:flex`,
        children: [
          b,
          x,
          (0, z.jsx)(Ye, {
            align: `inline-end`,
            children: (0, z.jsxs)(ze, {
              "aria-hidden": !0,
              children: [(0, z.jsx)(Ve, { children: We }), (0, z.jsx)(Ve, { children: `K` })],
            }),
          }),
        ],
      })),
      (t[12] = S))
    : (S = t[12]);
  let C;
  t[13] === i
    ? (C = t[14])
    : ((C = (0, z.jsxs)(`div`, {
        className: `flex items-center gap-4 md:ml-auto`,
        children: [y, S, (0, z.jsx)(Mr, { user: i })],
      })),
      (t[13] = i),
      (t[14] = C));
  let w;
  t[15] !== h || t[16] !== a
    ? ((w = (0, z.jsx)(br, { state: a, onChange: o, onClosed: h })),
      (t[15] = h),
      (t[16] = a),
      (t[17] = w))
    : (w = t[17]);
  let T;
  return (
    t[18] !== p || t[19] !== C || t[20] !== w || t[21] !== g || t[22] !== v
      ? ((T = (0, z.jsxs)(`nav`, {
          ref: p,
          "aria-label": `Main`,
          className: `flex flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap`,
          children: [g, v, C, w],
        })),
        (t[18] = p),
        (t[19] = C),
        (t[20] = w),
        (t[21] = g),
        (t[22] = v),
        (t[23] = T))
      : (T = t[23]),
    T
  );
}
function Ir(e) {
  let { to: t, label: n } = e;
  return (0, z.jsx)(
    y,
    {
      to: t,
      className: `-mx-2 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground data-[status=active]:text-foreground`,
      children: n,
    },
    t,
  );
}
function Lr() {
  let e = (0, $.c)(13),
    { shops: t, currentId: n } = l(),
    r;
  e[0] === Symbol.for(`react.memo_cache_sentinel`) ? ((r = g()), (e[0] = r)) : (r = e[0]);
  let { data: i } = x(r);
  if (!i) {
    let t;
    return (
      e[1] === Symbol.for(`react.memo_cache_sentinel`)
        ? ((t = (0, z.jsx)(Fe, { to: `/login`, search: { shop: d()?.slug || void 0 } })),
          (e[1] = t))
        : (t = e[1]),
      t
    );
  }
  let a;
  e[2] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((a = (0, z.jsx)(lr, {})), (e[2] = a))
    : (a = e[2]);
  let o;
  e[3] !== n || e[4] !== i.user || e[5] !== t
    ? ((o = (0, z.jsx)(Fr, { shops: t, currentId: n, user: i.user })),
      (e[3] = n),
      (e[4] = i.user),
      (e[5] = t),
      (e[6] = o))
    : (o = e[6]);
  let s;
  e[7] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((s = (0, z.jsx)(`main`, {
        className: `-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1`,
        children: (0, z.jsx)(Re, {}),
      })),
      (e[7] = s))
    : (s = e[7]);
  let c;
  e[8] === o
    ? (c = e[9])
    : ((c = (0, z.jsxs)(Ne, {
        fill: !0,
        className: `flex flex-col gap-8 px-5 py-6 md:px-13 md:py-10`,
        children: [a, o, s],
      })),
      (e[8] = o),
      (e[9] = c));
  let u;
  e[10] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((u = (0, z.jsx)(cr, {})), (e[10] = u))
    : (u = e[10]);
  let f;
  return (
    e[11] === c
      ? (f = e[12])
      : ((f = (0, z.jsxs)(Ge, { ref: S, children: [c, u] })), (e[11] = c), (e[12] = f)),
    f
  );
}
export { Lr as ShellScreen };
