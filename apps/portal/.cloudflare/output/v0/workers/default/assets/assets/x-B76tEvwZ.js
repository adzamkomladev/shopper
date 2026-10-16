import {
  Bt as e,
  Ht as t,
  Vt as n,
  Wt as r,
  f as i,
  m as a,
  t as o,
} from "./createLucideIcon-BBeoGZx-.js";
import { o as s, s as c } from "./alert-BTZapdK4.js";
var l = r(t(), 1),
  u = e(),
  d = Object.defineProperty,
  f = (e, t) => d(e, `name`, { value: t, configurable: !0 });
function p(e, t) {
  let n = l.createContext(t);
  n.displayName = e + `Context`;
  let r = f((e) => {
    let { children: t, ...r } = e,
      i = l.useMemo(() => r, Object.values(r));
    return (0, u.jsx)(n.Provider, { value: i, children: t });
  }, `Provider`);
  r.displayName = e + `Provider`;
  function i(r, i = {}) {
    let { optional: a = !1 } = i,
      o = l.useContext(n);
    if (o) return o;
    if (t !== void 0) return t;
    if (!a) throw Error(`\`${r}\` must be used within \`${e}\``);
  }
  return (f(i, `useContext`), [r, i]);
}
f(p, `createContext`);
function m(e, t = []) {
  let n = [];
  function r(t, r) {
    let i = l.createContext(r);
    i.displayName = t + `Context`;
    let a = n.length;
    n = [...n, r];
    let o = f((t) => {
      let { scope: n, children: r, ...o } = t,
        s = n?.[e]?.[a] || i,
        c = l.useMemo(() => o, Object.values(o));
      return (0, u.jsx)(s.Provider, { value: c, children: r });
    }, `Provider`);
    o.displayName = t + `Provider`;
    function s(n, o, s = {}) {
      let { optional: c = !1 } = s,
        u = o?.[e]?.[a] || i,
        d = l.useContext(u);
      if (d) return d;
      if (r !== void 0) return r;
      if (!c) throw Error(`\`${n}\` must be used within \`${t}\``);
    }
    return (f(s, `useContext`), [o, s]);
  }
  f(r, `createContext`);
  let i = f(() => {
    let t = n.map((e) => l.createContext(e));
    return f(function (n) {
      let r = n?.[e] || t;
      return l.useMemo(() => ({ [`__scope${e}`]: { ...n, [e]: r } }), [n, r]);
    }, `useScope`);
  }, `createScope`);
  return ((i.scopeName = e), [r, h(i, ...t)]);
}
f(m, `createContextScope`);
function h(...e) {
  let t = e[0];
  if (e.length === 1) return t;
  let n = f(() => {
    let n = e.map((e) => ({ useScope: e(), scopeName: e.scopeName }));
    return f(function (e) {
      let r = n.reduce((t, { useScope: n, scopeName: r }) => {
        let i = n(e)[`__scope${r}`];
        return { ...t, ...i };
      }, {});
      return l.useMemo(() => ({ [`__scope${t.scopeName}`]: r }), [r]);
    }, `useComposedScopes`);
  }, `createScope`);
  return ((n.scopeName = t.scopeName), n);
}
f(h, `composeContextScopes`);
var g = Object.defineProperty,
  _ = (e, t) => g(e, `name`, { value: t, configurable: !0 }),
  v = !!(typeof window < `u` && window.document && window.document.createElement);
function y(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
  return _(function (r) {
    if ((e?.(r), n === !1 || !r || !r.defaultPrevented)) return t?.(r);
  }, `handleEvent`);
}
_(y, `composeEventHandlers`);
function b(e) {
  if (!v) throw Error(`Cannot access window outside of the DOM`);
  return e?.ownerDocument?.defaultView ?? window;
}
_(b, `getOwnerWindow`);
function x(e) {
  if (!v) throw Error(`Cannot access document outside of the DOM`);
  return e?.ownerDocument ?? document;
}
_(x, `getOwnerDocument`);
function S(e, t = !1) {
  let { activeElement: n } = x(e);
  if (!n?.nodeName) return null;
  if (C(n) && n.contentDocument) return S(n.contentDocument.body, t);
  if (t) {
    let e = n.getAttribute(`aria-activedescendant`);
    if (e) {
      let t = x(n).getElementById(e);
      if (t) return t;
    }
  }
  return n;
}
_(S, `getActiveElement`);
function C(e) {
  return e.tagName === `IFRAME`;
}
_(C, `isFrame`);
var w = globalThis?.document ? l.useLayoutEffect : () => {},
  ee = Object.defineProperty,
  te = (e, t) => ee(e, `name`, { value: t, configurable: !0 }),
  T = l.useEffectEvent,
  ne = l.useInsertionEffect;
function E(e) {
  if (typeof T == `function`) return T(e);
  let t = l.useRef(() => {
    throw Error(`Cannot call an event handler while rendering.`);
  });
  return (
    typeof ne == `function`
      ? ne(() => {
          t.current = e;
        })
      : w(() => {
          t.current = e;
        }),
    l.useMemo(
      () =>
        (...e) =>
          t.current?.(...e),
      [],
    )
  );
}
te(E, `useEffectEvent`);
var re = Object.defineProperty,
  D = (e, t) => re(e, `name`, { value: t, configurable: !0 }),
  ie = l.useInsertionEffect || w;
function ae({ prop: e, defaultProp: t, onChange: n = D(() => {}, `onChange`), caller: r }) {
  let [i, a, o] = oe({ defaultProp: t, onChange: n }),
    s = e !== void 0;
  return [
    s ? e : i,
    l.useCallback(
      (t) => {
        if (s) {
          let n = se(t) ? t(e) : t;
          n !== e && o.current?.(n);
        } else a(t);
      },
      [s, e, a, o],
    ),
  ];
}
D(ae, `useControllableState`);
function oe({ defaultProp: e, onChange: t }) {
  let [n, r] = l.useState(e),
    i = l.useRef(n),
    a = l.useRef(t);
  return (
    ie(() => {
      a.current = t;
    }, [t]),
    l.useEffect(() => {
      i.current !== n && (a.current?.(n), (i.current = n));
    }, [n, i]),
    [n, r, a]
  );
}
D(oe, `useUncontrolledState`);
function se(e) {
  return typeof e == `function`;
}
D(se, `isFunction`);
var ce = Symbol(`RADIX:SYNC_STATE`);
function le(e, t, n, r) {
  let { prop: i, defaultProp: a, onChange: o, caller: s } = t,
    c = i !== void 0,
    u = E(o),
    d = [{ ...n, state: a }];
  r && d.push(r);
  let [f, p] = l.useReducer(
      (t, n) => {
        if (n.type === ce) return { ...t, state: n.state };
        let r = e(t, n);
        return (c && !Object.is(r.state, t.state) && u(r.state), r);
      },
      ...d,
    ),
    m = f.state,
    h = l.useRef(m);
  l.useEffect(() => {
    h.current !== m && ((h.current = m), c || u(m));
  }, [m, h, c]);
  let g = l.useMemo(() => (i === void 0 ? f : { ...f, state: i }), [f, i]);
  return (
    l.useEffect(() => {
      c && !Object.is(i, f.state) && p({ type: ce, state: i });
    }, [i, f.state, c]),
    [g, p]
  );
}
D(le, `useControllableStateReducer`);
var ue = r(n(), 1),
  de = Object.defineProperty,
  O = (e, t) => de(e, `name`, { value: t, configurable: !0 });
