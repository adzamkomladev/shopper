import { Bt as e, Ht as t, Wt as n, _ as r } from "./createLucideIcon-BBeoGZx-.js";
var i = r(),
  a = n(t(), 1),
  o = e(),
  s = (0, a.createContext)(null);
function c(e) {
  let t = (0, i.c)(12),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ children: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let [c] = (0, a.useState)(l),
    u;
  t[3] === c
    ? (u = t[4])
    : ((u = function (e) {
        let t = d(e);
        if (!(f(t) && p(e.target)))
          for (let n of [...c].reverse()) {
            let r = n[t];
            if (r) {
              (e.preventDefault(), r(e));
              return;
            }
          }
      }),
      (t[3] = c),
      (t[4] = u));
  let m = u,
    h;
  t[5] !== n || t[6] !== m || t[7] !== r
    ? ((h = (0, o.jsx)(`div`, {
        tabIndex: -1,
        onKeyDownCapture: m,
        className: `outline-none`,
        ...r,
        children: n,
      })),
      (t[5] = n),
      (t[6] = m),
      (t[7] = r),
      (t[8] = h))
    : (h = t[8]);
  let g;
  return (
    t[9] !== c || t[10] !== h
      ? ((g = (0, o.jsx)(s, { value: c, children: h })), (t[9] = c), (t[10] = h), (t[11] = g))
      : (g = t[11]),
    g
  );
}
function l() {
  return new Set();
}
function u(e) {
  let t = (0, a.use)(s);
  if (!t) throw Error(`useShortcuts needs a ShortcutRoot above it`);
  return (n) => {
    if (n)
      return (
        t.add(e),
        () => {
          t.delete(e);
        }
      );
  };
}
function d(e) {
  let t = e.key.length === 1,
    n = t ? e.key.toUpperCase() : e.key,
    r = e.ctrlKey || e.metaKey || e.altKey;
  return [
    ...[
      e.ctrlKey || e.metaKey ? `Mod` : ``,
      e.altKey ? `Alt` : ``,
      e.shiftKey && (!t || r) ? `Shift` : ``,
    ].filter(Boolean),
    n,
  ].join(`+`);
}
var f = (e) => e.length === 1;
function p(e) {
  return (
    e instanceof HTMLElement &&
    e.matches(
      `input, textarea, select, [contenteditable], [role="combobox"], [role="listbox"], [role="option"]`,
    )
  );
}
var m = /Mac|iPhone|iPad/.test(navigator.userAgent) ? `⌘` : `Ctrl`;
function h() {
  return (0, a.useSyncExternalStore)(v, _, g);
}
function g() {
  return !0;
}
function _() {
  return navigator.onLine;
}
function v(e) {
  return (
    addEventListener(`online`, e),
    addEventListener(`offline`, e),
    () => {
      (removeEventListener(`online`, e), removeEventListener(`offline`, e));
    }
  );
}
export { u as i, m as n, c as r, h as t };
