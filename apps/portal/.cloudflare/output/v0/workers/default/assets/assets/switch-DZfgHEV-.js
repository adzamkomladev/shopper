import { Bt as e, Ht as t, Wt as n, _ as r, g as i, m as a } from "./createLucideIcon-BBeoGZx-.js";
import { o } from "./alert-BTZapdK4.js";
import { C as s, w as c, x as l } from "./x-B76tEvwZ.js";
import { t as u } from "./dist-CefBHXsz.js";
var d = n(t(), 1),
  f = e(),
  p = Object.defineProperty,
  m = (e, t) => p(e, `name`, { value: t, configurable: !0 }),
  h = `Switch`,
  [g, _] = c(h),
  [v, y] = g(h);
function b(e) {
  let {
      __scopeSwitch: t,
      checked: n,
      children: r,
      defaultChecked: i,
      disabled: a,
      form: o,
      name: s,
      onCheckedChange: c,
      required: u,
      value: p = `on`,
      internal_do_not_use_render: m,
    } = e,
    [g, _] = l({ prop: n, defaultProp: i ?? !1, onChange: c, caller: h }),
    [y, b] = d.useState(null),
    [x, S] = d.useState(null),
    C = d.useRef(!1),
    [w, T] = d.useReducer((e) => e + 1, 0),
    E = {
      checked: g,
      setChecked: _,
      disabled: a,
      control: y,
      setControl: b,
      name: s,
      form: o,
      value: p,
      hasConsumerStoppedPropagationRef: C,
      userInteractionCount: w,
      onUserInteraction: T,
      required: u,
      defaultChecked: i,
      isFormControl: !y || !!o || !!y.closest(`form`),
      bubbleInput: x,
      setBubbleInput: S,
    };
  return (0, f.jsx)(v, { scope: t, ...E, children: O(m) ? m(E) : r });
}
m(b, `SwitchProvider`);
var x = `SwitchTrigger`,
  S = d.forwardRef(
    m(function ({ __scopeSwitch: e, onClick: t, ...n }, r) {
      let {
          control: i,
          form: c,
          value: l,
          disabled: u,
          checked: p,
          required: h,
          setControl: g,
          setChecked: _,
          hasConsumerStoppedPropagationRef: v,
          onUserInteraction: b,
          isFormControl: S,
          bubbleInput: C,
        } = y(x, e),
        w = a(r, g),
        T = d.useRef(p);
      return (
        d.useEffect(() => {
          let e = c ? i?.ownerDocument.getElementById(c) : i?.form;
          if (e instanceof HTMLFormElement) {
            let t = m(() => _(T.current), `reset`);
            return (e.addEventListener(`reset`, t), () => e.removeEventListener(`reset`, t));
          }
        }, [i, c, _]),
        (0, f.jsx)(o.button, {
          type: `button`,
          role: `switch`,
          "aria-checked": p,
          "aria-required": h,
          "data-state": k(p),
          "data-disabled": u ? `` : void 0,
          disabled: u,
          value: l,
          ...n,
          ref: w,
          onClick: s(t, (e) => {
            (b(),
              _((e) => !e),
              C && S && ((v.current = e.isPropagationStopped()), v.current || e.stopPropagation()));
          }),
        })
      );
    }, `SwitchTrigger`),
  ),
  C = d.forwardRef(
    m(function (e, t) {
      let {
        __scopeSwitch: n,
        name: r,
        checked: i,
        defaultChecked: a,
        required: o,
        disabled: s,
        value: c,
        onCheckedChange: l,
        form: u,
        ...d
      } = e;
      return (0, f.jsx)(b, {
        __scopeSwitch: n,
        checked: i,
        defaultChecked: a,
        disabled: s,
        required: o,
        onCheckedChange: l,
        name: r,
        form: u,
        value: c,
        internal_do_not_use_render: ({ isFormControl: e }) =>
          (0, f.jsxs)(f.Fragment, {
            children: [
              (0, f.jsx)(S, { ...d, ref: t, __scopeSwitch: n }),
              e && (0, f.jsx)(D, { __scopeSwitch: n }),
            ],
          }),
      });
    }, `Switch`),
  ),
  w = `SwitchThumb`,
  T = d.forwardRef(
    m(function (e, t) {
      let { __scopeSwitch: n, ...r } = e,
        i = y(w, n);
      return (0, f.jsx)(o.span, {
        "data-state": k(i.checked),
        "data-disabled": i.disabled ? `` : void 0,
        ...r,
        ref: t,
      });
    }, `SwitchThumb`),
  ),
  E = `SwitchBubbleInput`,
  D = d.forwardRef(
    m(function ({ __scopeSwitch: e, onClick: t, ...n }, r) {
      let {
          control: i,
          hasConsumerStoppedPropagationRef: c,
          userInteractionCount: l,
          checked: p,
          defaultChecked: m,
          required: h,
          disabled: g,
          name: _,
          value: v,
          form: b,
          bubbleInput: x,
          setBubbleInput: S,
        } = y(E, e),
        C = a(r, S),
        w = u(i),
        T = d.useRef(!1),
        D = d.useRef(p),
        O = d.useRef(l);
      d.useEffect(() => {
        let e = x;
        if (!e) return;
        let t = window.HTMLInputElement.prototype,
          n = Object.getOwnPropertyDescriptor(t, `checked`).set,
          r = l !== O.current;
        O.current = l;
        let i = D.current !== p;
        D.current = p;
        let a = !(r && c.current);
        if (i && n) {
          T.current = !r;
          let t = new Event(`click`, { bubbles: a });
          (n.call(e, p), e.dispatchEvent(t), (T.current = !1));
        }
      }, [x, p, c, l]);
      let k = d.useRef(p);
      return (0, f.jsx)(o.input, {
        type: `checkbox`,
        "aria-hidden": !0,
        defaultChecked: m ?? k.current,
        required: h,
        disabled: g,
        name: _,
        value: v,
        form: b,
        ...n,
        tabIndex: -1,
        ref: C,
        onClick: s(t, (e) => {
          T.current && e.stopPropagation();
        }),
        style: {
          ...n.style,
          ...w,
          position: `absolute`,
          pointerEvents: `none`,
          opacity: 0,
          margin: 0,
          transform: `translateX(-100%)`,
        },
      });
    }, `SwitchBubbleInput`),
  );
function O(e) {
  return typeof e == `function`;
}
m(O, `isFunction`);
function k(e) {
  return e ? `checked` : `unchecked`;
}
m(k, `getState`);
var A = r();
function j(e) {
  let t = (0, A.c)(11),
    n,
    r,
    a;
  t[0] === e
    ? ((n = t[1]), (r = t[2]), (a = t[3]))
    : (({ className: n, size: a, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r), (t[3] = a));
  let o = a === void 0 ? `default` : a,
    s;
  t[4] === n
    ? (s = t[5])
    : ((s = i(
        `peer group/switch inline-flex shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80`,
        n,
      )),
      (t[4] = n),
      (t[5] = s));
  let c;
  t[6] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((c = (0, f.jsx)(T, {
        "data-slot": `switch-thumb`,
        className: i(
          `pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground`,
        ),
      })),
      (t[6] = c))
    : (c = t[6]);
  let l;
  return (
    t[7] !== r || t[8] !== o || t[9] !== s
      ? ((l = (0, f.jsx)(C, {
          "data-slot": `switch`,
          "data-size": o,
          className: s,
          ...r,
          children: c,
        })),
        (t[7] = r),
        (t[8] = o),
        (t[9] = s),
        (t[10] = l))
      : (l = t[10]),
    l
  );
}
export { j as t };