function fe(e, t) {
  return l.useReducer((e, n) => t[e][n] ?? e, e);
}
O(fe, `useStateMachine`);
var k = O((e) => {
  let { present: t, children: n } = e,
    r = pe(t),
    i = typeof n == `function` ? n({ present: r.isPresent }) : l.Children.only(n),
    a = he(r.ref, ge(i));
  return typeof n == `function` || r.isPresent ? l.cloneElement(i, { ref: a }) : null;
}, `Presence`);
function pe(e) {
  let [t, n] = l.useState(),
    r = l.useRef(null),
    i = l.useRef(e),
    a = l.useRef(`none`),
    o = l.useRef(void 0),
    [s, c] = fe(e ? `mounted` : `unmounted`, {
      mounted: { UNMOUNT: `unmounted`, ANIMATION_OUT: `unmountSuspended` },
      unmountSuspended: { MOUNT: `mounted`, ANIMATION_END: `unmounted` },
      unmounted: { MOUNT: `mounted` },
    });
  return (
    l.useEffect(() => {
      s === `mounted`
        ? ((a.current = o.current ?? A(r.current)), (o.current = void 0))
        : (a.current = `none`);
    }, [s]),
    w(() => {
      let t = r.current,
        n = i.current;
      if (n !== e) {
        let r = a.current,
          s = A(t);
        (e
          ? ((o.current = s), c(`MOUNT`))
          : s === `none` || t?.display === `none`
            ? c(`UNMOUNT`)
            : c(n && r !== s ? `ANIMATION_OUT` : `UNMOUNT`),
          (i.current = e));
      }
    }, [e, c]),
    w(() => {
      if (t) {
        let e,
          n = t.ownerDocument.defaultView ?? window,
          o = O((a) => {
            let o = A(r.current).includes(CSS.escape(a.animationName));
            if (a.target === t && o && (c(`ANIMATION_END`), !i.current)) {
              let r = t.style.animationFillMode;
              ((t.style.animationFillMode = `forwards`),
                (e = n.setTimeout(() => {
                  t.style.animationFillMode === `forwards` && (t.style.animationFillMode = r);
                })));
            }
          }, `handleAnimationEnd`),
          s = O((e) => {
            e.target === t && (a.current = A(r.current));
          }, `handleAnimationStart`);
        return (
          t.addEventListener(`animationstart`, s),
          t.addEventListener(`animationcancel`, o),
          t.addEventListener(`animationend`, o),
          () => {
            (n.clearTimeout(e),
              t.removeEventListener(`animationstart`, s),
              t.removeEventListener(`animationcancel`, o),
              t.removeEventListener(`animationend`, o));
          }
        );
      }
      c(`ANIMATION_END`);
    }, [t, c]),
    {
      isPresent: [`mounted`, `unmountSuspended`].includes(s),
      ref: l.useCallback((e) => {
        if (e) {
          let t = getComputedStyle(e);
          ((r.current = t), (o.current = A(t)));
        } else r.current = null;
        n(e);
      }, []),
    }
  );
}
O(pe, `usePresence`);
function me(e, t) {
  if (typeof e == `function`) return e(t);
  e != null && (e.current = t);
}
O(me, `setRef`);
function he(...e) {
  let t = l.useRef(e);
  return (
    (t.current = e),
    l.useCallback((e) => {
      let n = t.current,
        r = !1,
        i = n.map((t) => {
          let n = me(t, e);
          return (!r && typeof n == `function` && (r = !0), n);
        });
      if (r)
        return () => {
          for (let e = 0; e < i.length; e++) {
            let t = i[e];
            typeof t == `function` ? t() : me(n[e], null);
          }
        };
    }, [])
  );
}
O(he, `useStableComposedRefs`);
function A(e) {
  return e?.animationName || `none`;
}
O(A, `getAnimationName`);
function ge(e) {
  let t = Object.getOwnPropertyDescriptor(e.props, `ref`)?.get,
    n = t && `isReactWarning` in t && t.isReactWarning;
  return n
    ? e.ref
    : ((t = Object.getOwnPropertyDescriptor(e, `ref`)?.get),
      (n = t && `isReactWarning` in t && t.isReactWarning),
      n ? e.props.ref : e.props.ref || e.ref);
}
O(ge, `getElementRef`);
var _e = Object.defineProperty,
  ve = (e, t) => _e(e, `name`, { value: t, configurable: !0 }),
  ye = l.useId || (() => void 0),
  be = 0;
function j(e) {
  let [t, n] = l.useState(ye());
  return (
    w(() => {
      e || n((e) => e ?? String(be++));
    }, [e]),
    e || (t ? `radix-${t}` : ``)
  );
}
ve(j, `useId`);
var xe = Object.defineProperty,
  Se = (e, t) => xe(e, `name`, { value: t, configurable: !0 });
function M(e) {
  let t = l.useRef(e);
  return (
    l.useEffect(() => {
      t.current = e;
    }),
    l.useMemo(
      () =>
        (...e) =>
          t.current?.(...e),
      [],
    )
  );
}
Se(M, `useCallbackRef`);
var Ce = Object.defineProperty,
  N = (e, t) => Ce(e, `name`, { value: t, configurable: !0 }),
  we = `dismissableLayer.update`,
  Te = `dismissableLayer.pointerDownOutside`,
  Ee = `dismissableLayer.focusOutside`,
  De,
  Oe = l.createContext({
    layers: new Set(),
    layersWithOutsidePointerEventsDisabled: new Set(),
    branches: new Set(),
    dismissableSurfaces: new Set(),
  }),
  ke = l.forwardRef(
    N(function (e, t) {
      let {
          disableOutsidePointerEvents: n = !1,
          deferPointerDownOutside: r = !1,
          onEscapeKeyDown: i,
          onPointerDownOutside: o,
          onFocusOutside: c,
          onInteractOutside: d,
          onDismiss: f,
          ...p
        } = e,
        m = l.useContext(Oe),
        [h, g] = l.useState(null),
        _ = h?.ownerDocument ?? globalThis?.document,
        [, v] = l.useState({}),
        b = a(t, g),
        x = Array.from(m.layers),
        [S] = [...m.layersWithOutsidePointerEventsDisabled].slice(-1),
        C = S ? x.indexOf(S) : -1,
        w = h ? x.indexOf(h) : -1,
        ee = m.layersWithOutsidePointerEventsDisabled.size > 0,
        te = w >= C,
        T = l.useRef(!1),
        ne = Me(
          (e) => {
            (o?.(e), d?.(e), e.defaultPrevented || f?.());
          },
          {
            ownerDocument: _,
            deferPointerDownOutside: r,
            isDeferredPointerDownOutsideRef: T,
            dismissableSurfaces: m.dismissableSurfaces,
            shouldHandlePointerDownOutside: l.useCallback(
              (e) => {
                if (!(e instanceof Node)) return !1;
                let t = [...m.branches].some((t) => t.contains(e));
                return te && !t;
              },
              [m.branches, te],
            ),
          },
        ),
        E = Ne((e) => {
          if (r && T.current) return;
          let t = e.target;
          [...m.branches].some((e) => e.contains(t)) ||
            (c?.(e), d?.(e), e.defaultPrevented || f?.());
        }, _),
        re = h ? w === x.length - 1 : !1,
        D = M((e) => {
          e.key === `Escape` && (i?.(e), !e.defaultPrevented && f && (e.preventDefault(), f()));
        });
      return (
        l.useEffect(() => {
          if (re)
            return (
              _.addEventListener(`keydown`, D, { capture: !0 }),
              () => _.removeEventListener(`keydown`, D, { capture: !0 })
            );
        }, [_, re, D]),
        l.useEffect(() => {
          if (h)
            return (
              n &&
                (m.layersWithOutsidePointerEventsDisabled.size === 0 &&
                  ((De = _.body.style.pointerEvents), (_.body.style.pointerEvents = `none`)),
                m.layersWithOutsidePointerEventsDisabled.add(h)),
              m.layers.add(h),
              Pe(),
              () => {
                n &&
                  (m.layersWithOutsidePointerEventsDisabled.delete(h),
                  m.layersWithOutsidePointerEventsDisabled.size === 0 &&
                    (_.body.style.pointerEvents = De));
              }
            );
        }, [h, _, n, m]),
        l.useEffect(
          () => () => {
            h && (m.layers.delete(h), m.layersWithOutsidePointerEventsDisabled.delete(h), Pe());
          },
          [h, m],
        ),
        l.useEffect(() => {
          let e = N(() => v({}), `handleUpdate`);
          return (document.addEventListener(we, e), () => document.removeEventListener(we, e));
        }, []),
        (0, u.jsx)(s.div, {
          ...p,
          ref: b,
          style: { pointerEvents: ee ? (te ? `auto` : `none`) : void 0, ...e.style },
          onFocusCapture: y(e.onFocusCapture, E.onFocusCapture),
          onBlurCapture: y(e.onBlurCapture, E.onBlurCapture),
          onPointerDownCapture: y(e.onPointerDownCapture, ne.onPointerDownCapture),
        })
      );
    }, `DismissableLayer`),
  );
