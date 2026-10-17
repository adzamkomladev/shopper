import {
  $ as e,
  A as t,
  Bt as n,
  E as r,
  Ht as i,
  J as a,
  L as o,
  M as s,
  N as c,
  O as l,
  Q as u,
  R as d,
  U as f,
  W as p,
  Wt as m,
  Y as h,
  _ as g,
  a as _,
  i as v,
  it as y,
  j as b,
  q as x,
  r as S,
  st as C,
  u as w,
  zt as T,
} from "./createLucideIcon-BBeoGZx-.js";
import { t as E } from "./link-BaidU34I.js";
import { t as D } from "./data-X9pOYu-7.js";
import { a as O, n as k, t as A } from "./alert-BTZapdK4.js";
import { d as j, i as ee, r as M, t as te } from "./field-BUpdDBSZ.js";
import { d as ne, u as re } from "./schemas-CMFvL3XH.js";
import { t as N } from "./circle-check-qjEDsf6Y.js";
import { t as P } from "./loader-circle-4Q5UpSxt.js";
import { t as ie } from "./upload-Cq0t42XQ.js";
import { Ft as ae, Ot as oe, Pt as se, Rt as ce, st as F } from "./index-DZbZvBMN.js";
import { i as le, n as I, t as ue } from "./online-B_7Uj1Wv.js";
var L = m(i(), 1),
  R = g(),
  z = 10485760,
  B = f([
    `text/csv`,
    `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
    `application/octet-stream`,
    `application/vnd.ms-excel`,
  ]);
(u({
  fileName: p(e(), s(1), t(255), a(/^[^/\\\x00-\x1f]+\.(csv|xlsx|xls)$/i)),
  contentType: B,
  sizeBytes: p(o(), h(), c(1), b(z)),
  sha256: p(e(), a(/^[a-f0-9]{64}$/)),
}),
  u({ assetId: S }));
var V = d({
  assetId: S,
  url: p(e(), y()),
  method: l(`PUT`),
  headers: x(e(), e()),
  expiresAt: p(o(), h()),
});
async function H(e) {
  let t = typeof e == `string` ? new TextEncoder().encode(e) : e,
    n = await crypto.subtle.digest(`SHA-256`, t);
  return Array.from(new Uint8Array(n), (e) => e.toString(16).padStart(2, `0`)).join(``);
}
function U() {
  let e = (0, R.c)(1),
    t;
  return (
    e[0] === Symbol.for(`react.memo_cache_sentinel`)
      ? ((t = { mutationFn: de }), (e[0] = t))
      : (t = e[0]),
    C(t)
  );
}
async function de(e) {
  if (!globalThis.crypto?.subtle) throw Error(`Open the portal using HTTPS to upload files.`);
  let t = new Uint8Array(await e.arrayBuffer()),
    n = await _(`/catalogue/imports/uploads`, V, {
      method: `POST`,
      body: {
        fileName: e.name,
        contentType: r(B, e.type) ? e.type : `application/octet-stream`,
        sizeBytes: e.size,
        sha256: await H(t),
      },
    }),
    i = await fetch(n.url, {
      method: n.method,
      headers: n.headers,
      body: t,
      credentials: `omit`,
    }).catch(fe);
  if (!i.ok) throw new v(i.status, `Couldn't store the file. Choose the file again and retry.`);
  return {
    ...(await _(`/catalogue/imports?dryRun=1`, re, {
      method: `POST`,
      body: { assetId: n.assetId },
    })),
    assetId: n.assetId,
  };
}
function fe() {
  throw new v(0, `Couldn't send the file. Check your connection and try again.`);
}
var W = `The import may have finished. Check Products before importing again.`;
function pe() {
  let e = (0, R.c)(2),
    t = T(),
    n;
  return (
    e[0] === t
      ? (n = e[1])
      : ((n = {
          mutationFn: he,
          onSuccess: me,
          onSettled: async () => {
            await Promise.all([
              t.invalidateQueries({ queryKey: [`products`] }),
              t.invalidateQueries({ queryKey: [`categories`] }),
            ]);
          },
        }),
        (e[0] = t),
        (e[1] = n)),
    C(n)
  );
}
function me(e) {
  return oe.success(e.rowsOk === 1 ? `1 product imported` : `${e.rowsOk} products imported`);
}
async function he(e) {
  try {
    return await _(`/catalogue/imports`, ne, { method: `POST`, body: { assetId: e } });
  } catch (e) {
    throw ge(e);
  }
}
function ge(e) {
  return e instanceof v
    ? e.status === 0
      ? new v(0, `${e.message} ${W}`, void 0, { cause: e })
      : e.status < 300
        ? new v(e.status, W, void 0, { cause: e })
        : e
    : e;
}
function G(e) {
  return e instanceof v
    ? e.status === 403
      ? `You don't have permission to import products. Ask the shop owner.`
      : e.status === 400
        ? `We couldn't read that file. Save it as .csv or .xlsx and try again. ${e.message}`
        : e.status === 413
          ? `That file is larger than 10 MB. Split it into smaller files.`
          : e.status >= 500
            ? `Something went wrong on our side. Try again in a minute.`
            : e.message
    : e.message;
}
var K = n(),
  _e = `.csv,.xlsx,.xls`,
  ve = /\.(csv|xlsx|xls)$/i,
  q = 1024,
  J = q * q;
function ye(e) {
  let t = (0, R.c)(34),
    { file: n, onChoose: r, disabled: i } = e,
    a = (0, L.useRef)(null),
    [o, s] = (0, L.useState)(!1),
    [c, l] = (0, L.useState)(),
    u;
  t[0] === r
    ? (u = t[1])
    : ((u = function (e) {
        let t = e?.[0] ?? null,
          n = t && be(t);
        (l(n || void 0), n && a.current && (a.current.value = ``), r(n ? null : t));
      }),
      (t[0] = r),
      (t[1] = u));
  let d = u,
    f;
  t[2] === i
    ? (f = t[3])
    : ((f = (e) => {
        (e.preventDefault(), i || s(!0));
      }),
      (t[2] = i),
      (t[3] = f));
  let p;
  t[4] === Symbol.for(`react.memo_cache_sentinel`) ? ((p = () => s(!1)), (t[4] = p)) : (p = t[4]);
  let m;
  t[5] !== d || t[6] !== i
    ? ((m = (e) => {
        (e.preventDefault(), s(!1));
        let { files: t } = e.dataTransfer;
        if (!i && a.current && t.length !== 0) {
          if (t.length > 1) {
            l(`Drop one file at a time.`);
            return;
          }
          ((a.current.files = t), d(a.current.files));
        }
      }),
      (t[5] = d),
      (t[6] = i),
      (t[7] = m))
    : (m = t[7]);
  let h;
  t[8] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((h = (0, K.jsx)(`span`, {
        className: `grid size-10 place-items-center rounded-lg border bg-background text-muted-foreground`,
        children: (0, K.jsx)(ie, { "aria-hidden": !0, className: `size-5` }),
      })),
      (t[8] = h))
    : (h = t[8]);
  let g;
  t[9] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((g = (0, K.jsxs)(`div`, {
        className: `flex flex-col gap-1`,
        children: [
          (0, K.jsx)(`p`, { className: `font-medium`, children: `Drop a spreadsheet here` }),
          (0, K.jsx)(`p`, {
            className: `text-sm text-muted-foreground`,
            children: `or choose one. CSV, XLSX or XLS, up to 10 MB.`,
          }),
        ],
      })),
      (t[9] = g))
    : (g = t[9]);
  let _ = !!c,
    v = !!c,
    y = c ? `spreadsheet-file spreadsheet-error` : `spreadsheet-file`,
    b;
  t[10] === d ? (b = t[11]) : ((b = (e) => d(e.target.files)), (t[10] = d), (t[11] = b));
  let x;
  t[12] !== i || t[13] !== b || t[14] !== v || t[15] !== y
    ? ((x = (0, K.jsx)(`input`, {
        ref: a,
        id: `spreadsheet`,
        type: `file`,
        accept: _e,
        disabled: i,
        "aria-invalid": v,
        "aria-describedby": y,
        onChange: b,
        className: `peer sr-only`,
      })),
      (t[12] = i),
      (t[13] = b),
      (t[14] = v),
      (t[15] = y),
      (t[16] = x))
    : (x = t[16]);
  let S;
  t[17] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((S = (0, K.jsx)(w, {
        asChild: !0,
        variant: `outline`,
        className: `peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50`,
        children: (0, K.jsx)(`label`, { htmlFor: `spreadsheet`, children: `Choose spreadsheet` }),
      })),
      (t[17] = S))
    : (S = t[17]);
  let C;
  t[18] === n
    ? (C = t[19])
    : ((C = n ? `${n.name} (${xe(n.size)})` : `No file chosen yet.`), (t[18] = n), (t[19] = C));
  let T;
  t[20] === C
    ? (T = t[21])
    : ((T = (0, K.jsx)(M, { id: `spreadsheet-file`, children: C })), (t[20] = C), (t[21] = T));
  let E;
  t[22] === c
    ? (E = t[23])
    : ((E = c && (0, K.jsx)(ee, { id: `spreadsheet-error`, children: c })),
      (t[22] = c),
      (t[23] = E));
  let D;
  t[24] !== x || t[25] !== T || t[26] !== E || t[27] !== _
    ? ((D = (0, K.jsxs)(te, {
        "data-invalid": _,
        className: `max-w-sm items-center text-center`,
        children: [x, S, T, E],
      })),
      (t[24] = x),
      (t[25] = T),
      (t[26] = E),
      (t[27] = _),
      (t[28] = D))
    : (D = t[28]);
  let O;
  return (
    t[29] !== o || t[30] !== D || t[31] !== f || t[32] !== m
      ? ((O = (0, K.jsxs)(`div`, {
          onDragOver: f,
          onDragLeave: p,
          onDrop: m,
          "data-dragging": o,
          className: `flex flex-col items-center gap-6 rounded-xl border border-dashed bg-card px-6 py-10 text-center transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-accent`,
          children: [h, g, D],
        })),
        (t[29] = o),
        (t[30] = D),
        (t[31] = f),
        (t[32] = m),
        (t[33] = O))
      : (O = t[33]),
    O
  );
}
function be(e) {
  return ve.test(e.name)
    ? e.size > 10485760
      ? `That file is larger than 10 MB. Split it into smaller files.`
      : ``
    : `Choose a .csv, .xlsx or .xls file.`;
}
function xe(e) {
  if (e < q) return `${e} B`;
  if (e < J) return `${Math.round(e / q)} KB`;
  let t = Math.round((e * 10) / J);
  return `${Math.trunc(t / 10)}.${t % 10} MB`;
}
function Se(e) {
  let t = (0, R.c)(27),
    { result: n, onImportAnother: r } = e,
    i;
  t[0] === n.created ? (i = t[1]) : ((i = [`Added`, n.created]), (t[0] = n.created), (t[1] = i));
  let a;
  t[2] === n.updated ? (a = t[3]) : ((a = [`Updated`, n.updated]), (t[2] = n.updated), (t[3] = a));
  let o;
  t[4] === n.unchanged
    ? (o = t[5])
    : ((o = [`Unchanged`, n.unchanged]), (t[4] = n.unchanged), (t[5] = o));
  let s;
  t[6] === n.pricesAdded
    ? (s = t[7])
    : ((s = [`Prices added`, n.pricesAdded]), (t[6] = n.pricesAdded), (t[7] = s));
  let c;
  t[8] !== i || t[9] !== a || t[10] !== o || t[11] !== s
    ? ((c = [i, a, o, s]), (t[8] = i), (t[9] = a), (t[10] = o), (t[11] = s), (t[12] = c))
    : (c = t[12]);
  let l = c,
    u;
  t[13] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((u = (0, K.jsx)(ce, {
        children: (0, K.jsxs)(`h2`, {
          id: `import-done-title`,
          className: `flex items-center gap-2 leading-none font-semibold`,
          children: [
            (0, K.jsx)(N, { "aria-hidden": !0, className: `size-5 text-primary` }),
            `Import finished`,
          ],
        }),
      })),
      (t[13] = u))
    : (u = t[13]);
  let d;
  t[14] === l
    ? (d = t[15])
    : ((d = (0, K.jsx)(`dl`, {
        className: `grid grid-cols-2 gap-4 sm:grid-cols-4`,
        children: l.map(Ce),
      })),
      (t[14] = l),
      (t[15] = d));
  let f;
  t[16] === n.rowsFailed
    ? (f = t[17])
    : ((f =
        n.rowsFailed > 0 &&
        (0, K.jsxs)(`p`, {
          className: `text-sm text-muted-foreground`,
          children: [
            n.rowsFailed === 1 ? `1 row` : `${n.rowsFailed} rows`,
            ` with errors`,
            ` `,
            n.rowsFailed === 1 ? `was` : `were`,
            ` skipped.`,
          ],
        })),
      (t[16] = n.rowsFailed),
      (t[17] = f));
  let p;
  t[18] === r
    ? (p = t[19])
    : ((p = (0, K.jsx)(w, {
        type: `button`,
        variant: `outline`,
        onClick: r,
        children: `Import another file`,
      })),
      (t[18] = r),
      (t[19] = p));
  let m;
  t[20] === Symbol.for(`react.memo_cache_sentinel`)
    ? ((m = (0, K.jsx)(w, {
        asChild: !0,
        children: (0, K.jsx)(E, { to: `/products`, children: `View products` }),
      })),
      (t[20] = m))
    : (m = t[20]);
  let h;
  t[21] === p
    ? (h = t[22])
    : ((h = (0, K.jsxs)(`div`, {
        className: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`,
        children: [p, m],
      })),
      (t[21] = p),
      (t[22] = h));
  let g;
  return (
    t[23] !== h || t[24] !== d || t[25] !== f
      ? ((g = (0, K.jsxs)(se, {
          ref: O,
          tabIndex: -1,
          role: `region`,
          "aria-labelledby": `import-done-title`,
          className: `outline-none`,
          children: [u, (0, K.jsxs)(ae, { className: `flex flex-col gap-6`, children: [d, f, h] })],
        })),
        (t[23] = h),
        (t[24] = d),
        (t[25] = f),
        (t[26] = g))
      : (g = t[26]),
    g
  );
}
function Ce(e) {
  let [t, n] = e;
  return (0, K.jsxs)(
    `div`,
    {
      className: `flex flex-col gap-1`,
      children: [
        (0, K.jsx)(`dt`, { className: `text-sm text-muted-foreground`, children: t }),
        (0, K.jsx)(`dd`, { className: `text-2xl font-semibold tabular-nums`, children: n }),
      ],
    },
    t,
  );
}
var Y = `import-offline-note`,
  X = (e, t, n) => `${e} ${e === 1 ? t : n}`,
  we = [
    { id: `row`, header: `Row`, cell: ({ row: e }) => e.original.row },
    {
      id: `column`,
      header: `Column`,
      meta: { className: `hidden md:table-cell` },
      cell: ({ row: e }) => e.original.column,
    },
    {
      id: `problem`,
      header: `Problem`,
      cell: ({ row: e }) =>
        (0, K.jsxs)(`div`, {
          className: `flex flex-col whitespace-normal`,
          children: [
            (0, K.jsx)(`span`, {
              className: `text-xs font-semibold md:hidden`,
              children: e.original.column,
            }),
            (0, K.jsx)(`span`, { children: e.original.message }),
            e.original.value &&
              (0, K.jsxs)(`span`, {
                className: `text-xs break-all text-muted-foreground`,
                children: [`In the file: `, e.original.value],
              }),
          ],
        }),
    },
  ];
function Te(e) {
  let t = (0, R.c)(40),
    { report: n, running: r, online: i, error: a, onRun: o, onChooseAnother: s } = e,
    c = n.rowsTotal === 0,
    l = n.rowsOk === 0,
    u;
  t[0] !== c ||
  t[1] !== l ||
  t[2] !== n.created ||
  t[3] !== n.rowsFailed ||
  t[4] !== n.rowsOk ||
  t[5] !== n.unchanged ||
  t[6] !== n.updated
    ? ((u = c
        ? (0, K.jsxs)(A, {
            children: [
              (0, K.jsx)(j, { "aria-hidden": !0 }),
              (0, K.jsx)(k, {
                children: `The file has no product rows. Add them under the header row, then choose it again.`,
              }),
            ],
          })
        : (0, K.jsxs)(`div`, {
            className: `flex flex-col gap-2`,
            children: [
              (0, K.jsxs)(`p`, {
                className: `flex items-center gap-2 font-medium`,
                children: [
                  (0, K.jsx)(N, { "aria-hidden": !0, className: `size-5 text-primary` }),
                  (0, K.jsx)(`span`, {
                    children: X(n.rowsOk, `row ready to import`, `rows ready to import`),
                  }),
                ],
              }),
              (0, K.jsxs)(`p`, {
                className: `flex items-center gap-2 font-medium`,
                children: [
                  (0, K.jsx)(j, {
                    "aria-hidden": !0,
                    className: n.rowsFailed
                      ? `size-5 text-destructive`
                      : `size-5 text-muted-foreground`,
                  }),
                  (0, K.jsx)(`span`, {
                    children: X(n.rowsFailed, `row with errors`, `rows with errors`),
                  }),
                ],
              }),
              !l &&
                (0, K.jsxs)(`p`, {
                  className: `text-sm text-muted-foreground`,
                  children: [
                    `Importing adds `,
                    X(n.created, `new product`, `new products`),
                    `, updates`,
                    ` `,
                    n.updated,
                    ` and leaves `,
                    n.unchanged,
                    ` as they are.`,
                    n.rowsFailed > 0 && ` Rows with errors are skipped.`,
                  ],
                }),
            ],
          })),
      (t[0] = c),
      (t[1] = l),
      (t[2] = n.created),
      (t[3] = n.rowsFailed),
      (t[4] = n.rowsOk),
      (t[5] = n.unchanged),
      (t[6] = n.updated),
      (t[7] = u))
    : (u = t[7]);
  let d;
  t[8] !== c || t[9] !== l
    ? ((d =
        l &&
        !c &&
        (0, K.jsxs)(A, {
          children: [
            (0, K.jsx)(j, { "aria-hidden": !0 }),
            (0, K.jsx)(k, {
              children: `No row can be imported yet. Fix the rows below in your file, then choose it again.`,
            }),
          ],
        })),
      (t[8] = c),
      (t[9] = l),
      (t[10] = d))
    : (d = t[10]);
  let f;
  t[11] === a
    ? (f = t[12])
    : ((f =
        a &&
        (0, K.jsxs)(A, {
          variant: `destructive`,
          children: [(0, K.jsx)(j, { "aria-hidden": !0 }), (0, K.jsx)(k, { children: G(a) })],
        })),
      (t[11] = a),
      (t[12] = f));
  let p;
  t[13] === i
    ? (p = t[14])
    : ((p =
        !i &&
        (0, K.jsx)(`p`, {
          id: Y,
          className: `text-sm text-muted-foreground`,
          children: `You're offline. Reconnect to import.`,
        })),
      (t[13] = i),
      (t[14] = p));
  let m = l || r || !i,
    h = i ? void 0 : Y,
    g;
  t[15] !== l || t[16] !== n.rowsOk || t[17] !== r
    ? ((g = r
        ? (0, K.jsxs)(K.Fragment, {
            children: [
              (0, K.jsx)(P, { "aria-hidden": !0, className: `animate-spin` }),
              `Importing…`,
            ],
          })
        : l
          ? `Import products`
          : (0, K.jsxs)(K.Fragment, {
              children: [
                `Import `,
                X(n.rowsOk, `product`, `products`),
                (0, K.jsxs)(F, { "aria-hidden": !0, children: [I, ` ↵`] }),
              ],
            })),
      (t[15] = l),
      (t[16] = n.rowsOk),
      (t[17] = r),
      (t[18] = g))
    : (g = t[18]);
  let _;
  t[19] !== o || t[20] !== m || t[21] !== h || t[22] !== g
    ? ((_ = (0, K.jsx)(w, {
        type: `button`,
        disabled: m,
        "aria-describedby": h,
        onClick: o,
        children: g,
      })),
      (t[19] = o),
      (t[20] = m),
      (t[21] = h),
      (t[22] = g),
      (t[23] = _))
    : (_ = t[23]);
  let v;
  t[24] !== s || t[25] !== r
    ? ((v = (0, K.jsx)(w, {
        type: `button`,
        variant: `outline`,
        disabled: r,
        onClick: s,
        children: `Choose another file`,
      })),
      (t[24] = s),
      (t[25] = r),
      (t[26] = v))
    : (v = t[26]);
  let y;
  t[27] !== _ || t[28] !== v
    ? ((y = (0, K.jsxs)(`div`, { className: `flex flex-col gap-2 sm:flex-row`, children: [_, v] })),
      (t[27] = _),
      (t[28] = v),
      (t[29] = y))
    : (y = t[29]);
  let b;
  t[30] === n.errors
    ? (b = t[31])
    : ((b =
        n.errors.length > 0 &&
        (0, K.jsxs)(`section`, {
          className: `flex flex-col gap-2`,
          children: [
            (0, K.jsx)(`h2`, {
              className: `text-lg font-semibold tracking-tight`,
              children: `Rows to fix`,
            }),
            (0, K.jsx)(D, {
              label: `Rows with errors`,
              columns: we,
              data: n.errors,
              getRowId: Z,
              className: `max-h-96`,
            }),
          ],
        })),
      (t[30] = n.errors),
      (t[31] = b));
  let x;
  return (
    t[32] !== r ||
    t[33] !== u ||
    t[34] !== y ||
    t[35] !== b ||
    t[36] !== d ||
    t[37] !== f ||
    t[38] !== p
      ? ((x = (0, K.jsxs)(`div`, {
          ref: O,
          tabIndex: -1,
          "aria-busy": r,
          className: `flex flex-col gap-6 outline-none`,
          children: [u, d, f, p, y, b],
        })),
        (t[32] = r),
        (t[33] = u),
        (t[34] = y),
        (t[35] = b),
        (t[36] = d),
        (t[37] = f),
        (t[38] = p),
        (t[39] = x))
      : (x = t[39]),
    x
  );
}
function Z(e) {
  return `${e.row}-${e.column}-${e.message}`;
}
function Ee(e) {
  let t = (0, R.c)(2),
    n;
  return (
    t[0] === e.next ? (n = t[1]) : ((n = { "Mod+Enter": e.next }), (t[0] = e.next), (t[1] = n)),
    le(n)
  );
}
var Q = `check-offline-note`,
  $ = `import-title`;
function De() {
  let e = ue(),
    [t, n] = (0, L.useState)(null),
    r = U(),
    i = pe(),
    a = r.isPending || i.isPending,
    o = r.data;
  function s(e) {
    (n(e), r.reset());
  }
  function c() {
    (s(null), i.reset(), document.getElementById($)?.focus());
  }
  function l() {
    e && !a && !i.isSuccess && t && (o ? o.rowsOk > 0 && i.mutate(o.assetId) : r.mutate(t));
  }
  let u = Ee({ next: l }),
    d = [!e && Q, !t && `spreadsheet-file spreadsheet-error`].filter(Boolean).join(` `) || void 0;
  return (0, K.jsxs)(`div`, {
    ref: u,
    className: `flex flex-col gap-6`,
    children: [
      (0, K.jsxs)(`div`, {
        className: `flex flex-col gap-2`,
        children: [
          (0, K.jsx)(`h1`, {
            id: $,
            ref: O,
            tabIndex: -1,
            className: `text-3xl font-bold tracking-tight outline-none`,
            children: `Import products`,
          }),
          (0, K.jsx)(`p`, {
            className: `max-w-prose text-sm text-muted-foreground`,
            children: `Add or update many products from a CSV or Excel file. Check it first: products change only when you import. Every file needs SKU, Name and Selling Price columns, and new products also need Tax Class.`,
          }),
        ],
      }),
      i.data
        ? (0, K.jsx)(Se, { result: i.data, onImportAnother: c })
        : o
          ? (0, K.jsx)(Te, {
              report: o,
              running: i.isPending,
              online: e,
              error: i.error,
              onRun: l,
              onChooseAnother: c,
            })
          : (0, K.jsxs)(K.Fragment, {
              children: [
                (0, K.jsx)(ye, { file: t, onChoose: s, disabled: a }),
                r.error &&
                  (0, K.jsxs)(A, {
                    variant: `destructive`,
                    children: [
                      (0, K.jsx)(j, { "aria-hidden": !0 }),
                      (0, K.jsx)(k, { children: G(r.error) }),
                    ],
                  }),
                !e &&
                  (0, K.jsx)(`p`, {
                    id: Q,
                    className: `text-sm text-muted-foreground`,
                    children: `You're offline. Reconnect to check your file.`,
                  }),
                (0, K.jsx)(`div`, {
                  children: (0, K.jsx)(w, {
                    type: `button`,
                    disabled: !t || !e || r.isPending,
                    "aria-describedby": d,
                    onClick: l,
                    children: r.isPending
                      ? (0, K.jsxs)(K.Fragment, {
                          children: [
                            (0, K.jsx)(P, { "aria-hidden": !0, className: `animate-spin` }),
                            `Checking…`,
                          ],
                        })
                      : (0, K.jsxs)(K.Fragment, {
                          children: [
                            `Check file`,
                            (0, K.jsxs)(F, { "aria-hidden": !0, children: [I, ` ↵`] }),
                          ],
                        }),
                  }),
                }),
              ],
            }),
    ],
  });
}
export { De as ImportsScreen };
