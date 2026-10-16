import { Bt as e, Ht as t, Wt as n, u as r } from "./createLucideIcon-BBeoGZx-.js";
import { t as i } from "./useSuspenseQuery-DGcWv8BO.js";
import { s as a } from "./select-DV5qMU7p.js";
import { t as o } from "./check-bZy7kAyE.js";
import {
  c as s,
  f as c,
  i as l,
  l as u,
  n as d,
  o as f,
  r as p,
  s as m,
  t as h,
  u as g,
} from "./popover-CyW2k5kD.js";
import { et as _, nt as v } from "./index-DZbZvBMN.js";
var y = n(t(), 1),
  b = e();
function x({ id: e, value: t, onChange: n }) {
  let { data: x } = i(_()),
    [S, C] = (0, y.useState)(!1),
    [w, T] = (0, y.useState)(``),
    E = v((e) => k(e.id)),
    D = w.trim(),
    O = x.some((e) => e.name.toLowerCase() === D.toLowerCase());
  function k(e) {
    (n(e), C(!1), T(``));
  }
  return (0, b.jsxs)(h, {
    open: S,
    onOpenChange: C,
    children: [
      (0, b.jsx)(p, {
        asChild: !0,
        children: (0, b.jsxs)(r, {
          id: e,
          variant: `outline`,
          role: `combobox`,
          "aria-expanded": S,
          className: `w-full justify-between font-normal`,
          children: [
            x.find((e) => e.id === t)?.name ?? `No category`,
            (0, b.jsx)(a, { "aria-hidden": !0, className: `opacity-50` }),
          ],
        }),
      }),
      (0, b.jsx)(d, {
        "aria-label": `Categories`,
        className: `w-(--radix-popover-trigger-width) p-0`,
        align: `start`,
        children: (0, b.jsxs)(l, {
          children: [
            (0, b.jsx)(s, { value: w, onValueChange: T, placeholder: `Find or add a category` }),
            (0, b.jsxs)(g, {
              children: [
                (0, b.jsx)(f, { children: `No category found.` }),
                (0, b.jsxs)(m, {
                  children: [
                    (0, b.jsx)(u, {
                      value: `No category`,
                      onSelect: () => k(null),
                      children: `No category`,
                    }),
                    x.map((e) =>
                      (0, b.jsxs)(
                        u,
                        {
                          value: e.name,
                          onSelect: () => k(e.id),
                          children: [
                            (0, b.jsx)(`span`, { className: `flex-1 truncate`, children: e.name }),
                            e.id === t && (0, b.jsx)(o, { "aria-hidden": !0 }),
                          ],
                        },
                        e.id,
                      ),
                    ),
                  ],
                }),
                D &&
                  !O &&
                  (0, b.jsx)(m, {
                    children: (0, b.jsxs)(u, {
                      forceMount: !0,
                      value: `create ${D}`,
                      disabled: E.isPending,
                      onSelect: () => E.mutate(D),
                      children: [(0, b.jsx)(c, { "aria-hidden": !0 }), `Create "`, D, `"`],
                    }),
                  }),
              ],
            }),
          ],
        }),
      }),
    ],
  });
}
var S = [
    { value: `each`, label: `Each` },
    { value: `kg`, label: `Kilogram (kg)` },
    { value: `g`, label: `Gram (g)` },
    { value: `l`, label: `Litre (l)` },
    { value: `ml`, label: `Millilitre (ml)` },
  ],
  C = [
    { value: `standard`, label: `Standard` },
    { value: `zero-rated`, label: `Zero-rated` },
    { value: `exempt`, label: `Exempt` },
  ];
export { S as n, x as r, C as t };