function Ae() {
  let e = l.useContext(Oe),
    [t, n] = l.useState(null);
  return (
    l.useEffect(() => {
      if (t)
        return (
          e.dismissableSurfaces.add(t),
          () => {
            e.dismissableSurfaces.delete(t);
          }
        );
    }, [t, e.dismissableSurfaces]),
    n
  );
}
N(Ae, `useDismissableLayerSurface`);
var je = N(() => !0, `IS_TRUE`);
function Me(e, t) {
  let {
      ownerDocument: n = globalThis?.document,
      deferPointerDownOutside: r = !1,
      isDeferredPointerDownOutsideRef: i,
      dismissableSurfaces: a,
      shouldHandlePointerDownOutside: o = je,
    } = t,
    s = M(e),
    c = l.useRef(!1),
    u = l.useRef(!1),
    d = l.useRef(new Map()),
    f = l.useRef(() => {});
  return (
    l.useEffect(() => {
      function e() {
        ((u.current = !1), (i.current = !1), d.current.clear());
      }
      N(e, `resetOutsideInteraction`);
      function t() {
        return Array.from(d.current.values()).some(Boolean);
      }
      N(t, `isOutsideInteractionIntercepted`);
      function l(e) {
        if (!u.current) return;
        let t = e.target;
        ((t instanceof Node && [...a].some((e) => e.contains(t))) || d.current.set(e.type, !0),
          e.type === `click` &&
            window.setTimeout(() => {
              u.current && f.current();
            }, 0));
      }
      N(l, `handleInteractionCapture`);
      function p(e) {
        u.current && d.current.set(e.type, !1);
      }
      N(p, `handleInteractionBubble`);
      let m = N((a) => {
          if (a.target && !c.current) {
            let l = function () {
              n.removeEventListener(`click`, f.current);
              let r = t();
              (e(), r || Fe(Te, s, p, { discrete: !0 }));
            };
            if ((N(l, `handleAndDispatchPointerDownOutsideEvent`), !o(a.target))) {
              (n.removeEventListener(`click`, f.current), e(), (c.current = !1));
              return;
            }
            let p = { originalEvent: a };
            ((u.current = !0),
              (i.current = r && a.button === 0),
              d.current.clear(),
              !r || a.button !== 0
                ? l()
                : (n.removeEventListener(`click`, f.current),
                  (f.current = l),
                  n.addEventListener(`click`, f.current, { once: !0 })));
          } else (n.removeEventListener(`click`, f.current), e());
          c.current = !1;
        }, `handlePointerDown`),
        h = [`pointerup`, `mousedown`, `mouseup`, `touchstart`, `touchend`, `click`];
      for (let e of h) (n.addEventListener(e, l, !0), n.addEventListener(e, p));
      let g = window.setTimeout(() => {
        n.addEventListener(`pointerdown`, m);
      }, 0);
      return () => {
        (window.clearTimeout(g),
          n.removeEventListener(`pointerdown`, m),
          n.removeEventListener(`click`, f.current));
        for (let e of h) (n.removeEventListener(e, l, !0), n.removeEventListener(e, p));
      };
    }, [n, s, r, i, a, o]),
    { onPointerDownCapture: N(() => (c.current = !0), `onPointerDownCapture`) }
  );
}
N(Me, `usePointerDownOutside`);
function Ne(e, t = globalThis?.document) {
  let n = M(e),
    r = l.useRef(!1);
  return (
    l.useEffect(() => {
      let e = N((e) => {
        e.target && !r.current && Fe(Ee, n, { originalEvent: e }, { discrete: !1 });
      }, `handleFocus`);
      return (t.addEventListener(`focusin`, e), () => t.removeEventListener(`focusin`, e));
    }, [t, n]),
    {
      onFocusCapture: N(() => (r.current = !0), `onFocusCapture`),
      onBlurCapture: N(() => (r.current = !1), `onBlurCapture`),
    }
  );
}
N(Ne, `useFocusOutside`);
function Pe() {
  let e = new CustomEvent(we);
  document.dispatchEvent(e);
}
N(Pe, `dispatchUpdate`);
function Fe(e, t, n, { discrete: r }) {
  let i = n.originalEvent.target,
    a = new CustomEvent(e, { bubbles: !1, cancelable: !0, detail: n });
  (t && i.addEventListener(e, t, { once: !0 }), r ? c(i, a) : i.dispatchEvent(a));
}
N(Fe, `handleAndDispatchCustomEvent`);
var Ie = Object.defineProperty,
  P = (e, t) => Ie(e, `name`, { value: t, configurable: !0 }),
  Le = `focusScope.autoFocusOnMount`,
  Re = `focusScope.autoFocusOnUnmount`,
  ze = { bubbles: !1, cancelable: !0 },
  Be = l.forwardRef(
    P(function (e, t) {
      let {
          loop: n = !1,
          trapped: r = !1,
          branches: i,
          onMountAutoFocus: o,
          onUnmountAutoFocus: c,
          ...d
        } = e,
        [f, p] = l.useState(null),
        m = M(o),
        h = M(c),
        g = l.useRef(null),
        _ = a(t, p),
        v = l.useRef(i);
      l.useEffect(() => {
        v.current = i;
      });
      let y = l.useCallback(
          (e) => (e ? (f?.contains(e) ? !0 : !!v.current?.some((t) => t.contains(e))) : !1),
          [f],
        ),
        b = l.useRef({
          paused: !1,
          pause() {
            this.paused = !0;
          },
          resume() {
            this.paused = !1;
          },
        }).current;
      (l.useEffect(() => {
        if (r) {
          let e = function (e) {
              if (b.paused || !f) return;
              let t = e.target;
              y(t) ? (g.current = t) : F(g.current, { select: !0 });
            },
            t = function (e) {
              if (b.paused || !f) return;
              let t = e.relatedTarget;
              t !== null && (y(t) || F(g.current, { select: !0 }));
            },
            n = function (e) {
              if (document.activeElement === document.body)
                for (let t of e) t.removedNodes.length > 0 && F(f);
            };
          (P(e, `handleFocusIn`),
            P(t, `handleFocusOut`),
            P(n, `handleMutations`),
            document.addEventListener(`focusin`, e),
            document.addEventListener(`focusout`, t));
          let r = new MutationObserver(n);
          return (
            f && r.observe(f, { childList: !0, subtree: !0 }),
            () => {
              (document.removeEventListener(`focusin`, e),
                document.removeEventListener(`focusout`, t),
                r.disconnect());
            }
          );
        }
      }, [r, f, b.paused, y]),
        l.useEffect(() => {
          if (f) {
            Ze.add(b);
            let e = document.activeElement;
            if (!f.contains(e)) {
              let t = new CustomEvent(Le, ze);
              (f.addEventListener(Le, m),
                f.dispatchEvent(t),
                t.defaultPrevented ||
                  (Ge(et(qe(f)), { select: !0 }), document.activeElement === e && F(f)));
            }
            return () => {
              (f.removeEventListener(Le, m),
                setTimeout(() => {
                  let t = new CustomEvent(Re, ze);
                  (f.addEventListener(Re, h),
                    f.dispatchEvent(t),
                    t.defaultPrevented || F(e ?? document.body, { select: !0 }),
                    f.removeEventListener(Re, h),
                    Ze.remove(b));
                }, 0));
            };
          }
        }, [f, m, h, b]));
      let x = l.useCallback(
        (e) => {
          if ((!n && !r) || b.paused) return;
          let t = e.key === `Tab` && !e.altKey && !e.ctrlKey && !e.metaKey,
            i = document.activeElement;
          if (t && i) {
            let t = e.currentTarget,
              [r, a] = Ke(t);
            r && a
              ? !e.shiftKey && i === a
                ? (e.preventDefault(), n && F(r, { select: !0 }))
                : e.shiftKey && i === r && (e.preventDefault(), n && F(a, { select: !0 }))
              : i === t && e.preventDefault();
          }
        },
        [n, r, b.paused],
      );
      return (0, u.jsx)(s.div, { tabIndex: -1, ...d, ref: _, onKeyDown: x });
    }, `FocusScope`),
  ),
  Ve = l.createContext(null);
function He({ registry: e, children: t }) {
  return e ? (0, u.jsx)(Ve.Provider, { value: e, children: t }) : t;
}
P(He, `FocusScopeBranchProvider`);
function Ue() {
  let [e, t] = l.useState([]);
  return {
    nodes: e,
    registry: l.useMemo(
      () => ({
        add: P((e) => t((t) => (t.includes(e) ? t : [...t, e])), `add`),
        remove: P((e) => t((t) => t.filter((t) => t !== e)), `remove`),
      }),
      [],
    ),
  };
}
P(Ue, `useFocusScopeBranchRegistry`);
function We(e) {
  let t = l.useContext(Ve);
  l.useEffect(() => {
    if (e && t) return (t.add(e), () => t.remove(e));
  }, [e, t]);
}
P(We, `useFocusScopeBranch`);
function Ge(e, { select: t = !1 } = {}) {
  let n = document.activeElement;
  for (let r of e) if ((F(r, { select: t }), document.activeElement !== n)) return;
}
P(Ge, `focusFirst`);
function Ke(e) {
  let t = qe(e);
  return [Je(t, e), Je(t.reverse(), e)];
}
P(Ke, `getTabbableEdges`);
function qe(e) {
  let t = [],
    n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
      acceptNode: P((e) => {
        let t = e.tagName === `INPUT` && e.type === `hidden`;
        return e.disabled || e.hidden || t
          ? NodeFilter.FILTER_SKIP
          : e.tabIndex >= 0
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
      }, `acceptNode`),
    });
  for (; n.nextNode();) t.push(n.currentNode);
  return t;
}
P(qe, `getTabbableCandidates`);
function Je(e, t) {
  let n = typeof t.checkVisibility == `function` && t.checkVisibility({ checkVisibilityCSS: !0 });
  for (let r of e)
    if (!(n ? !r.checkVisibility({ checkVisibilityCSS: !0 }) : Ye(r, { upTo: t }))) return r;
}
P(Je, `findVisible`);
function Ye(e, { upTo: t }) {
  if (getComputedStyle(e).visibility === `hidden`) return !0;
  for (; e;) {
    if (t !== void 0 && e === t) return !1;
    if (getComputedStyle(e).display === `none`) return !0;
    e = e.parentElement;
  }
  return !1;
}
P(Ye, `isHidden`);
function Xe(e) {
  return e instanceof HTMLInputElement && `select` in e;
}
P(Xe, `isSelectableInput`);
function F(e, { select: t = !1 } = {}) {
  if (e && e.focus) {
    let n = document.activeElement;
    (e.focus({ preventScroll: !0 }), e !== n && Xe(e) && t && e.select());
  }
}
P(F, `focus`);
var Ze = Qe();
function Qe() {
  let e = [];
  return {
    add(t) {
      let n = e[0];
      (t !== n && n?.pause(), (e = $e(e, t)), e.unshift(t));
    },
    remove(t) {
      ((e = $e(e, t)), e[0]?.resume());
    },
  };
}
P(Qe, `createFocusScopesStack`);
function $e(e, t) {
  let n = [...e],
    r = n.indexOf(t);
  return (r !== -1 && n.splice(r, 1), n);
}
P($e, `arrayRemove`);
function et(e) {
  return e.filter((e) => e.tagName !== `A`);
}
P(et, `removeLinks`);
var tt = Object.defineProperty,
  nt = l.forwardRef(
    ((e, t) => tt(e, `name`, { value: t, configurable: !0 }))(function (e, t) {
      let { container: n, ...r } = e,
        [i, a] = l.useState(!1);
      w(() => a(!0), []);
      let o = n || (i && globalThis?.document?.body);
      return o ? ue.createPortal((0, u.jsx)(s.div, { ...r, ref: t }), o) : null;
    }, `Portal`),
  ),
  rt = Object.defineProperty,
  it = (e, t) => rt(e, `name`, { value: t, configurable: !0 }),
  I = 0,
  L = null;
function at(e) {
  return (R(), e.children);
}
it(at, `FocusGuards`);
function R() {
  l.useEffect(() => {
    L ||= { start: ot(), end: ot() };
    let { start: e, end: t } = L;
    return (
      document.body.firstElementChild !== e && document.body.insertAdjacentElement(`afterbegin`, e),
      document.body.lastElementChild !== t && document.body.insertAdjacentElement(`beforeend`, t),
      I++,
      () => {
        (I === 1 && (L?.start.remove(), L?.end.remove(), (L = null)), (I = Math.max(0, I - 1)));
      }
    );
  }, []);
}
it(R, `useFocusGuards`);
function ot() {
  let e = document.createElement(`span`);
  return (
    e.setAttribute(`data-radix-focus-guard`, ``),
    (e.tabIndex = 0),
    (e.style.outline = `none`),
    (e.style.opacity = `0`),
    (e.style.position = `fixed`),
    (e.style.pointerEvents = `none`),
    e
  );
}
it(ot, `createFocusGuard`);
var z = function () {
  return (
    (z =
      Object.assign ||
      function (e) {
        for (var t, n = 1, r = arguments.length; n < r; n++)
          for (var i in ((t = arguments[n]), t))
            Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i]);
        return e;
      }),
    z.apply(this, arguments)
  );
};
function st(e, t) {
  var n = {};
  for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
  if (e != null && typeof Object.getOwnPropertySymbols == `function`)
    for (var i = 0, r = Object.getOwnPropertySymbols(e); i < r.length; i++)
      t.indexOf(r[i]) < 0 &&
        Object.prototype.propertyIsEnumerable.call(e, r[i]) &&
        (n[r[i]] = e[r[i]]);
  return n;
}
function ct(e, t, n) {
  if (n || arguments.length === 2)
    for (var r = 0, i = t.length, a; r < i; r++)
      (a || !(r in t)) && ((a ||= Array.prototype.slice.call(t, 0, r)), (a[r] = t[r]));
  return e.concat(a || Array.prototype.slice.call(t));
}
var B = `right-scroll-bar-position`,
  V = `width-before-scroll-bar`,
  lt = `with-scroll-bars-hidden`,
  ut = `--removed-body-scroll-bar-size`;
function dt(e, t) {
  return (typeof e == `function` ? e(t) : e && (e.current = t), e);
}
function ft(e, t) {
  var n = (0, l.useState)(function () {
    return {
      value: e,
      callback: t,
      facade: {
        get current() {
          return n.value;
        },
        set current(e) {
          var t = n.value;
          t !== e && ((n.value = e), n.callback(e, t));
        },
      },
    };
  })[0];
  return ((n.callback = t), n.facade);
}
var pt = typeof window < `u` ? l.useLayoutEffect : l.useEffect,
  mt = new WeakMap();
function ht(e, t) {
  var n = ft(t || null, function (t) {
    return e.forEach(function (e) {
      return dt(e, t);
    });
  });
  return (
    pt(
      function () {
        var t = mt.get(n);
        if (t) {
          var r = new Set(t),
            i = new Set(e),
            a = n.current;
          (r.forEach(function (e) {
            i.has(e) || dt(e, null);
          }),
            i.forEach(function (e) {
              r.has(e) || dt(e, a);
            }));
        }
        mt.set(n, e);
      },
      [e],
    ),
    n
  );
}
function gt(e) {
  return e;
}
function _t(e, t) {
  t === void 0 && (t = gt);
  var n = [],
    r = !1;
  return {
    read: function () {
      if (r)
        throw Error(
          "Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.",
        );
      return n.length ? n[n.length - 1] : e;
    },
    useMedium: function (e) {
      var i = t(e, r);
      return (
        n.push(i),
        function () {
          n = n.filter(function (e) {
            return e !== i;
          });
        }
      );
    },
    assignSyncMedium: function (e) {
      for (r = !0; n.length;) {
        var t = n;
        ((n = []), t.forEach(e));
      }
      n = {
        push: function (t) {
          return e(t);
        },
        filter: function () {
          return n;
        },
      };
    },
    assignMedium: function (e) {
      r = !0;
      var t = [];
      if (n.length) {
        var i = n;
        ((n = []), i.forEach(e), (t = n));
      }
      var a = function () {
          var n = t;
          ((t = []), n.forEach(e));
        },
        o = function () {
          return Promise.resolve().then(a);
        };
      (o(),
        (n = {
          push: function (e) {
            (t.push(e), o());
          },
          filter: function (e) {
            return ((t = t.filter(e)), n);
          },
        }));
    },
  };
}
function vt(e) {
  e === void 0 && (e = {});
  var t = _t(null);
  return ((t.options = z({ async: !0, ssr: !1 }, e)), t);
}
var yt = function (e) {
  var t = e.sideCar,
    n = st(e, [`sideCar`]);
  if (!t) throw Error("Sidecar: please provide `sideCar` property to import the right car");
  var r = t.read();
  if (!r) throw Error(`Sidecar medium not found`);
  return l.createElement(r, z({}, n));
};
yt.isSideCarExport = !0;
function bt(e, t) {
  return (e.useMedium(t), yt);
}
var xt = vt(),
  St = function () {},
  H = l.forwardRef(function (e, t) {
    var n = l.useRef(null),
      r = l.useState({ onScrollCapture: St, onWheelCapture: St, onTouchMoveCapture: St }),
      i = r[0],
      a = r[1],
      o = e.forwardProps,
      s = e.children,
      c = e.className,
      u = e.removeScrollBar,
      d = e.enabled,
      f = e.shards,
      p = e.sideCar,
      m = e.noRelative,
      h = e.noIsolation,
      g = e.inert,
      _ = e.allowPinchZoom,
      v = e.as,
      y = v === void 0 ? `div` : v,
      b = e.gapMode,
      x = st(e, [
        `forwardProps`,
        `children`,
        `className`,
        `removeScrollBar`,
        `enabled`,
        `shards`,
        `sideCar`,
        `noRelative`,
        `noIsolation`,
        `inert`,
        `allowPinchZoom`,
        `as`,
        `gapMode`,
      ]),
      S = p,
      C = ht([n, t]),
      w = z(z({}, x), i);
    return l.createElement(
      l.Fragment,
      null,
      d &&
        l.createElement(S, {
          sideCar: xt,
          removeScrollBar: u,
          shards: f,
          noRelative: m,
          noIsolation: h,
          inert: g,
          setCallbacks: a,
          allowPinchZoom: !!_,
          lockRef: n,
          gapMode: b,
        }),
      o
        ? l.cloneElement(l.Children.only(s), z(z({}, w), { ref: C }))
        : l.createElement(y, z({}, w, { className: c, ref: C }), s),
    );
  });
((H.defaultProps = { enabled: !0, removeScrollBar: !0, inert: !1 }),
  (H.classNames = { fullWidth: V, zeroRight: B }));
var Ct = function () {
  if (typeof __webpack_nonce__ < `u`) return __webpack_nonce__;
};
function wt() {
  if (!document) return null;
  var e = document.createElement(`style`);
  e.type = `text/css`;
  var t = Ct();
  return (t && e.setAttribute(`nonce`, t), e);
}
function Tt(e, t) {
  e.styleSheet ? (e.styleSheet.cssText = t) : e.appendChild(document.createTextNode(t));
}
function Et(e) {
  (document.head || document.getElementsByTagName(`head`)[0]).appendChild(e);
}
var Dt = function () {
    var e = 0,
      t = null;
    return {
      add: function (n) {
        (e == 0 && (t = wt()) && (Tt(t, n), Et(t)), e++);
      },
      remove: function () {
        (e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), (t = null)));
      },
    };
  },
  Ot = function () {
    var e = Dt();
    return function (t, n) {
      l.useEffect(
        function () {
          return (
            e.add(t),
            function () {
              e.remove();
            }
          );
        },
        [t && n],
      );
    };
  },
  kt = function () {
    var e = Ot();
    return function (t) {
      var n = t.styles,
        r = t.dynamic;
      return (e(n, r), null);
    };
  },
  At = { left: 0, top: 0, right: 0, gap: 0 },
  jt = function (e) {
    return parseInt(e || ``, 10) || 0;
  },
  Mt = function (e) {
    var t = window.getComputedStyle(document.body),
      n = t[e === `padding` ? `paddingLeft` : `marginLeft`],
      r = t[e === `padding` ? `paddingTop` : `marginTop`],
      i = t[e === `padding` ? `paddingRight` : `marginRight`];
    return [jt(n), jt(r), jt(i)];
  },
  Nt = function (e) {
    if ((e === void 0 && (e = `margin`), typeof window > `u`)) return At;
    var t = Mt(e),
      n = document.documentElement.clientWidth,
      r = window.innerWidth;
    return { left: t[0], top: t[1], right: t[2], gap: Math.max(0, r - n + t[2] - t[0]) };
  },
  Pt = kt(),
  U = `data-scroll-locked`,
  Ft = function (e, t, n, r) {
    var i = e.left,
      a = e.top,
      o = e.right,
      s = e.gap;
    return (
      n === void 0 && (n = `margin`),
      `
  .${lt} {
   overflow: hidden ${r};
   padding-right: ${s}px ${r};
  }
  body[${U}] {
    overflow: hidden ${r};
    overscroll-behavior: contain;
    ${[
      t && `position: relative ${r};`,
      n === `margin` &&
        `
    padding-left: ${i}px;
    padding-top: ${a}px;
    padding-right: ${o}px;
    margin-left:0;
    margin-top:0;
    margin-right: ${s}px ${r};
    `,
      n === `padding` && `padding-right: ${s}px ${r};`,
    ]
      .filter(Boolean)
      .join(``)}
  }
  
  .${B} {
    right: ${s}px ${r};
  }
  
  .${V} {
    margin-right: ${s}px ${r};
  }
  
  .${B} .${B} {
    right: 0 ${r};
  }
  
  .${V} .${V} {
    margin-right: 0 ${r};
  }
  
  body[${U}] {
    ${ut}: ${s}px;
  }
`
    );
  },
  It = function () {
    var e = parseInt(document.body.getAttribute(`data-scroll-locked`) || `0`, 10);
    return isFinite(e) ? e : 0;
  },
  Lt = function () {
    l.useEffect(function () {
      return (
        document.body.setAttribute(U, (It() + 1).toString()),
        function () {
          var e = It() - 1;
          e <= 0 ? document.body.removeAttribute(U) : document.body.setAttribute(U, e.toString());
        }
      );
    }, []);
  },
  Rt = function (e) {
    var t = e.noRelative,
      n = e.noImportant,
      r = e.gapMode,
      i = r === void 0 ? `margin` : r;
    Lt();
    var a = l.useMemo(
      function () {
        return Nt(i);
      },
      [i],
    );
    return l.createElement(Pt, { styles: Ft(a, !t, i, n ? `` : `!important`) });
  },
  zt = !1;
if (typeof window < `u`)
  try {
    var W = Object.defineProperty({}, "passive", {
      get: function () {
        return ((zt = !0), !0);
      },
    });
    (window.addEventListener(`test`, W, W), window.removeEventListener(`test`, W, W));
  } catch {
    zt = !1;
  }
var G = zt ? { passive: !1 } : !1,
  Bt = function (e) {
    return e.tagName === `TEXTAREA`;
  },
  Vt = function (e, t) {
    if (!(e instanceof Element)) return !1;
    var n = window.getComputedStyle(e);
    return n[t] !== `hidden` && !(n.overflowY === n.overflowX && !Bt(e) && n[t] === `visible`);
  },
  Ht = function (e) {
    return Vt(e, `overflowY`);
  },
  Ut = function (e) {
    return Vt(e, `overflowX`);
  },
  Wt = function (e, t) {
    var n = t.ownerDocument,
      r = t;
    do {
      if ((typeof ShadowRoot < `u` && r instanceof ShadowRoot && (r = r.host), qt(e, r))) {
        var i = Jt(e, r);
        if (i[1] > i[2]) return !0;
      }
      r = r.parentNode;
    } while (r && r !== n.body);
    return !1;
  },
  Gt = function (e) {
    return [e.scrollTop, e.scrollHeight, e.clientHeight];
  },
  Kt = function (e) {
    return [e.scrollLeft, e.scrollWidth, e.clientWidth];
  },
  qt = function (e, t) {
    return e === `v` ? Ht(t) : Ut(t);
  },
  Jt = function (e, t) {
    return e === `v` ? Gt(t) : Kt(t);
  },
  Yt = function (e, t) {
    return e === `h` && t === `rtl` ? -1 : 1;
  },
  Xt = function (e, t, n, r, i) {
    var a = Yt(e, window.getComputedStyle(t).direction),
      o = a * r,
      s = n.target,
      c = t.contains(s),
      l = !1,
      u = o > 0,
      d = 0,
      f = 0;
    do {
      if (!s) break;
      var p = Jt(e, s),
        m = p[0],
        h = p[1] - p[2] - a * m;
      (m || h) && qt(e, s) && ((d += h), (f += m));
      var g = s.parentNode;
      s = g && g.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? g.host : g;
    } while ((!c && s !== document.body) || (c && (t.contains(s) || t === s)));
    return (
      ((u && ((i && Math.abs(d) < 1) || (!i && o > d))) ||
        (!u && ((i && Math.abs(f) < 1) || (!i && -o > f)))) &&
        (l = !0),
      l
    );
  },
  K = function (e) {
    return `changedTouches` in e
      ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY]
      : [0, 0];
  },
  Zt = function (e) {
    return [e.deltaX, e.deltaY];
  },
  Qt = function (e) {
    return e && `current` in e ? e.current : e;
  },
  $t = function (e, t) {
    return e[0] === t[0] && e[1] === t[1];
  },
  en = function (e) {
    return `
  .block-interactivity-${e} {pointer-events: none;}
  .allow-interactivity-${e} {pointer-events: all;}
`;
  },
  tn = 0,
  q = [];
function nn(e) {
  var t = l.useRef([]),
    n = l.useRef([0, 0]),
    r = l.useRef(),
    i = l.useState(tn++)[0],
    a = l.useState(kt)[0],
    o = l.useRef(e);
  (l.useEffect(
    function () {
      o.current = e;
    },
    [e],
  ),
    l.useEffect(
      function () {
        if (e.inert) {
          document.body.classList.add(`block-interactivity-${i}`);
          var t = ct([e.lockRef.current], (e.shards || []).map(Qt), !0).filter(Boolean);
          return (
            t.forEach(function (e) {
              return e.classList.add(`allow-interactivity-${i}`);
            }),
            function () {
              (document.body.classList.remove(`block-interactivity-${i}`),
                t.forEach(function (e) {
                  return e.classList.remove(`allow-interactivity-${i}`);
                }));
            }
          );
        }
      },
      [e.inert, e.lockRef.current, e.shards],
    ));
  var s = l.useCallback(function (e, t) {
      if ((`touches` in e && e.touches.length === 2) || (e.type === `wheel` && e.ctrlKey))
        return !o.current.allowPinchZoom;
      var i = K(e),
        a = n.current,
        s = `deltaX` in e ? e.deltaX : a[0] - i[0],
        c = `deltaY` in e ? e.deltaY : a[1] - i[1],
        l,
        u = e.target,
        d = Math.abs(s) > Math.abs(c) ? `h` : `v`;
      if (`touches` in e && d === `h` && u.type === `range`) return !1;
      var f = window.getSelection(),
        p = f && f.anchorNode;
      if (p && (p === u || p.contains(u))) return !1;
      var m = Wt(d, u);
      if (!m) return !0;
      if ((m ? (l = d) : ((l = d === `v` ? `h` : `v`), (m = Wt(d, u))), !m)) return !1;
      if ((!r.current && `changedTouches` in e && (s || c) && (r.current = l), !l)) return !0;
      var h = r.current || l;
      return Xt(h, t, e, h === `h` ? s : c, !0);
    }, []),
    c = l.useCallback(function (e) {
      var n = e;
      if (q.length && q[q.length - 1] === a) {
        var r = `deltaY` in n ? Zt(n) : K(n),
          i = t.current.filter(function (e) {
            return (
              e.name === n.type &&
              (e.target === n.target || n.target === e.shadowParent) &&
              $t(e.delta, r)
            );
          })[0];
        if (i && i.should) {
          n.cancelable && n.preventDefault();
          return;
        }
        if (!i) {
          var c = (o.current.shards || [])
            .map(Qt)
            .filter(Boolean)
            .filter(function (e) {
              return e.contains(n.target);
            });
          (c.length > 0 ? s(n, c[0]) : !o.current.noIsolation) &&
            n.cancelable &&
            n.preventDefault();
        }
      }
    }, []),
    u = l.useCallback(function (e, n, r, i) {
      var a = { name: e, delta: n, target: r, should: i, shadowParent: rn(r) };
      (t.current.push(a),
        setTimeout(function () {
          t.current = t.current.filter(function (e) {
            return e !== a;
          });
        }, 1));
    }, []),
    d = l.useCallback(function (e) {
      ((n.current = K(e)), (r.current = void 0));
    }, []),
    f = l.useCallback(function (t) {
      u(t.type, Zt(t), t.target, s(t, e.lockRef.current));
    }, []),
    p = l.useCallback(function (t) {
      u(t.type, K(t), t.target, s(t, e.lockRef.current));
    }, []);
  l.useEffect(function () {
    return (
      q.push(a),
      e.setCallbacks({ onScrollCapture: f, onWheelCapture: f, onTouchMoveCapture: p }),
      document.addEventListener(`wheel`, c, G),
      document.addEventListener(`touchmove`, c, G),
      document.addEventListener(`touchstart`, d, G),
      function () {
        ((q = q.filter(function (e) {
          return e !== a;
        })),
          document.removeEventListener(`wheel`, c, G),
          document.removeEventListener(`touchmove`, c, G),
          document.removeEventListener(`touchstart`, d, G));
      }
    );
  }, []);
  var m = e.removeScrollBar,
    h = e.inert;
  return l.createElement(
    l.Fragment,
    null,
    h ? l.createElement(a, { styles: en(i) }) : null,
    m ? l.createElement(Rt, { noRelative: e.noRelative, gapMode: e.gapMode }) : null,
  );
}
function rn(e) {
  for (var t = null; e !== null;)
    (e instanceof ShadowRoot && ((t = e.host), (e = e.host)), (e = e.parentNode));
  return t;
}
var an = bt(xt, nn),
  on = l.forwardRef(function (e, t) {
    return l.createElement(H, z({}, e, { ref: t, sideCar: an }));
  });
on.classNames = H.classNames;
var sn = function (e) {
    return typeof document > `u` ? null : (Array.isArray(e) ? e[0] : e).ownerDocument.body;
  },
  J = new WeakMap(),
  Y = new WeakMap(),
  X = {},
  cn = 0,
  ln = function (e) {
    return e && (e.host || ln(e.parentNode));
  },
  un = function (e, t) {
    return t
      .map(function (t) {
        if (e.contains(t)) return t;
        var n = ln(t);
        return n && e.contains(n)
          ? n
          : (console.error(`aria-hidden`, t, `in not contained inside`, e, `. Doing nothing`),
            null);
      })
      .filter(function (e) {
        return !!e;
      });
  },
  dn = function (e, t, n, r) {
    var i = un(t, Array.isArray(e) ? e : [e]);
    X[n] || (X[n] = new WeakMap());
    var a = X[n],
      o = [],
      s = new Set(),
      c = new Set(i),
      l = function (e) {
        e && !s.has(e) && (s.add(e), l(e.parentNode));
      };
    i.forEach(l);
    var u = function (e) {
      e &&
        !c.has(e) &&
        Array.prototype.forEach.call(e.children, function (e) {
          if (s.has(e)) u(e);
          else
            try {
              var t = e.getAttribute(r),
                i = t !== null && t !== `false`,
                c = (J.get(e) || 0) + 1,
                l = (a.get(e) || 0) + 1;
              (J.set(e, c),
                a.set(e, l),
                o.push(e),
                c === 1 && i && Y.set(e, !0),
                l === 1 && e.setAttribute(n, `true`),
                i || e.setAttribute(r, `true`));
            } catch (t) {
              console.error(`aria-hidden: cannot operate on `, e, t);
            }
        });
    };
    return (
      u(t),
      s.clear(),
      cn++,
      function () {
        (o.forEach(function (e) {
          var t = J.get(e) - 1,
            i = a.get(e) - 1;
          (J.set(e, t),
            a.set(e, i),
            t || (Y.has(e) || e.removeAttribute(r), Y.delete(e)),
            i || e.removeAttribute(n));
        }),
          cn--,
          cn || ((J = new WeakMap()), (J = new WeakMap()), (Y = new WeakMap()), (X = {})));
      }
    );
  },
  fn = function (e, t, n) {
    n === void 0 && (n = `data-aria-hidden`);
    var r = Array.from(Array.isArray(e) ? e : [e]),
      i = t || sn(e);
    return i
      ? (r.push.apply(r, Array.from(i.querySelectorAll(`[aria-live], script`))),
        dn(r, i, n, `aria-hidden`))
      : function () {
          return null;
        };
  },
  pn = Object.defineProperty,
  Z = (e, t) => pn(e, `name`, { value: t, configurable: !0 }),
  mn = `Dialog`,
  [hn, gn] = m(mn),
  [_n, Q] = hn(mn),
  vn = Z((e) => {
    let {
        __scopeDialog: t,
        children: n,
        open: r,
        defaultOpen: i,
        onOpenChange: a,
        modal: o = !0,
      } = e,
      s = l.useRef(null),
      c = l.useRef(null),
      { nodes: d, registry: f } = Ue(),
      [p, m] = ae({ prop: r, defaultProp: i ?? !1, onChange: a, caller: mn }),
      [h, g] = l.useState(0),
      [_, v] = l.useState(0);
    return (0, u.jsx)(_n, {
      scope: t,
      triggerRef: s,
      contentRef: c,
      contentId: j(),
      titleId: j(),
      descriptionId: j(),
      titlePresent: h > 0,
      descriptionPresent: _ > 0,
      setTitleCount: g,
      setDescriptionCount: v,
      open: p,
      onOpenChange: m,
      onOpenToggle: l.useCallback(() => m((e) => !e), [m]),
      modal: o,
      branchNodes: d,
      branchRegistry: f,
      children: n,
    });
  }, `Dialog`),
  yn = `DialogPortal`,
  [bn, xn] = hn(yn, { forceMount: void 0 }),
  Sn = Z((e) => {
    let { __scopeDialog: t, forceMount: n, children: r, container: i } = e,
      a = Q(yn, t);
    return (0, u.jsx)(bn, {
      scope: t,
      forceMount: n,
      children: l.Children.map(r, (e) =>
        (0, u.jsx)(k, {
          present: n || a.open,
          children: (0, u.jsx)(nt, { asChild: !0, container: i, children: e }),
        }),
      ),
    });
  }, `DialogPortal`),
  Cn = `DialogOverlay`,
  wn = l.forwardRef(
    Z(function (e, t) {
      let n = xn(Cn, e.__scopeDialog),
        { forceMount: r = n.forceMount, ...i } = e,
        a = Q(Cn, e.__scopeDialog);
      return a.modal
        ? (0, u.jsx)(k, { present: r || a.open, children: (0, u.jsx)(En, { ...i, ref: t }) })
        : null;
    }, `DialogOverlay`),
  ),
  Tn = i(`DialogOverlay.RemoveScroll`),
  En = l.forwardRef(
    Z(function (e, t) {
      let { __scopeDialog: n, ...r } = e,
        i = Q(Cn, n),
        o = Ae(),
        c = a(t, o);
      return (0, u.jsx)(on, {
        as: Tn,
        allowPinchZoom: !0,
        shards: l.useMemo(
          () => [i.contentRef, ...i.branchNodes.map((e) => ({ current: e }))],
          [i.contentRef, i.branchNodes],
        ),
        children: (0, u.jsx)(s.div, {
          "data-state": In(i.open),
          ...r,
          ref: c,
          style: { pointerEvents: `auto`, ...r.style },
        }),
      });
    }, `DialogOverlayImpl`),
  ),
  $ = `DialogContent`,
  Dn = l.forwardRef(
    Z(function (e, t) {
      let n = xn($, e.__scopeDialog),
        { forceMount: r = n.forceMount, ...i } = e,
        a = Q($, e.__scopeDialog);
      return (0, u.jsx)(k, {
        present: r || a.open,
        children: a.modal ? (0, u.jsx)(On, { ...i, ref: t }) : (0, u.jsx)(kn, { ...i, ref: t }),
      });
    }, `DialogContent`),
  ),
  On = l.forwardRef(
    Z(function (e, t) {
      let n = Q($, e.__scopeDialog),
        r = l.useRef(null),
        i = a(t, n.contentRef, r);
      return (
        l.useEffect(() => {
          let e = r.current;
          if (e) return fn(e);
        }, []),
        (0, u.jsx)(An, {
          ...e,
          ref: i,
          trapFocus: n.open,
          disableOutsidePointerEvents: n.open,
          onCloseAutoFocus: y(e.onCloseAutoFocus, (e) => {
            (e.preventDefault(), n.triggerRef.current?.focus());
          }),
          onPointerDownOutside: y(e.onPointerDownOutside, (e) => {
            let t = e.detail.originalEvent,
              n = t.button === 0 && t.ctrlKey === !0;
            (t.button === 2 || n) && e.preventDefault();
          }),
          onFocusOutside: y(e.onFocusOutside, (e) => e.preventDefault()),
        })
      );
    }, `DialogContentModal`),
  ),
  kn = l.forwardRef(
    Z(function (e, t) {
      let n = Q($, e.__scopeDialog),
        r = l.useRef(!1),
        i = l.useRef(!1);
      return (0, u.jsx)(An, {
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
    }, `DialogContentNonModal`),
  ),
  An = l.forwardRef(
    Z(function (e, t) {
      let {
          __scopeDialog: n,
          trapFocus: r,
          onOpenAutoFocus: i,
          onCloseAutoFocus: a,
          "aria-describedby": o,
          children: s,
          ...c
        } = e,
        l = Q($, n);
      return (
        R(),
        (0, u.jsx)(He, {
          registry: l.branchRegistry,
          children: (0, u.jsx)(Be, {
            asChild: !0,
            loop: !0,
            trapped: r,
            branches: l.branchNodes,
            onMountAutoFocus: i,
            onUnmountAutoFocus: a,
            children: (0, u.jsx)(ke, {
              role: `dialog`,
              id: l.contentId,
              "aria-labelledby": l.titlePresent ? l.titleId : void 0,
              "aria-describedby": l.descriptionPresent ? Fn(o, l.descriptionId) : o,
              "data-state": In(l.open),
              ...c,
              ref: t,
              deferPointerDownOutside: !0,
              onDismiss: () => l.onOpenChange(!1),
              children: s,
            }),
          }),
        })
      );
    }, `DialogContentImpl`),
  ),
  jn = l.forwardRef(
    Z(function (e, t) {
      let { __scopeDialog: n, ...r } = e,
        i = Q(`DialogTitle`, n),
        { setTitleCount: a } = i;
      return (
        w(() => (a((e) => e + 1), () => a((e) => e - 1)), [a]),
        (0, u.jsx)(s.h2, { id: i.titleId, ...r, ref: t })
      );
    }, `DialogTitle`),
  ),
  Mn = l.forwardRef(
    Z(function (e, t) {
      let { __scopeDialog: n, ...r } = e,
        i = Q(`DialogDescription`, n),
        { setDescriptionCount: a } = i;
      return (
        w(() => (a((e) => e + 1), () => a((e) => e - 1)), [a]),
        (0, u.jsx)(s.p, { id: i.descriptionId, ...r, ref: t })
      );
    }, `DialogDescription`),
  ),
  Nn = `DialogClose`,
  Pn = l.forwardRef(
    Z(function (e, t) {
      let { __scopeDialog: n, ...r } = e,
        i = Q(Nn, n);
      return (0, u.jsx)(s.button, {
        type: `button`,
        ...r,
        ref: t,
        onClick: y(e.onClick, () => i.onOpenChange(!1)),
      });
    }, `DialogClose`),
  );
function Fn(...e) {
  let t = new Set();
  for (let n of e)
    if (typeof n == `string`) for (let e of String(n).trim().split(/\s+/)) e && t.add(e);
  return t.size > 0 ? Array.from(t).join(` `) : void 0;
}
Z(Fn, `concatAriaDescribedby`);
function In(e) {
  return e ? `open` : `closed`;
}
Z(In, `getState`);
var Ln = {
  name: `x`,
  size: 24,
  node: [
    [`path`, { d: `M18 6 6 18`, key: `1bl5f8` }],
    [`path`, { d: `m6 6 12 12`, key: `d8bk6v` }],
  ],
};
Ln.node;
var Rn = o(Ln);
export {
  y as C,
  w as S,
  ke as _,
  Mn as a,
  k as b,
  jn as c,
  R as d,
  nt as f,
  Ue as g,
  We as h,
  Dn as i,
  fn as l,
  He as m,
  vn as n,
  wn as o,
  Be as p,
  Pn as r,
  Sn as s,
  Rn as t,
  on as u,
  M as v,
  m as w,
  ae as x,
  j as y,
};
