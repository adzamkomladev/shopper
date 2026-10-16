import {
  Bt as e,
  Ht as t,
  Vt as n,
  Wt as r,
  _ as i,
  g as a,
  v as o,
} from "./createLucideIcon-BBeoGZx-.js";
import { Kt as s, qt as c } from "./index-DZbZvBMN.js";
function l(e, t) {
  if (Object.is(e, t)) return !0;
  if (typeof e != `object` || !e || typeof t != `object` || !t) return !1;
  if (e instanceof Map && t instanceof Map) {
    if (e.size !== t.size) return !1;
    for (let [n, r] of e) if (!t.has(n) || !Object.is(r, t.get(n))) return !1;
    return !0;
  }
  if (e instanceof Set && t instanceof Set) {
    if (e.size !== t.size) return !1;
    for (let n of e) if (!t.has(n)) return !1;
    return !0;
  }
  if (e instanceof Date && t instanceof Date) return e.getTime() === t.getTime();
  let n = u(e);
  if (n.length !== u(t).length) return !1;
  for (let r = 0; r < n.length; r++)
    if (!Object.prototype.hasOwnProperty.call(t, n[r]) || !Object.is(e[n[r]], t[n[r]])) return !1;
  return !0;
}
function u(e) {
  return Object.keys(e).concat(Object.getOwnPropertySymbols(e));
}
var d = r(t(), 1);
function f(e) {
  return p(e) || typeof e == `function` || m(e);
}
function p(e) {
  return (
    typeof e == `function` &&
    (() => {
      let t = Object.getPrototypeOf(e);
      return t.prototype && t.prototype.isReactComponent;
    })()
  );
}
function m(e) {
  return (
    typeof e == `object` &&
    typeof e.$$typeof == `symbol` &&
    [`react.memo`, `react.forward_ref`].includes(e.$$typeof.description)
  );
}
function h(e, t) {
  return e == null ? null : f(e) ? d.createElement(e, t) : e;
}
function g(e) {
  if (`cell` in e && e.cell) {
    let t = e.cell,
      n = t.column.columnDef,
      r = t,
      i = n;
    return r.getIsAggregated?.()
      ? h(i.aggregatedCell ?? n.cell, t.getContext())
      : r.getIsPlaceholder?.()
        ? null
        : h(n.cell, t.getContext());
  }
  return `header` in e && e.header
    ? h(e.header.column.columnDef.header, e.header.getContext())
    : `footer` in e && e.footer
      ? h(e.footer.column.columnDef.footer, e.footer.getContext())
      : null;
}
function _(e) {
  let t = o(e.source, e.selector, { compare: l });
  return typeof e.children == `function` ? e.children(t) : e.children;
}
function v(e) {
  let t = e;
  return (
    Object.defineProperty(e, "state", {
      get() {
        return e.get();
      },
    }),
    `set` in e && (t.setState = e.set.bind(e)),
    t
  );
}
function y(e) {
  let { createAtom: t, batch: n } = e,
    r = t(0);
  return {
    createOptionsStore: !1,
    wrapExternalAtoms: !1,
    addSubscription: () => {
      throw Error(`Feature not supported in current reactivity implementation`);
    },
    unmount: () => {
      throw Error(`Feature not supported in current reactivity implementation`);
    },
    schedule: e.schedule ?? ((e) => queueMicrotask(e)),
    batch: n,
    untrack: (e) => e(),
    createReadonlyAtom: (e, n) => {
      let i = n?.compare ?? Object.is,
        a = !1,
        o,
        s = () => {
          let t = e();
          return ((!a || !i(o, t)) && ((o = t), (a = !0)), o);
        },
        c = t(() => (r.get(), s()), { compare: i });
      return { get: s, subscribe: c.subscribe.bind(c) };
    },
    createWritableAtom: (e, n) => t(e, { compare: n?.compare }),
    commit: () => {
      r.set((e) => e + 1);
    },
  };
}
function b(e, t = Object.is) {
  let n = !1,
    r;
  return {
    get: e.get,
    markCommitted: (e) => {
      ((r = e), (n = !0));
    },
    subscribe: (i) =>
      e.subscribe((e) => {
        (!n || !t(r, e)) && i(e);
      }),
  };
}
function x() {
  return y({ createAtom: c, batch: s });
}
function S(e, t) {
  return typeof e == `function` ? e(t) : e;
}
function C(e) {
  if (Array.isArray(e)) return e.map(C);
  if (e && typeof e == `object`) {
    let t = Object.getPrototypeOf(e);
    if (t !== Object.prototype && t !== null) return e;
    let n = t === null ? w() : {},
      r = Object.keys(e);
    for (let t = 0; t < r.length; t++) {
      let i = r[t];
      Object.defineProperty(n, i, {
        configurable: !0,
        enumerable: !0,
        value: C(e[i]),
        writable: !0,
      });
    }
    return n;
  }
  return e;
}
function w() {
  return Object.create(null);
}
function T(e, t) {
  return Object.prototype.hasOwnProperty.call(e, t);
}
function ee(e, t) {
  let n = [],
    r = (e) => {
      e.forEach((e) => {
        n.push(e);
        let i = t(e);
        i.length && r(i);
      });
    };
  return (r(e), n);
}
var te = ({
  fn: e,
  memoDeps: t,
  onAfterCompare: n,
  onAfterUpdate: r,
  onBeforeCompare: i,
  onBeforeUpdate: a,
}) => {
  let o = [],
    s;
  return (c) => {
    i?.();
    let l = t?.(c),
      u = !l || l.length !== o?.length;
    if (!u && l) {
      for (let e = 0; e < l.length; e++)
        if (l[e] !== o[e]) {
          u = !0;
          break;
        }
    }
    return (n?.(u), u ? ((o = l), a?.(), (s = e(...(l ?? []))), r?.(s), s) : s);
  };
};
function ne(e) {
  let t = !1;
  return () => {
    if (!t) {
      t = !0;
      return;
    }
    e();
  };
}
function E({ feature: e, fnName: t, objectId: n, onAfterUpdate: r, table: i, ...a }) {
  let o = () => {
      if (!r) return;
      let { schedule: e, untrack: t } = i._reactivity;
      e(() => t(() => r()));
    },
    s = {
      onAfterUpdate: () => {
        o();
      },
    };
  return te({ ...a, ...s });
}
function re(e, t = `_`) {
  let [n, r] = e.split(t);
  return { fnKey: r, fnName: `${n}.${r}`, parentName: n };
}
function D(e, t, n) {
  for (let [r, { fn: i, memoDeps: a }] of Object.entries(n)) {
    let { fnKey: n, fnName: o } = re(r);
    t[n] = a ? E({ memoDeps: a, fn: i, fnName: o, table: t, feature: e }) : i;
  }
}
function O(e, t, n, r) {
  for (let [i, { fn: a, memoDeps: o }] of Object.entries(r)) {
    let { fnKey: r, fnName: s } = re(i);
    if (o) {
      let i = `_memo_${r}`;
      t[r] = function (...t) {
        if (!this[i]) {
          let t = this;
          this[i] = E({
            memoDeps: (e) => o(t, e),
            fn: (...e) => a(t, ...e),
            fnName: s,
            objectId: t.id,
            table: n,
            feature: e,
          });
        }
        return this[i](...t);
      };
    } else
      t[r] = function (...e) {
        return a(this, ...e);
      };
  }
}
function k(e, t, n, ...r) {
  return e[t]?.(...r) ?? n(e, ...r);
}
function ie(e) {
  return e.row.getValue(e.column.id);
}
function ae(e) {
  return e.getValue() ?? e.table.options.renderFallbackValue;
}
function oe(e) {
  return {
    table: e.table,
    column: e.column,
    row: e.row,
    cell: e,
    getValue: () => e.getValue(),
    renderValue: () => e.renderValue(),
  };
}
var se = {
  assignCellPrototype: (e, t) => {
    O(`coreCellsFeature`, e, t, {
      cell_getValue: { fn: (e) => ie(e) },
      cell_renderValue: { fn: (e) => ae(e) },
      cell_getContext: { fn: (e) => oe(e), memoDeps: (e) => [e] },
    });
  },
};
function ce(e) {
  if (!e._headerPrototype) {
    e._headerPrototype = { table: e };
    let t = Object.values(e._features);
    for (let n = 0; n < t.length; n++) t[n].assignHeaderPrototype?.(e._headerPrototype, e);
  }
  return e._headerPrototype;
}
function A(e, t, n) {
  let r = ce(e),
    i = Object.create(r);
  ((i.colSpan = 0),
    (i.column = t),
    (i.depth = n.depth),
    (i.headerGroup = null),
    (i.id = n.id ?? t.id),
    (i.index = n.index),
    (i.isPlaceholder = !!n.isPlaceholder),
    (i.placeholderId = n.placeholderId),
    (i.rowSpan = 0),
    (i.subHeaders = []));
  let a = e._headerInstanceInitFns;
  for (let e = 0; e < a.length; e++) a[e](i);
  return i;
}
function j(e) {
  return e.getIsVisible?.() ?? !0;
}
function le(e) {
  return e.getVisibleLeafColumns?.() ?? e.getAllLeafColumns();
}
function ue(e) {
  e.autoResetExpanded?.();
}
function de(e) {
  e.autoResetPageIndex?.();
}
function fe(e) {
  e.autoResetSorting?.();
}
function pe(e) {
  e.autoResetCellSelection?.();
}
function M(e, t = 1) {
  let n = t;
  for (let r = 0; r < e.length; r++) {
    let i = e[r];
    j(i) && i.columns.length && (n = Math.max(n, M(i.columns, t + 1)));
  }
  return n;
}
function me(e, t) {
  return e ? `${e}_${t}` : String(t);
}
function he(e, t, n, r) {
  let i = e ?? ``;
  return (
    t && (i = i ? `${i}_${t}` : String(t)),
    n && (i = i ? `${i}_${n}` : n),
    r && (i = i ? `${i}_${r}` : r),
    i
  );
}
function ge(e, t) {
  let n = 0;
  for (let r = 0; r < e.length; r++) e[r].column === t && n++;
  return n;
}
function N(e, t, n, r, i, a) {
  let o = { depth: t, id: me(r, t), headers: [] },
    s = [];
  for (let i = 0; i < e.length; i++) {
    if (!(i in e)) continue;
    let a = e[i],
      c = s[s.length - 1],
      l = a.column.depth === o.depth,
      u,
      d = !1;
    if (
      (l && a.column.parent ? (u = a.column.parent) : ((u = a.column), (d = !0)),
      c && c.column === u)
    )
      c.subHeaders.push(a);
    else {
      let e = A(n, u, {
        id: he(r, t, u.id, a.id),
        isPlaceholder: d,
        placeholderId: d ? String(ge(s, u)) : void 0,
        depth: t,
        index: s.length,
      });
      (e.subHeaders.push(a), s.push(e));
    }
    (o.headers.push(a), (a.headerGroup = o));
  }
  for (let e = 0; e < a.length; e++) a[e](o);
  (i.push(o), t > 0 && N(s, t - 1, n, r, i, a));
}
function P(e) {
  for (let t = 0; t < e.length; t++) {
    let n = e[t];
    if (!j(n.column)) continue;
    let r = 0;
    if (n.subHeaders.length) {
      P(n.subHeaders);
      for (let e = 0; e < n.subHeaders.length; e++) {
        let t = n.subHeaders[e];
        j(t.column) && (r += t.colSpan);
      }
    } else r = 1;
    if (
      ((n.colSpan = r),
      n.isPlaceholder && n.subHeaders.length === 1 && n.subHeaders[0].column === n.column)
    ) {
      let e = 1,
        t = n.subHeaders[0];
      for (; t;)
        ((t.rowSpan = 0),
          e++,
          (t =
            t.subHeaders.length === 1 && t.subHeaders[0].column === n.column
              ? t.subHeaders[0]
              : void 0));
      n.rowSpan = e;
    } else n.rowSpan = 1;
  }
}
function F(e, t, n, r) {
  let i = M(e),
    a = [],
    o = n._headerGroupInstanceInitFns,
    s = Array(t.length);
  for (let e = 0; e < t.length; e++) e in t && (s[e] = A(n, t[e], { depth: i, index: e }));
  return (N(s, i - 1, n, r, a, o), a.reverse(), P(a[0]?.headers ?? []), a);
}
function _e(e) {
  if (!e._columnPrototype) {
    e._columnPrototype = { table: e };
    let t = Object.values(e._features);
    for (let n = 0; n < t.length; n++) t[n].assignColumnPrototype?.(e._columnPrototype, e);
  }
  return e._columnPrototype;
}
function ve(e, t, n, r) {
  let i = { ...e.getDefaultColumnDef(), ...t },
    a = i.accessorKey,
    o = a === void 0 ? void 0 : String(a),
    s = i.id ?? o?.replaceAll(`.`, `_`) ?? (typeof i.header == `string` ? i.header : void 0),
    c;
  if (i.accessorFn) c = i.accessorFn;
  else if (a !== void 0) {
    if (typeof a == `string` && a.includes(`.`)) {
      let e = a.split(`.`);
      c = (t) => {
        let n = t;
        for (let t = 0; t < e.length; t++) {
          let r = e[t];
          n = n?.[r];
        }
        return n;
      };
    } else c = (e) => e[i.accessorKey];
  }
  if (!s) throw Error();
  let l = _e(e),
    u = Object.create(l);
  ((u.accessorFn = c),
    (u.columnDef = i),
    (u.columns = []),
    (u.depth = n),
    (u.id = `${String(s)}`),
    (u.parent = r));
  let d = e._columnInstanceInitFns;
  for (let e = 0; e < d.length; e++) d[e](u);
  return u;
}
function I(e) {
  let t = e.atoms.columnOrder?.get();
  return (n) => {
    let r = [];
    if (!t?.length) r = n;
    else {
      let e = new Map();
      for (let t = 0; t < n.length; t++) {
        let r = n[t];
        e.set(r.id, r);
      }
      for (let n = 0; n < t.length; n++) {
        let i = t[n],
          a = e.get(i);
        a && (r.push(a), e.delete(i));
      }
      for (let t = 0; t < n.length; t++) {
        let i = n[t];
        e.has(i.id) && r.push(i);
      }
    }
    return ye(e, r);
  };
}
function ye(e, t) {
  let n = e.atoms.grouping?.get() ?? [],
    { groupedColumnMode: r } = e.options;
  if (!n.length || !r) return t;
  let i = t.filter((e) => !n.includes(e.id));
  if (r === `remove`) return i;
  let a = new Map();
  for (let e = 0; e < t.length; e++) {
    let n = t[e];
    a.set(n.id, n);
  }
  let o = [];
  for (let e = 0; e < n.length; e++) {
    let t = a.get(n[e]);
    t && o.push(t);
  }
  return [...o, ...i];
}
function be(e) {
  return [e, ...e.columns.flatMap((e) => e.getFlatColumns())];
}
function xe(e) {
  if (e.columns.length) {
    let t = e.columns.flatMap((e) => e.getLeafColumns());
    return k(e.table, `getOrderColumnsFn`, I)(t);
  }
  return [e];
}
function Se(e) {
  return {
    header: (e) => {
      let t = e.header.column.columnDef;
      return t.accessorKey ? t.accessorKey : t.accessorFn ? t.id : null;
    },
    cell: (e) => e.renderValue()?.toString?.() ?? null,
    ...Object.values(e._features).reduce((e, t) => Object.assign(e, t.getDefaultColumnDef?.()), {}),
    ...e.options.defaultColumn,
  };
}
function L(e, t, n, r = 0) {
  let i = Array(t.length);
  for (let a = 0; a < t.length; a++) {
    if (!(a in t)) continue;
    let o = t[a],
      s = ve(e, o, r, n),
      c = o;
    ((s.columns = c.columns ? L(e, c.columns, s, r + 1) : []), (i[a] = s));
  }
  return i;
}
function Ce(e) {
  return L(e, e.options.columns);
}
function we(e) {
  return e.getAllColumns().flatMap((e) => e.getFlatColumns());
}
function Te(e) {
  let t = w(),
    n = e.getAllFlatColumns();
  for (let e = 0; e < n.length; e++) {
    let r = n[e];
    t[r.id] = r;
  }
  return t;
}
function Ee(e) {
  let t = e.getAllColumns().flatMap((e) => e.getLeafColumns());
  return k(e, `getOrderColumnsFn`, I)(t);
}
function De(e) {
  let t = w(),
    n = e.getAllLeafColumns();
  for (let e = 0; e < n.length; e++) {
    let r = n[e];
    t[r.id] = r;
  }
  return t;
}
function Oe(e, t) {
  return e.getAllFlatColumnsById()[t];
}
var ke = {
  assignColumnPrototype: (e, t) => {
    O(`coreColumnsFeature`, e, t, {
      column_getFlatColumns: { fn: (e) => be(e), memoDeps: (e) => [e.table.options.columns] },
      column_getLeafColumns: {
        fn: (e) => xe(e),
        memoDeps: (e) => [
          e.table.atoms.columnOrder?.get(),
          e.table.atoms.grouping?.get(),
          e.table.options.columns,
          e.table.options.groupedColumnMode,
        ],
      },
    });
  },
  constructTableAPIs: (e) => {
    D(`coreColumnsFeature`, e, {
      table_getDefaultColumnDef: { fn: () => Se(e), memoDeps: () => [e.options.defaultColumn] },
      table_getAllColumns: { fn: () => Ce(e), memoDeps: () => [e.options.columns] },
      table_getAllFlatColumns: { fn: () => we(e), memoDeps: () => [e.options.columns] },
      table_getAllFlatColumnsById: { fn: () => Te(e), memoDeps: () => [e.options.columns] },
      table_getAllLeafColumns: {
        fn: () => Ee(e),
        memoDeps: () => [
          e.atoms.columnOrder?.get(),
          e.atoms.grouping?.get(),
          e.options.columns,
          e.options.groupedColumnMode,
        ],
      },
      table_getAllLeafColumnsById: { fn: () => De(e), memoDeps: () => [e.getAllLeafColumns()] },
      table_getColumn: { fn: (t) => Oe(e, t) },
    });
  },
};
function R(e, t) {
  for (let n = 0; n < e.subHeaders.length; n++) R(e.subHeaders[n], t);
  t.push(e);
}
function Ae(e) {
  let t = [];
  return (R(e, t), t);
}
function je(e) {
  return { column: e.column, header: e, table: e.column.table };
}
function Me(e) {
  let t = e.atoms.columnPinning?.get(),
    n = t?.start ?? [],
    r = t?.end ?? [],
    i = e.getAllColumns(),
    a = le(e);
  if (!n.length && !r.length) return F(i, a, e);
  let o = e.getAllLeafColumnsById(),
    s = [];
  for (let e = 0; e < n.length; e++) {
    let t = o[n[e]];
    t && j(t) && s.push(t);
  }
  let c = [];
  for (let e = 0; e < r.length; e++) {
    let t = o[r[e]];
    t && j(t) && c.push(t);
  }
  let l = a.filter((e) => !n.includes(e.id) && !r.includes(e.id));
  return F(i, [...s, ...l, ...c], e);
}
function Ne(e) {
  return [...e.getHeaderGroups()].reverse();
}
function Pe(e) {
  let t = e.getHeaderGroups(),
    n = [];
  for (let e = 0; e < t.length; e++) {
    let r = t[e].headers;
    for (let e = 0; e < r.length; e++) n.push(r[e]);
  }
  return n;
}
function Fe(e) {
  let t = e.getHeaderGroups()[0]?.headers ?? [],
    n = [];
  for (let e = 0; e < t.length; e++) {
    let r = t[e].getLeafHeaders();
    for (let e = 0; e < r.length; e++) n.push(r[e]);
  }
  return n;
}
var Ie = {
  assignHeaderPrototype: (e, t) => {
    O(`coreHeadersFeature`, e, t, {
      header_getLeafHeaders: {
        fn: (e) => Ae(e),
        memoDeps: (e) => [e.column.table.options.columns],
      },
      header_getContext: { fn: (e) => je(e), memoDeps: (e) => [e.column.table.options.columns] },
    });
  },
  constructTableAPIs: (e) => {
    D(`coreHeadersFeature`, e, {
      table_getHeaderGroups: {
        fn: () => Me(e),
        memoDeps: () => [
          e.options.columns,
          e.atoms.columnOrder?.get(),
          e.atoms.grouping?.get(),
          e.atoms.columnPinning?.get(),
          e.atoms.columnVisibility?.get(),
          e.options.groupedColumnMode,
        ],
      },
      table_getFooterGroups: { fn: () => Ne(e), memoDeps: () => [e.getHeaderGroups()] },
      table_getFlatHeaders: { fn: () => Pe(e), memoDeps: () => [e.getHeaderGroups()] },
      table_getLeafHeaders: { fn: () => Fe(e), memoDeps: () => [e.getHeaderGroups()] },
    });
  },
};
function Le(e) {
  if (!e._rowPrototype) {
    e._rowPrototype = { table: e };
    let t = Object.values(e._features);
    for (let n = 0; n < t.length; n++) t[n].assignRowPrototype?.(e._rowPrototype, e);
  }
  return e._rowPrototype;
}
var Re = (e, t, n, r, i, a, o) => {
  let s = Le(e),
    c = Object.create(s);
  ((c._displayIndexCache = -1),
    (c._uniqueValuesCache = w()),
    (c._valuesCache = w()),
    (c.depth = i),
    (c.id = t),
    (c.index = r),
    (c.original = n),
    (c.parentId = o),
    (c.subRows = a ?? []));
  let l = e._rowInstanceInitFns;
  for (let e = 0; e < l.length; e++) l[e](c);
  return c;
};
function ze() {
  return (e) =>
    E({
      feature: `coreRowModelsFeature`,
      table: e,
      fnName: `table.getCoreRowModel`,
      memoDeps: () => [e.options.data],
      fn: () => Be(e, e.options.data),
      onAfterUpdate: ne(() => {
        (ue(e), de(e), fe(e), pe(e));
      }),
    });
}
function z(e, t, n, r = 0, i) {
  let a = [];
  for (let o = 0; o < n.length; o++) {
    let s = n[o],
      c = Re(e, e.getRowId(s, o, i), s, o, r, void 0, i?.id);
    (t.flatRows.push(c),
      (t.rowsById[c.id] = c),
      a.push(c),
      e.options.getSubRows &&
        ((c.originalSubRows = e.options.getSubRows(s, o)),
        c.originalSubRows?.length && (c.subRows = z(e, t, c.originalSubRows, r + 1, c))));
  }
  return a;
}
function Be(e, t) {
  let n = { rows: [], flatRows: [], rowsById: w() };
  return ((n.rows = z(e, n, t)), n);
}
function Ve(e) {
  return (
    e._rowModels.coreRowModel ||
      (e._rowModels.coreRowModel = e.options.features.coreRowModel?.(e) ?? ze()(e)),
    e._rowModels.coreRowModel()
  );
}
function He(e) {
  return e.getCoreRowModel();
}
function Ue(e) {
  return (
    e._rowModels.filteredRowModel ||
      (e._rowModels.filteredRowModel = e.options.features.filteredRowModel?.(e)),
    e.options.manualFiltering || !e._rowModels.filteredRowModel
      ? e.getPreFilteredRowModel()
      : e._rowModels.filteredRowModel()
  );
}
function We(e) {
  return e.getFilteredRowModel();
}
function Ge(e) {
  return (
    e._rowModels.groupedRowModel ||
      (e._rowModels.groupedRowModel = e.options.features.groupedRowModel?.(e)),
    e.options.manualGrouping || !e._rowModels.groupedRowModel
      ? e.getPreGroupedRowModel()
      : e._rowModels.groupedRowModel()
  );
}
function Ke(e) {
  return e.getGroupedRowModel();
}
function qe(e) {
  return (
    e._rowModels.sortedRowModel ||
      (e._rowModels.sortedRowModel = e.options.features.sortedRowModel?.(e)),
    e.options.manualSorting || !e._rowModels.sortedRowModel
      ? e.getPreSortedRowModel()
      : e._rowModels.sortedRowModel()
  );
}
function Je(e) {
  return e.getSortedRowModel();
}
function Ye(e) {
  return (
    e._rowModels.expandedRowModel ||
      (e._rowModels.expandedRowModel = e.options.features.expandedRowModel?.(e)),
    e.options.manualExpanding || !e._rowModels.expandedRowModel
      ? e.getPreExpandedRowModel()
      : e._rowModels.expandedRowModel()
  );
}
function Xe(e) {
  return e.getExpandedRowModel();
}
function Ze(e) {
  return (
    e._rowModels.paginatedRowModel ||
      (e._rowModels.paginatedRowModel = e.options.features.paginatedRowModel?.(e)),
    e.options.manualPagination || !e._rowModels.paginatedRowModel
      ? e.getPrePaginatedRowModel()
      : e._rowModels.paginatedRowModel()
  );
}
function Qe(e) {
  return e.getPaginatedRowModel();
}
var $e = {
  constructTableAPIs: (e) => {
    D(`coreRowModelsFeature`, e, {
      table_getCoreRowModel: { fn: () => Ve(e) },
      table_getPreFilteredRowModel: { fn: () => He(e) },
      table_getFilteredRowModel: { fn: () => Ue(e) },
      table_getPreGroupedRowModel: { fn: () => We(e) },
      table_getGroupedRowModel: { fn: () => Ge(e) },
      table_getPreSortedRowModel: { fn: () => Ke(e) },
      table_getSortedRowModel: { fn: () => qe(e) },
      table_getPreExpandedRowModel: { fn: () => Je(e) },
      table_getExpandedRowModel: { fn: () => Ye(e) },
      table_getPrePaginatedRowModel: { fn: () => Xe(e) },
      table_getPaginatedRowModel: { fn: () => Ze(e) },
      table_getRowModel: { fn: () => Qe(e) },
    });
  },
};
function et(e) {
  if (!e._cellPrototype) {
    e._cellPrototype = { table: e };
    let t = Object.values(e._features);
    for (let n = 0; n < t.length; n++) t[n].assignCellPrototype?.(e._cellPrototype, e);
  }
  return e._cellPrototype;
}
function tt(e, t, n) {
  let r = et(n),
    i = Object.create(r);
  ((i.column = e), (i.id = `${t.id}_${e.id}`), (i.row = t));
  let a = n._cellInstanceInitFns;
  for (let e = 0; e < a.length; e++) a[e](i);
  return i;
}
function nt(e) {
  let t = e.table.getRowsInDisplayOrder(),
    n = e._displayIndexCache;
  return t[n] === e ? n : -1;
}
function rt(e) {
  let t = e.getPrePaginatedRowModel().rows;
  if (e.options.paginateExpandedRows === !1) {
    let e = [],
      n = (t) => {
        ((t._displayIndexCache = e.length),
          e.push(t),
          t.subRows.length && t.getIsExpanded?.() && t.subRows.forEach(n));
      };
    return (t.forEach(n), e);
  }
  for (let e = 0; e < t.length; e++) t[e]._displayIndexCache = e;
  return t;
}
function it(e, t) {
  if (T(e._valuesCache, t)) return e._valuesCache[t];
  let n = e.table.getColumn(t);
  if (n?.accessorFn)
    return ((e._valuesCache[t] = n.accessorFn(e.original, e.index)), e._valuesCache[t]);
}
function at(e, t) {
  if (T(e._uniqueValuesCache, t)) return e._uniqueValuesCache[t];
  let n = e.table.getColumn(t);
  if (n?.accessorFn)
    return n.columnDef.getUniqueValues
      ? ((e._uniqueValuesCache[t] = n.columnDef.getUniqueValues(e.original, e.index)),
        e._uniqueValuesCache[t])
      : ((e._uniqueValuesCache[t] = [e.getValue(t)]), e._uniqueValuesCache[t]);
}
function ot(e, t) {
  return e.getValue(t) ?? e.table.options.renderFallbackValue;
}
function st(e) {
  return ee(e.subRows, (e) => e.subRows);
}
function ct(e) {
  let t = e.getCoreRowModel().flatRows,
    n = 0;
  for (let e = 0; e < t.length; e++) n = Math.max(n, t[e].depth);
  return n;
}
function lt(e) {
  if (e.parentId)
    return e.table.getCoreRowModel().rowsById[e.parentId] ?? e.table.getRow(e.parentId, !0);
}
function ut(e) {
  let t = [],
    n = e;
  for (;;) {
    let e = n.getParentRow();
    if (!e) break;
    (t.push(e), (n = e));
  }
  return t.reverse();
}
function dt(e) {
  let t = e.table.getAllLeafColumns(),
    n = e._cellsCache;
  n ||= e._cellsCache = new WeakMap();
  let r = Array(t.length);
  for (let i = 0; i < t.length; i++) {
    let a = t[i],
      o = n.get(a);
    (o || ((o = tt(a, e, e.table)), n.set(a, o)), (r[i] = o));
  }
  return r;
}
function ft(e) {
  let t = w(),
    n = e.getAllCells();
  for (let e = 0; e < n.length; e++) {
    let r = n[e];
    t[r.column.id] = r;
  }
  return t;
}
function pt(e, t, n, r) {
  return t.options.getRowId?.(e, n, r) ?? (r ? `${r.id}.${n}` : String(n));
}
function mt(e, t, n) {
  let r = (n ? e.getPrePaginatedRowModel() : e.getRowModel()).rowsById[t];
  if (!r && ((r = e.getCoreRowModel().rowsById[t]), !r)) throw Error();
  return r;
}
var ht = {
  assignRowPrototype: (e, t) => {
    O(`coreRowsFeature`, e, t, {
      row_getDisplayIndex: { fn: (e) => nt(e) },
      row_getAllCellsByColumnId: { fn: (e) => ft(e), memoDeps: (e) => [e.getAllCells()] },
      row_getAllCells: { fn: (e) => dt(e), memoDeps: (e) => [e.table.getAllLeafColumns()] },
      row_getLeafRows: { fn: (e) => st(e), memoDeps: (e) => [e.subRows] },
      row_getParentRow: { fn: (e) => lt(e) },
      row_getParentRows: { fn: (e) => ut(e) },
      row_getUniqueValues: { fn: (e, t) => at(e, t) },
      row_getValue: { fn: (e, t) => it(e, t) },
      row_renderValue: { fn: (e, t) => ot(e, t) },
    });
  },
  constructTableAPIs: (e) => {
    D(`coreRowsFeature`, e, {
      table_getRowsInDisplayOrder: {
        fn: () => rt(e),
        memoDeps: () => [
          e.getPrePaginatedRowModel().rows,
          e.options.paginateExpandedRows,
          e.options.paginateExpandedRows === !1 ? e.atoms.expanded?.get() : void 0,
        ],
      },
      table_getRowId: { fn: (t, n, r) => pt(t, e, n, r) },
      table_getRow: { fn: (t, n) => mt(e, t, n) },
      table_getMaxSubRowDepth: { fn: () => ct(e), memoDeps: () => [e.getCoreRowModel()] },
    });
  },
};
function B(e, t, n = (e, t) => e === t) {
  let r = t === void 0 ? e.options.state : t;
  e._reactivity.batch(() => {
    if (r)
      for (let t in r) {
        let i = e.baseAtoms[t];
        if (!i) continue;
        let a = r[t],
          o = a === void 0 ? e.initialState[t] : a;
        n(
          e._reactivity.untrack(() => i.get()),
          o,
        ) || i.set(() => o);
      }
  });
}
function V(e, t, n = (e, t) => e === t) {
  e._reactivity.batch(() => {
    (B(e, t, n), e._reactivity.commit?.());
  });
}
function gt(e) {
  let t = C(e.initialState);
  e._reactivity.batch(() => {
    let n = Object.keys(t);
    for (let r = 0; r < n.length; r++) {
      let i = n[r];
      e.baseAtoms[i].set(t[i]);
    }
  });
  let n = Object.values(e._features);
  for (let t = 0; t < n.length; t++) n[t].resetTableInstanceData?.(e);
}
function _t(e, t) {
  let { features: n, atoms: r, initialState: i } = e.options;
  if (!e.options.mergeOptions)
    return { ...e.options, ...t, features: n, atoms: r, initialState: i };
  let a = e.options.mergeOptions(e.options, t),
    o = { ...Object.getOwnPropertyDescriptors(a) };
  return Object.defineProperties(Object.create(Object.getPrototypeOf(a)), {
    ...o,
    features: { value: n, enumerable: !0, configurable: !0, writable: !0 },
    atoms: { value: r, enumerable: !0, configurable: !0, writable: !0 },
    initialState: { value: i, enumerable: !0, configurable: !0, writable: !0 },
  });
}
function H(e, t, n) {
  let r = _t(e, S(t, e.options));
  (e.optionsStore ? e.optionsStore.set(() => r) : (e.options = r),
    n?.syncExternalState !== !1 && V(e, r.state ?? null));
}
var vt = {
  coreCellsFeature: se,
  coreColumnsFeature: ke,
  coreHeadersFeature: Ie,
  coreRowModelsFeature: $e,
  coreRowsFeature: ht,
  coreTablesFeature: {
    constructTableAPIs: (e) => {
      D(`coreTablesFeature`, e, {
        table_reset: { fn: () => gt(e) },
        table_setOptions: { fn: (t) => H(e, t) },
      });
    },
  },
};
function yt() {
  return {};
}
function bt(e) {
  return e;
}
function xt(e, t = {}) {
  return (
    Object.values(e).forEach((e) => {
      t = e.getInitialState?.(t) ?? t;
    }),
    C(t)
  );
}
function St(e) {
  let t = e.features.coreReactivityFeature,
    {
      aggregationFns: n,
      columnMeta: r,
      coreRowModel: i,
      expandedRowModel: a,
      facetedMinMaxValues: o,
      facetedRowModel: s,
      facetedUniqueValues: c,
      filterFns: u,
      filterMeta: d,
      filteredRowModel: f,
      groupedRowModel: p,
      paginatedRowModel: m,
      sortFns: h,
      sortedRowModel: g,
      tableMeta: _,
      ...y
    } = e.features,
    b = {
      _cellInstanceInitFns: [],
      _columnInstanceInitFns: [],
      _features: { ...vt, ...y },
      _headerGroupInstanceInitFns: [],
      _headerInstanceInitFns: [],
      _reactivity: t,
      _rowInstanceInitFns: [],
      _rowModelFns: { aggregationFns: n, filterFns: u, sortFns: h },
      _rowModels: {},
      atoms: {},
      baseAtoms: {},
    },
    x = Object.values(b._features),
    S = { ...x.reduce((e, t) => Object.assign(e, t.getDefaultTableOptions?.(b)), {}), ...e };
  if (t.wrapExternalAtoms && S.atoms)
    for (let [e, n] of Object.entries(S.atoms)) {
      let r = n,
        i = t.createWritableAtom(r.get(), { debugName: `externalAtom/${e}` });
      S.atoms[e] = i;
      let a = !1,
        o = r.subscribe((e) => {
          a || i.set(e);
        }),
        s = i.subscribe((e) => {
          ((a = !0), r.set(e), (a = !1));
        });
      (t.addSubscription(o), t.addSubscription(s));
    }
  (t.createOptionsStore
    ? ((b.optionsStore = t.createWritableAtom(S, { debugName: `table/optionsStore` })),
      Object.defineProperty(b, "options", {
        configurable: !0,
        enumerable: !0,
        get() {
          return b.optionsStore.get();
        },
        set(e) {
          b.optionsStore.set(() => e);
        },
      }))
    : (b.options = S),
    (b.initialState = xt(b._features, b.options.initialState)));
  let C = Object.keys(b.initialState);
  for (let e = 0; e < C.length; e++) {
    let n = C[e];
    ((b.baseAtoms[n] = t.createWritableAtom(b.initialState[n], {
      debugName: `table/baseAtoms/${n}`,
    })),
      (b.atoms[n] = t.createReadonlyAtom(
        () => {
          let e = b.options,
            t = e.atoms?.[n],
            r = t ? t.get() : b.baseAtoms[n].get();
          if (t) return r;
          let i = e.state;
          if (i && T(i, n)) {
            let e = i[n];
            return e === void 0 ? b.initialState[n] : e;
          }
          return r;
        },
        { debugName: `table/atoms/${n}` },
      )));
  }
  (B(b),
    (b.store = v(
      t.createReadonlyAtom(
        () => {
          let e = {};
          for (let t = 0; t < C.length; t++) {
            let n = C[t];
            e[n] = b.atoms[n].get();
          }
          return e;
        },
        { compare: l, debugName: `table/store` },
      ),
    )));
  for (let e = 0; e < x.length; e++) {
    let t = x[e];
    (t.initTableInstanceData?.(b),
      t.initCellInstanceData && b._cellInstanceInitFns.push(t.initCellInstanceData.bind(t)),
      t.initColumnInstanceData && b._columnInstanceInitFns.push(t.initColumnInstanceData.bind(t)),
      t.initHeaderGroupInstanceData &&
        b._headerGroupInstanceInitFns.push(t.initHeaderGroupInstanceData.bind(t)),
      t.initHeaderInstanceData && b._headerInstanceInitFns.push(t.initHeaderInstanceData.bind(t)),
      t.initRowInstanceData && b._rowInstanceInitFns.push(t.initRowInstanceData.bind(t)),
      t.constructTableAPIs?.(b));
  }
  return b;
}
var Ct = typeof window > `u` ? d.useEffect : d.useLayoutEffect;
function wt(e, t) {
  let [{ table: n, rootSource: r }] = (0, d.useState)(() => {
      let t = St({ ...e, features: { coreReactivityFeature: x(), ...e.features } });
      return (
        (t.Subscribe = (e) => _({ ...e, source: e.source ?? t.store })),
        (t.FlexRender = g),
        { table: t, rootSource: b(t.store, l) }
      );
    }),
    i = n;
  H(i, (t) => ({ ...t, ...e }), { syncExternalState: !1 });
  let a = i.options.state,
    s = r.get(),
    c = o(r, t, { compare: l });
  return (
    Ct(() => {
      (r.markCommitted(s), V(i, a ?? null, l));
    }),
    (0, d.useMemo)(() => ({ ...n, options: e, state: c }), [n, e, c])
  );
}
var Tt = r(n(), 1);
function Et(e) {
  return typeof e == `object` ? e.key : e;
}
function Dt(e, t) {
  let n = e.length;
  return new Proxy(e, {
    get(e, r, i) {
      if (typeof r == `string`) {
        let i = r.charCodeAt(0);
        if (i >= 48 && i <= 57) {
          let i = +r;
          if (Number.isInteger(i) && i >= 0 && i < n) {
            let n = e[i];
            if (typeof n != `object`) {
              let r = t[i * 2];
              n = e[i] = {
                index: i,
                key: n,
                start: r,
                size: t[i * 2 + 1],
                end: r + t[i * 2 + 1],
                lane: 0,
              };
            }
            return n;
          }
        }
        if (r === `length`) return n;
      }
      return Reflect.get(e, r, i);
    },
  });
}
function U(e, t, n) {
  let r = n.initialDeps ?? [],
    i,
    a = !0;
  function o() {
    let o = e();
    return o.length !== r.length || o.some((e, t) => r[t] !== e)
      ? ((r = o),
        (i = t(...o)),
        n?.onChange && !(a && n.skipInitialOnChange) && n.onChange(i),
        (a = !1),
        i)
      : i;
  }
  return (
    (o.updateDeps = (e) => {
      r = e;
    }),
    o
  );
}
function W(e, t) {
  if (e === void 0) throw Error(`Unexpected undefined${t ? `: ${t}` : ``}`);
  return e;
}
var G = (e, t) => Math.abs(e - t) < 1.01,
  Ot = (e, t, n) => {
    let r;
    return Object.assign(
      function (...i) {
        (e.clearTimeout(r), (r = e.setTimeout(() => t.apply(this, i), n)));
      },
      {
        cancel: () => {
          e.clearTimeout(r);
        },
      },
    );
  },
  K,
  q = () => {
    if (K !== void 0) return K;
    if (typeof navigator > `u`) return (K = !1);
    if (/iP(hone|od|ad)/.test(navigator.userAgent)) return (K = !0);
    let e = navigator.maxTouchPoints;
    return (K = navigator.platform === `MacIntel` && e !== void 0 && e > 0);
  },
  J = (e) => {
    let { offsetWidth: t, offsetHeight: n } = e;
    return { width: t, height: n };
  },
  kt = (e) => e,
  At = (e) => {
    let t = Math.max(e.startIndex - e.overscan, 0),
      n = Math.min(e.endIndex + e.overscan, e.count - 1) - t + 1,
      r = Array(n);
    for (let e = 0; e < n; e++) r[e] = t + e;
    return r;
  },
  jt = (e, t) => {
    let n = e.scrollElement;
    if (!n) return;
    let r = e.targetWindow;
    if (!r) return;
    let i = (e) => {
      let { width: n, height: r } = e;
      t({ width: Math.round(n), height: Math.round(r) });
    };
    if ((i(J(n)), !r.ResizeObserver)) return () => {};
    let a = new r.ResizeObserver((t) => {
      let r = () => {
        let e = t[0];
        if (e?.borderBoxSize) {
          let t = e.borderBoxSize[0];
          if (t) {
            i({ width: t.inlineSize, height: t.blockSize });
            return;
          }
        }
        i(J(n));
      };
      e.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(r) : r();
    });
    return (
      a.observe(n, { box: `border-box` }),
      () => {
        a.unobserve(n);
      }
    );
  },
  Y = { passive: !0 },
  Mt = typeof window > `u` || `onscrollend` in window,
  Nt = (e, t, n) => {
    let r = e.scrollElement;
    if (!r) return;
    let i = e.targetWindow;
    if (!i) return;
    let a = e.options.useScrollendEvent && Mt,
      o = 0,
      s = a ? null : Ot(i, () => t(n(r), !1), e.options.isScrollingResetDelay),
      c = (e) => () => {
        ((o = n(r)), s?.(), t(o, e));
      },
      l = c(!0),
      u = c(!1);
    return (
      r.addEventListener(`scroll`, l, Y),
      a && r.addEventListener(`scrollend`, u, Y),
      () => {
        (r.removeEventListener(`scroll`, l),
          a && r.removeEventListener(`scrollend`, u),
          s?.cancel());
      }
    );
  },
  Pt = (e, t) =>
    Nt(e, t, (t) => {
      let { horizontal: n, isRtl: r } = e.options;
      return n ? t.scrollLeft * ((r && -1) || 1) : t.scrollTop;
    }),
  Ft = (e, t, n) => {
    if (n.options.useCachedMeasurements) {
      let t = n.indexFromElement(e),
        r = n.options.getItemKey(t);
      return n.itemSizeCache.get(r) ?? n.options.estimateSize(t);
    }
    if (t?.borderBoxSize) {
      let e = t.borderBoxSize[0];
      if (e) return Math.round(e[n.options.horizontal ? `inlineSize` : `blockSize`]);
    }
    if (!t) {
      let t = n.indexFromElement(e),
        r = n.options.getItemKey(t),
        i = n.itemSizeCache.get(r);
      if (i !== void 0) return i;
    }
    return e[n.options.horizontal ? `offsetWidth` : `offsetHeight`];
  },
  It = (e, { adjustments: t = 0, behavior: n }, r) => {
    var i, a;
    (a = (i = r.scrollElement)?.scrollTo) == null ||
      a.call(i, { [r.options.horizontal ? `left` : `top`]: e + t, behavior: n });
  };
function Lt(e, t, n, r) {
  if (t === 0) return !1;
  let i = r(0),
    a = new Set(),
    o = 0;
  for (; o < e;) {
    let e = n(o);
    if (e === i) break;
    (a.add(e), o++);
  }
  let s = e - o;
  if (s === 0 || s >= t) return !1;
  for (let e = 0; e < s; e++) if (r(e) !== n(o + e)) return !1;
  for (let e = s; e < t; e++) if (a.has(r(e))) return !1;
  return !0;
}
var Rt = class {
    constructor(e) {
      ((this.unsubs = []),
        (this.scrollElement = null),
        (this.targetWindow = null),
        (this.isScrolling = !1),
        (this.scrollState = null),
        (this.measurementsCache = []),
        (this._singleLaneMeasurements = null),
        (this.itemSizeCache = new Map()),
        (this.itemSizeCacheVersion = 0),
        (this.laneAssignments = new Map()),
        (this.pendingMin = null),
        (this.prevLanes = void 0),
        (this.lanesChangedFlag = !1),
        (this.lanesSettling = !1),
        (this.pendingScrollAnchor = null),
        (this.scrollRect = null),
        (this.scrollOffset = null),
        (this.scrollDirection = null),
        (this.scrollAdjustments = 0),
        (this._iosDeferredAdjustment = 0),
        (this._iosTouching = !1),
        (this._iosJustTouchEnded = !1),
        (this._iosTouchEndTimerId = null),
        (this._intendedScrollOffset = null),
        (this._clampedAdjustment = null),
        (this.elementsCache = new Map()),
        (this.now = () => {
          var e;
          return (e = this.targetWindow?.performance)?.now?.call(e) ?? Date.now();
        }),
        (this.observer = (() => {
          let e = null,
            t = () =>
              e ||
              (!this.targetWindow || !this.targetWindow.ResizeObserver
                ? null
                : (e = new this.targetWindow.ResizeObserver((e) => {
                    e.forEach((e) => {
                      let t = () => {
                        let t = e.target,
                          n = this.indexFromElement(t);
                        if (!t.isConnected) {
                          this.observer.unobserve(t);
                          for (let [e, n] of this.elementsCache)
                            if (n === t) {
                              this.elementsCache.delete(e);
                              break;
                            }
                          return;
                        }
                        this.isIndexInRange(n) &&
                          this.shouldMeasureDuringScroll(n) &&
                          this.resizeItem(n, this.options.measureElement(t, e, this));
                      };
                      this.options.useAnimationFrameWithResizeObserver
                        ? requestAnimationFrame(t)
                        : t();
                    });
                  })));
          return {
            disconnect: () => {
              var n;
              ((n = t()) == null || n.disconnect(), (e = null));
            },
            observe: (e) => t()?.observe(e, { box: `border-box` }),
            unobserve: (e) => t()?.unobserve(e),
          };
        })()),
        (this.range = null),
        (this.setOptions = (e) => {
          let t = {
            debug: !1,
            initialOffset: 0,
            overscan: 1,
            paddingStart: 0,
            paddingEnd: 0,
            scrollPaddingStart: 0,
            scrollPaddingEnd: 0,
            horizontal: !1,
            getItemKey: kt,
            rangeExtractor: At,
            onChange: () => {},
            measureElement: Ft,
            initialRect: { width: 0, height: 0 },
            scrollMargin: 0,
            gap: 0,
            indexAttribute: `data-index`,
            initialMeasurementsCache: [],
            lanes: 1,
            anchorTo: `start`,
            followOnAppend: !1,
            scrollEndThreshold: 1,
            isScrollingResetDelay: 150,
            enabled: !0,
            isRtl: !1,
            useScrollendEvent: !1,
            useAnimationFrameWithResizeObserver: !1,
            laneAssignmentMode: `estimate`,
            useCachedMeasurements: !1,
          };
          for (let n in e) {
            let r = e[n];
            r !== void 0 && (t[n] = r);
          }
          let n = this.options,
            r = null,
            i = null,
            a = !1;
          if (
            n !== void 0 &&
            n.enabled &&
            t.enabled &&
            t.anchorTo === `end` &&
            this.scrollElement !== null
          ) {
            let e = n.count,
              o = t.count,
              s = this.getMeasurements(),
              c = this._singleLaneMeasurements?.items ?? s,
              l = (e) => Et(c[e]),
              u = e > 0 ? l(0) : null,
              d = e > 0 ? l(e - 1) : null;
            if (
              o !== e ||
              (e > 0 && o > 0 && (t.getItemKey(0) !== u || t.getItemKey(o - 1) !== d))
            ) {
              a = !0;
              let c = e > 0 ? (this.getVirtualItemForOffset(this.getScrollOffset()) ?? s[0]) : null;
              c && (r = [c.key, this.getScrollOffset() - c.start]);
              let u = t.followOnAppend === !0 ? `auto` : t.followOnAppend || null;
              u &&
                o > 0 &&
                this.isAtEnd(n.scrollEndThreshold) &&
                (e === 0 || t.getItemKey(o - 1) !== d) &&
                (o > e || Lt(e, o, l, t.getItemKey)) &&
                (i = u);
            }
          }
          ((this.options = t), a && ((this.pendingMin = 0), this.itemSizeCacheVersion++));
          let o = !1,
            s = 0;
          if (r && this.scrollOffset !== null) {
            let [e, t] = r,
              n = this.getMeasurements(),
              { count: a, getItemKey: c } = this.options,
              l = 0;
            for (; l < a && c(l) !== e;) l++;
            if (l < a) {
              let e = n[l];
              if (e) {
                let n = Math.max(0, e.start + t);
                !i &&
                  n !== this.scrollOffset &&
                  ((s = n - this.scrollOffset), (this.scrollOffset = n), (o = !0));
              }
            }
          }
          (o || i) && (this.pendingScrollAnchor = [o ? r[0] : null, o ? r[1] : 0, i, s]);
        }),
        (this.notify = (e) => {
          var t, n;
          (n = (t = this.options).onChange) == null || n.call(t, this, e);
        }),
        (this.maybeNotify = U(
          () => (
            this.calculateRange(),
            [
              this.isScrolling,
              this.range ? this.range.startIndex : null,
              this.range ? this.range.endIndex : null,
            ]
          ),
          (e) => {
            this.notify(e);
          },
          {
            key: !1,
            debug: () => this.options.debug,
            initialDeps: [
              this.isScrolling,
              this.range ? this.range.startIndex : null,
              this.range ? this.range.endIndex : null,
            ],
          },
        )),
        (this.cleanup = () => {
          (this.unsubs.filter(Boolean).forEach((e) => e()),
            (this.unsubs = []),
            this.observer.disconnect(),
            this.rafId != null &&
              this.targetWindow &&
              (this.targetWindow.cancelAnimationFrame(this.rafId), (this.rafId = null)),
            (this.scrollState = null),
            (this.isScrolling = !1),
            (this.scrollDirection = null),
            (this._iosDeferredAdjustment = 0),
            (this._iosTouching = !1),
            (this._iosJustTouchEnded = !1),
            (this._clampedAdjustment = null),
            (this.scrollElement = null),
            (this.targetWindow = null));
        }),
        (this._didMount = () => () => {
          this.cleanup();
        }),
        (this._willUpdate = () => {
          let e = this.options.enabled ? this.options.getScrollElement() : null;
          if (this.scrollElement !== e) {
            if ((this.cleanup(), !e)) {
              this.maybeNotify();
              return;
            }
            if (
              ((this.scrollElement = e),
              (this.targetWindow =
                this.scrollElement && `ownerDocument` in this.scrollElement
                  ? this.scrollElement.ownerDocument.defaultView
                  : (this.scrollElement?.window ?? null)),
              this.elementsCache.forEach((e) => {
                this.observer.observe(e);
              }),
              this.unsubs.push(
                this.options.observeElementRect(this, (e) => {
                  ((this.scrollRect = e), this.maybeNotify());
                }),
              ),
              this.unsubs.push(
                this.options.observeElementOffset(this, (e, t) => {
                  if (t && this._intendedScrollOffset === null && e === this.scrollOffset) return;
                  (this._intendedScrollOffset !== null &&
                    Math.abs(e - this._intendedScrollOffset) < 1.5 &&
                    (e = this._intendedScrollOffset),
                    (this._intendedScrollOffset = null),
                    this._clampedAdjustment !== null &&
                      Math.abs(e - this._clampedAdjustment.maxAtWrite) >= 1.5 &&
                      (this._clampedAdjustment = null),
                    (this.scrollAdjustments = 0));
                  let n = this.getScrollOffset();
                  ((this.scrollDirection = t
                    ? n === e
                      ? this.scrollDirection
                      : n < e
                        ? `forward`
                        : `backward`
                    : null),
                    (this.scrollOffset = e),
                    (this.isScrolling = t),
                    this._flushIosDeferredIfReady(),
                    this.scrollState && this.scheduleScrollReconcile(),
                    this.maybeNotify());
                }),
              ),
              `addEventListener` in this.scrollElement)
            ) {
              let e = this.scrollElement,
                t = () => {
                  ((this._iosTouching = !0),
                    (this._iosJustTouchEnded = !1),
                    this._iosTouchEndTimerId !== null &&
                      this.targetWindow != null &&
                      (this.targetWindow.clearTimeout(this._iosTouchEndTimerId),
                      (this._iosTouchEndTimerId = null)));
                },
                n = () => {
                  ((this._iosTouching = !1),
                    q() &&
                      this.targetWindow != null &&
                      ((this._iosJustTouchEnded = !0),
                      (this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
                        ((this._iosJustTouchEnded = !1),
                          (this._iosTouchEndTimerId = null),
                          this._flushIosDeferredIfReady());
                      }, 150))));
                };
              (e.addEventListener(`touchstart`, t, Y),
                e.addEventListener(`touchend`, n, Y),
                this.unsubs.push(() => {
                  (e.removeEventListener(`touchstart`, t),
                    e.removeEventListener(`touchend`, n),
                    this._iosTouchEndTimerId !== null &&
                      this.targetWindow != null &&
                      (this.targetWindow.clearTimeout(this._iosTouchEndTimerId),
                      (this._iosTouchEndTimerId = null)));
                }));
            }
            this._scrollToOffset(this.getScrollOffset(), { adjustments: void 0, behavior: void 0 });
          }
          let t = this.pendingScrollAnchor;
          if (
            ((this.pendingScrollAnchor = null), t && this.scrollElement && this.options.enabled)
          ) {
            let [e, n, r, i] = t;
            (e !== null &&
              !r &&
              (q() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)
                ? i !== 0 && (this._iosDeferredAdjustment += i)
                : (this.scrollState?.behavior === `smooth` &&
                    !G(this.getScrollOffset() - i, this.scrollState.lastTargetOffset)) ||
                  this._scrollToOffset(this.getScrollOffset(), {
                    adjustments: void 0,
                    behavior: void 0,
                  })),
              r && this.scrollToEnd({ behavior: r }));
          }
          this._retryClampedAdjustment();
        }),
        (this._retryClampedAdjustment = () => {
          if (this._clampedAdjustment === null || !this.scrollElement || !this.options.enabled)
            return;
          let { target: e, maxAtWrite: t } = this._clampedAdjustment,
            n = this.getMaxScrollOffset();
          n > t + 0.5 &&
            ((this._clampedAdjustment = e > n + 0.5 ? { target: e, maxAtWrite: n } : null),
            this._scrollToOffset(e, { adjustments: void 0, behavior: void 0 }));
        }),
        (this._flushIosDeferredIfReady = () => {
          if (
            this._iosDeferredAdjustment === 0 ||
            this.isScrolling ||
            this._iosTouching ||
            this._iosJustTouchEnded
          )
            return;
          let e = this.getScrollOffset(),
            t = this.getMaxScrollOffset();
          if (e < 0 || e > t) return;
          if (this._iosDeferredAdjustment < 0 && e >= t - 1) {
            this._iosDeferredAdjustment = 0;
            return;
          }
          let n = this._iosDeferredAdjustment;
          ((this._iosDeferredAdjustment = 0),
            this._scrollToOffset(e, {
              adjustments: (this.scrollAdjustments += n),
              behavior: void 0,
            }));
        }),
        (this.rafId = null),
        (this.getSize = () =>
          this.options.enabled
            ? ((this.scrollRect = this.scrollRect ?? this.options.initialRect),
              this.scrollRect[this.options.horizontal ? `width` : `height`])
            : ((this.scrollRect = null), 0)),
        (this.getScrollOffset = () =>
          this.options.enabled
            ? ((this.scrollOffset =
                this.scrollOffset ??
                (typeof this.options.initialOffset == `function`
                  ? this.options.initialOffset()
                  : this.options.initialOffset)),
              this.scrollOffset)
            : ((this.scrollOffset = null), 0)),
        (this.getMeasurementOptions = U(
          () => [
            this.options.count,
            this.options.paddingStart,
            this.options.scrollMargin,
            this.options.getItemKey,
            this.options.enabled,
            this.options.lanes,
            this.options.laneAssignmentMode,
            this.options.gap,
          ],
          (e, t, n, r, i, a, o, s) => (
            this.prevLanes !== void 0 && this.prevLanes !== a && (this.lanesChangedFlag = !0),
            (this.prevLanes = a),
            (this.pendingMin = null),
            {
              count: e,
              paddingStart: t,
              scrollMargin: n,
              getItemKey: r,
              enabled: i,
              lanes: a,
              laneAssignmentMode: o,
              gap: s,
            }
          ),
          { key: !1 },
        )),
        (this.isIndexInRange = (e) => e >= 0 && e < this.options.count),
        (this.getMeasurements = U(
          () => [this.getMeasurementOptions(), this.itemSizeCacheVersion],
          (
            {
              count: e,
              paddingStart: t,
              scrollMargin: n,
              getItemKey: r,
              enabled: i,
              lanes: a,
              laneAssignmentMode: o,
              gap: s,
            },
            c,
          ) => {
            let l = this.itemSizeCache;
            if (!i)
              return (
                (this.measurementsCache = []),
                (this._singleLaneMeasurements = null),
                this.itemSizeCache.clear(),
                this.laneAssignments.clear(),
                []
              );
            if (this.laneAssignments.size > e)
              for (let t of this.laneAssignments.keys()) t >= e && this.laneAssignments.delete(t);
            (this.lanesChangedFlag &&
              ((this.lanesChangedFlag = !1),
              (this.lanesSettling = !0),
              (this.measurementsCache = []),
              (this._singleLaneMeasurements = null),
              this.itemSizeCache.clear(),
              this.laneAssignments.clear(),
              (this.pendingMin = null)),
              this.measurementsCache.length === 0 &&
                !this.lanesSettling &&
                ((this.measurementsCache = this.options.initialMeasurementsCache),
                this.measurementsCache.forEach((e) => {
                  this.itemSizeCache.set(e.key, e.size);
                })));
            let u = this.lanesSettling ? 0 : (this.pendingMin ?? 0);
            if (
              ((this.pendingMin = null),
              this.lanesSettling &&
                this.measurementsCache.length === e &&
                (this.lanesSettling = !1),
              a === 1)
            ) {
              let i = e * 2,
                a = this._singleLaneMeasurements?.flat;
              if (!a || a.length < i) {
                let e = new Float64Array(i);
                (a && u > 0 && e.set(a.subarray(0, u * 2)), (a = e));
              }
              let o = u === 0 ? Array(e) : this._singleLaneMeasurements.items.slice(),
                c;
              if (u === 0) c = t + n;
              else {
                let e = u - 1;
                c = a[e * 2] + a[e * 2 + 1] + s;
              }
              for (let t = u; t < e; t++) {
                let e = r(t);
                o[t] = e;
                let n = l.get(e),
                  i = typeof n == `number` ? n : this.options.estimateSize(t);
                ((a[t * 2] = c), (a[t * 2 + 1] = i), (c += i + s));
              }
              this._singleLaneMeasurements = { flat: a, items: o };
              let d = Dt(o, a);
              return ((this.measurementsCache = d), d);
            }
            let d = this.measurementsCache.slice(0, u),
              f = Array(a).fill(void 0),
              p = new Float64Array(a),
              m = 0;
            for (let e = 0; e < u; e++) {
              let t = d[e];
              t && (f[t.lane] === void 0 && m++, (f[t.lane] = e), (p[t.lane] = t.end));
            }
            for (let i = u; i < e; i++) {
              let e = r(i),
                c = this.laneAssignments.get(i),
                u,
                h,
                g = o === `estimate` || l.has(e);
              if (c !== void 0 && this.options.lanes > 1) {
                u = c;
                let e = f[u],
                  r = e === void 0 ? void 0 : d[e];
                h = r ? r.end + s : t + n;
              } else if (m === a) {
                let e = 0,
                  t = p[0],
                  n = f[0];
                for (let r = 1; r < a; r++) {
                  let i = p[r];
                  (i < t || (i === t && f[r] < n)) && ((e = r), (t = i), (n = f[r]));
                }
                ((u = e), (h = t + s), g && this.laneAssignments.set(i, u));
              } else
                ((u = i % this.options.lanes), (h = t + n), g && this.laneAssignments.set(i, u));
              let _ = l.get(e),
                v = typeof _ == `number` ? _ : this.options.estimateSize(i),
                y = h + v;
              ((d[i] = { index: i, start: h, size: v, end: y, key: e, lane: u }),
                f[u] === void 0 && m++,
                (f[u] = i),
                (p[u] = y));
            }
            return ((this.measurementsCache = d), d);
          },
          { key: !1, debug: () => this.options.debug },
        )),
        (this.calculateRange = U(
          () => [
            this.getMeasurements(),
            this.getSize(),
            this.getScrollOffset(),
            this.options.lanes,
          ],
          (e, t, n, r) =>
            e.length === 0 || t === 0
              ? ((this.range = null), null)
              : ((this.range = Bt(
                  e,
                  t,
                  n,
                  r,
                  r === 1 && this._singleLaneMeasurements !== null
                    ? this._singleLaneMeasurements.flat
                    : null,
                )),
                this.range),
          { key: !1, debug: () => this.options.debug },
        )),
        (this.getVirtualIndexes = U(
          () => {
            let e = null,
              t = null,
              n = this.calculateRange();
            return (
              n && ((e = n.startIndex), (t = n.endIndex)),
              this.maybeNotify.updateDeps([this.isScrolling, e, t]),
              [this.options.rangeExtractor, this.options.overscan, this.options.count, e, t]
            );
          },
          (e, t, n, r, i) =>
            r === null || i === null
              ? []
              : e({ startIndex: r, endIndex: i, overscan: t, count: n }),
          { key: !1, debug: () => this.options.debug },
        )),
        (this.indexFromElement = (e) => {
          let t = this.options.indexAttribute,
            n = e.getAttribute(t);
          return n
            ? parseInt(n, 10)
            : (console.warn(`Missing attribute name '${t}={index}' on measured element.`), -1);
        }),
        (this.shouldMeasureDuringScroll = (e) => {
          if (!this.scrollState || this.scrollState.behavior !== `smooth`) return !0;
          let t =
            this.scrollState.index ??
            this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)?.index;
          if (t !== void 0 && this.range) {
            let n = Math.max(
                this.options.overscan,
                Math.ceil((this.range.endIndex - this.range.startIndex) / 2),
              ),
              r = Math.max(0, t - n),
              i = Math.min(this.options.count - 1, t + n);
            return e >= r && e <= i;
          }
          return !0;
        }),
        (this.measureElement = (e) => {
          if (!e) {
            this.elementsCache.forEach((e, t) => {
              e.isConnected || (this.observer.unobserve(e), this.elementsCache.delete(t));
            });
            return;
          }
          let t = this.indexFromElement(e);
          if (!this.isIndexInRange(t)) return;
          let n = this.options.getItemKey(t),
            r = this.elementsCache.get(n);
          (r !== e &&
            (r && this.observer.unobserve(r),
            this.observer.observe(e),
            this.elementsCache.set(n, e)),
            (!this.isScrolling || this.scrollState) &&
              this.shouldMeasureDuringScroll(t) &&
              this.resizeItem(t, this.options.measureElement(e, void 0, this)));
        }),
        (this.resizeItem = (e, t) => {
          if (!this.isIndexInRange(e)) return;
          let n,
            r,
            i,
            a = this._singleLaneMeasurements?.flat;
          if (this.options.lanes === 1 && a != null)
            ((i = this.options.getItemKey(e)), (r = a[e * 2]), (n = a[e * 2 + 1]));
          else {
            let t = this.measurementsCache[e];
            if (!t) return;
            ((i = t.key), (r = t.start), (n = t.size));
          }
          let o = this.itemSizeCache.get(i) ?? n,
            s = t - o;
          if (s !== 0) {
            let a =
                this.options.anchorTo === `end` &&
                this.scrollState?.behavior !== `smooth` &&
                this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold,
              c = a ? this.getTotalSize() : 0,
              l = this.getScrollOffset() + this.scrollAdjustments,
              u = this.itemSizeCache.has(i)
                ? r + o <= l && this.scrollDirection !== `backward`
                : r < l,
              d =
                this.scrollState?.behavior !== `smooth` &&
                (this.shouldAdjustScrollPositionOnItemSizeChange === void 0
                  ? u
                  : this.shouldAdjustScrollPositionOnItemSizeChange(
                      this.measurementsCache[e] ?? {
                        index: e,
                        key: i,
                        start: r,
                        size: n,
                        end: r + n,
                        lane: 0,
                      },
                      s,
                      this,
                    ));
            ((this.pendingMin === null || e < this.pendingMin) && (this.pendingMin = e),
              this.itemSizeCache.set(i, t),
              this.itemSizeCacheVersion++);
            let f = !1;
            (a
              ? (f = this.applyScrollAdjustment(this.getTotalSize() - c))
              : d && (f = this.applyScrollAdjustment(s)),
              this.notify(f),
              this._retryClampedAdjustment());
          }
        }),
        (this.getVirtualItems = U(
          () => [this.getVirtualIndexes(), this.getMeasurements()],
          (e, t) => {
            let n = [];
            for (let r = 0, i = e.length; r < i; r++) {
              let i = t[e[r]];
              n.push(i);
            }
            return n;
          },
          { key: !1, debug: () => this.options.debug },
        )),
        (this.getVirtualItemForOffset = (e) => {
          let t = this.getMeasurements();
          if (t.length === 0) return;
          let n = this._singleLaneMeasurements?.flat,
            r = this.options.lanes === 1 && n != null;
          return W(t[X(0, t.length - 1, r ? (e) => n[e * 2] : (e) => W(t[e]).start, e)]);
        }),
        (this.getMaxScrollOffset = () => {
          if (!this.scrollElement) return 0;
          if (`scrollHeight` in this.scrollElement)
            return this.options.horizontal
              ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth
              : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
          {
            let e = this.scrollElement.document.documentElement;
            return this.options.horizontal
              ? e.scrollWidth - this.scrollElement.innerWidth
              : e.scrollHeight - this.scrollElement.innerHeight;
          }
        }),
        (this.getVirtualDistanceFromEnd = () =>
          Math.max(this.getTotalSize() - this.getSize() - this.getScrollOffset(), 0)),
        (this.getDistanceFromEnd = () =>
          Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0)),
        (this.isAtEnd = (e = this.options.scrollEndThreshold) => this.getDistanceFromEnd() <= e),
        (this.getOffsetForAlignment = (e, t, n = 0) => {
          if (!this.scrollElement) return 0;
          let r = this.getSize(),
            i = this.getScrollOffset();
          (t === `auto` && (t = e >= i + r ? `end` : `start`),
            t === `center` ? (e += (n - r) / 2) : t === `end` && (e -= r));
          let a = this.getMaxScrollOffset();
          return Math.max(Math.min(a, e), 0);
        }),
        (this.getOffsetForIndex = (e, t = `auto`) => {
          e = Math.max(0, Math.min(e, this.options.count - 1));
          let n = this.getSize(),
            r = this.getScrollOffset(),
            i = this.measurementsCache[e];
          if (!i) return;
          if (t === `auto`) {
            if (i.end >= r + n - this.options.scrollPaddingEnd) t = `end`;
            else if (i.start <= r + this.options.scrollPaddingStart) t = `start`;
            else return [r, t];
          }
          if (t === `end` && e === this.options.count - 1) return [this.getMaxScrollOffset(), t];
          let a =
            t === `end`
              ? i.end + this.options.scrollPaddingEnd
              : i.start - this.options.scrollPaddingStart;
          return [this.getOffsetForAlignment(a, t, i.size), t];
        }),
        (this.scrollToOffset = (e, { align: t = `start`, behavior: n = `auto` } = {}) => {
          this._iosDeferredAdjustment = 0;
          let r = this.getOffsetForAlignment(e, t),
            i = this.now();
          ((this.scrollState = {
            index: null,
            align: t,
            behavior: n,
            startedAt: i,
            lastTargetOffset: r,
            stableFrames: 0,
          }),
            this._scrollToOffset(r, { adjustments: void 0, behavior: n }),
            this.scheduleScrollReconcile());
        }),
        (this.scrollToIndex = (e, { align: t = `auto`, behavior: n = `auto` } = {}) => {
          ((this._iosDeferredAdjustment = 0),
            (e = Math.max(0, Math.min(e, this.options.count - 1))));
          let r = this.getOffsetForIndex(e, t);
          if (!r) return;
          let [i, a] = r,
            o = this.now();
          ((this.scrollState = {
            index: e,
            align: a,
            behavior: n,
            startedAt: o,
            lastTargetOffset: i,
            stableFrames: 0,
          }),
            this._scrollToOffset(i, { adjustments: void 0, behavior: n }),
            this.scheduleScrollReconcile());
        }),
        (this.scrollBy = (e, { behavior: t = `auto` } = {}) => {
          let n = this.getScrollOffset() + e,
            r = this.now();
          ((this.scrollState = {
            index: null,
            align: `start`,
            behavior: t,
            startedAt: r,
            lastTargetOffset: n,
            stableFrames: 0,
          }),
            this._scrollToOffset(n, { adjustments: void 0, behavior: t }),
            this.scheduleScrollReconcile());
        }),
        (this.scrollToEnd = ({ behavior: e = `auto` } = {}) => {
          if (this.options.count > 0) {
            this.scrollToIndex(this.options.count - 1, { align: `end`, behavior: e });
            return;
          }
          this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), { behavior: e });
        }),
        (this.getTotalSize = () => {
          let e = this.getMeasurements(),
            t;
          if (e.length === 0) t = this.options.paddingStart;
          else if (this.options.lanes === 1) {
            let n = e.length - 1,
              r = this._singleLaneMeasurements?.flat;
            t = r == null ? (e[n]?.end ?? 0) : r[n * 2] + r[n * 2 + 1];
          } else {
            let n = Array(this.options.lanes).fill(null),
              r = e.length - 1;
            for (; r >= 0 && n.some((e) => e === null);) {
              let t = e[r];
              (n[t.lane] === null && (n[t.lane] = t.end), r--);
            }
            t = Math.max(...n.filter((e) => e !== null));
          }
          return Math.max(t - this.options.scrollMargin + this.options.paddingEnd, 0);
        }),
        (this.takeSnapshot = () => {
          let e = [];
          if (this.itemSizeCache.size === 0) return e;
          let t = this.getMeasurements();
          for (let n of t)
            n &&
              this.itemSizeCache.has(n.key) &&
              e.push({
                index: n.index,
                key: n.key,
                start: n.start,
                size: n.size,
                end: n.end,
                lane: n.lane,
              });
          return e;
        }),
        (this._scrollToOffset = (e, { adjustments: t, behavior: n }) => {
          ((this._intendedScrollOffset = e + (t ?? 0)),
            this.options.scrollToFn(e, { behavior: n, adjustments: t }, this));
        }),
        (this.measure = () => {
          ((this.pendingMin = null),
            this.itemSizeCache.clear(),
            this.laneAssignments.clear(),
            this.itemSizeCacheVersion++,
            this.notify(!1));
        }),
        this.setOptions(e));
    }
    applyScrollAdjustment(e, t) {
      if (e === 0) return !1;
      if (q() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded))
        return ((this._iosDeferredAdjustment += e), !1);
      {
        let n = this.getScrollOffset() + this.scrollAdjustments + e,
          r = this.scrollElement,
          i =
            r !== null && (`scrollHeight` in r || `document` in r)
              ? this.getMaxScrollOffset()
              : null;
        return (
          (this._clampedAdjustment =
            i !== null && n > i + 0.5 ? { target: n, maxAtWrite: i } : null),
          this._scrollToOffset(this.getScrollOffset(), {
            adjustments: (this.scrollAdjustments += e),
            behavior: t,
          }),
          this.scrollOffset !== null &&
            ((this.scrollOffset += this.scrollAdjustments),
            this.scrollOffset < 0 && (this.scrollOffset = 0),
            (this.scrollAdjustments = 0)),
          !0
        );
      }
    }
    scheduleScrollReconcile() {
      if (!this.targetWindow) {
        this.scrollState = null;
        return;
      }
      this.rafId ??= this.targetWindow.requestAnimationFrame(() => {
        ((this.rafId = null), this.reconcileScroll());
      });
    }
    reconcileScroll() {
      if (!this.scrollState || !this.scrollElement) return;
      if (this.now() - this.scrollState.startedAt > 5e3) {
        this.scrollState = null;
        return;
      }
      let e =
          this.scrollState.index == null
            ? void 0
            : this.getOffsetForIndex(this.scrollState.index, this.scrollState.align),
        t = e ? e[0] : this.scrollState.lastTargetOffset,
        n = t !== this.scrollState.lastTargetOffset;
      if (!n && G(t, this.getScrollOffset())) {
        if ((this.scrollState.stableFrames++, this.scrollState.stableFrames >= 1)) {
          (this.getScrollOffset() !== t &&
            this._scrollToOffset(t, { adjustments: void 0, behavior: `auto` }),
            (this.scrollState = null));
          return;
        }
      } else if (((this.scrollState.stableFrames = 0), n)) {
        let e = this.getSize() || 600,
          n = Math.abs(t - this.getScrollOffset()),
          r = this.scrollState.behavior === `smooth` && n > e;
        ((this.scrollState.lastTargetOffset = t),
          r || (this.scrollState.behavior = `auto`),
          this._scrollToOffset(t, { adjustments: void 0, behavior: r ? `smooth` : `auto` }));
      }
      this.scheduleScrollReconcile();
    }
  },
  X = (e, t, n, r) => {
    for (; e <= t;) {
      let i = ((e + t) / 2) | 0,
        a = n(i);
      if (a < r) e = i + 1;
      else if (a > r) t = i - 1;
      else return i;
    }
    return e > 0 ? e - 1 : 0;
  };
function zt(e, t, n) {
  let r = 0;
  for (; r <= t;) {
    let i = ((r + t) / 2) | 0,
      a = e[i * 2];
    if (a < n) r = i + 1;
    else if (a > n) t = i - 1;
    else return i;
  }
  return r > 0 ? r - 1 : 0;
}
function Bt(e, t, n, r, i) {
  let a = e.length - 1;
  if (e.length <= r) return { startIndex: 0, endIndex: a };
  if (r === 1 && i !== null) {
    let e = zt(i, a, n),
      r = e,
      o = n + t;
    for (; r < a && i[r * 2] + i[r * 2 + 1] < o;) r++;
    return { startIndex: e, endIndex: r };
  }
  let o = X(0, a, (t) => e[t].start, n),
    s = o;
  if (r === 1) for (; s < a && e[s].end < n + t;) s++;
  else if (r > 1) {
    let i = Array(r).fill(0);
    for (; s < a && i.some((e) => e < n + t);) {
      let t = e[s];
      ((i[t.lane] = t.end), s++);
    }
    let c = Array(r).fill(n + t);
    for (; o >= 0 && c.some((e) => e >= n);) {
      let t = e[o];
      ((c[t.lane] = t.start), o--);
    }
    ((o = Math.max(0, o - (o % r))), (s = Math.min(a, s + (r - 1 - (s % r)))));
  }
  return { startIndex: o, endIndex: s };
}
var Z = typeof document < `u` ? d.useLayoutEffect : d.useEffect;
function Vt({
  useFlushSync: e = !0,
  directDomUpdates: t = !1,
  directDomUpdatesMode: n = `transform`,
  ...r
}) {
  let i = d.useReducer((e) => e + 1, 0)[1],
    a = d.useRef({
      enabled: t,
      mode: n,
      container: null,
      lastSize: null,
      lastPositions: new WeakMap(),
      prevRange: null,
    });
  ((a.current.enabled = t), (a.current.mode = n));
  let o = d.useRef(!1),
    s = (e) => {
      let t = a.current;
      if (!t.enabled || !t.container) return;
      let n = e.getTotalSize();
      if (n !== t.lastSize) {
        t.lastSize = n;
        let r = e.options.horizontal ? `width` : `height`;
        t.container.style[r] = `${n}px`;
      }
    },
    c = (e) => {
      let t = a.current;
      if (!t.enabled || !t.container) return;
      s(e);
      let n = !!e.options.horizontal,
        r = t.mode === `transform`,
        i = n ? `left` : `top`,
        o = e.options.scrollMargin,
        c = e.getVirtualItems();
      for (let a of c) {
        let s = a.start - o,
          c = e.elementsCache.get(a.key);
        c &&
          t.lastPositions.get(c) !== s &&
          (t.lastPositions.set(c, s),
          r
            ? (c.style.transform = n ? `translate3d(${s}px, 0, 0)` : `translate3d(0, ${s}px, 0)`)
            : (c.style[i] = `${s}px`));
      }
    },
    l = {
      ...r,
      onChange: (t, n) => {
        var s;
        let l = a.current,
          u = !0;
        if (l.enabled) {
          c(t);
          let e = t.range,
            n = l.prevRange;
          ((u =
            !n ||
            n.isScrolling !== t.isScrolling ||
            n.startIndex !== e?.startIndex ||
            n.endIndex !== e?.endIndex),
            u &&
              (l.prevRange = e
                ? { startIndex: e.startIndex, endIndex: e.endIndex, isScrolling: t.isScrolling }
                : null));
        }
        (u && (e && n && !o.current ? (0, Tt.flushSync)(i) : i()),
          (s = r.onChange) == null || s.call(r, t, n));
      },
    },
    [u] = d.useState(() => {
      let e = new Rt(l),
        t = e.measureElement;
      return (
        (e.measureElement = (e) => {
          o.current = !0;
          try {
            t(e);
          } finally {
            o.current = !1;
          }
        }),
        Object.assign(e, {
          containerRef: (t) => {
            let n = a.current;
            if (((n.container = t), (n.lastSize = null), t && n.enabled)) {
              let r = e.getTotalSize();
              n.lastSize = r;
              let i = e.options.horizontal ? `width` : `height`;
              t.style[i] = `${r}px`;
            }
          },
        })
      );
    });
  return (
    u.setOptions(l),
    Z(() => u._didMount(), []),
    Z(() => (s(u), u._willUpdate())),
    Z(() => {
      c(u);
    }),
    u
  );
}
function Ht(e) {
  return Vt({ observeElementRect: jt, observeElementOffset: Pt, scrollToFn: It, ...e });
}
var Q = i(),
  $ = e();
function Ut(e) {
  let t = (0, Q.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n ? (i = t[4]) : ((i = a(`[&_tr]:border-b`, n)), (t[3] = n), (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, $.jsx)(`thead`, { "data-slot": `table-header`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function Wt(e) {
  let t = (0, Q.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n ? (i = t[4]) : ((i = a(`[&_tr:last-child]:border-0`, n)), (t[3] = n), (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, $.jsx)(`tbody`, { "data-slot": `table-body`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function Gt(e) {
  let t = (0, Q.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = a(
        `border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, $.jsx)(`tr`, { "data-slot": `table-row`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function Kt(e) {
  let t = (0, Q.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = a(
        `h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, $.jsx)(`th`, { "data-slot": `table-head`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
function qt(e) {
  let t = (0, Q.c)(8),
    n,
    r;
  t[0] === e
    ? ((n = t[1]), (r = t[2]))
    : (({ className: n, ...r } = e), (t[0] = e), (t[1] = n), (t[2] = r));
  let i;
  t[3] === n
    ? (i = t[4])
    : ((i = a(
        `p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]`,
        n,
      )),
      (t[3] = n),
      (t[4] = i));
  let o;
  return (
    t[5] !== r || t[6] !== i
      ? ((o = (0, $.jsx)(`td`, { "data-slot": `table-cell`, className: i, ...r })),
        (t[5] = r),
        (t[6] = i),
        (t[7] = o))
      : (o = t[7]),
    o
  );
}
var Jt = 66,
  Yt = 8,
  Xt = bt({ columnMeta: yt() });
function Zt({ columns: e, data: t, getRowId: n, label: r, onEndReached: i, className: o }) {
  let s = (0, d.useRef)(null),
    c = (0, d.useRef)(-1),
    l = wt({ features: Xt, columns: e, data: t, getRowId: n }),
    u = l.getRowModel().rows,
    f = Ht({
      count: u.length,
      getScrollElement: () => s.current,
      estimateSize: () => Jt,
      overscan: Yt,
    }),
    p = l.getHeaderGroups().length,
    m = f.getVirtualItems(),
    h = m[0]?.start ?? 0,
    g = f.getTotalSize() - (m.at(-1)?.end ?? 0);
  function _(e) {
    e.scrollHeight - e.scrollTop - e.clientHeight >= 660 ||
      c.current === u.length ||
      ((c.current = u.length), i?.());
  }
  function v(e) {
    ((s.current = e), e && _(e));
  }
  return (0, $.jsx)(`div`, {
    ref: v,
    onScroll: ({ currentTarget: e }) => _(e),
    tabIndex: 0,
    role: `region`,
    "aria-label": r,
    className: a(`relative overflow-auto rounded-lg border bg-card shadow-sm`, o),
    children: (0, $.jsxs)(`table`, {
      "aria-rowcount": u.length + p,
      className: `w-full text-sm`,
      children: [
        (0, $.jsx)(Ut, {
          className: `sticky top-0 z-10 bg-card`,
          children: l.getHeaderGroups().map((e, t) =>
            (0, $.jsx)(
              Gt,
              {
                "aria-rowindex": t + 1,
                className: `hover:bg-transparent`,
                children: e.headers.map((e) =>
                  (0, $.jsx)(
                    Kt,
                    {
                      className: a(
                        `h-10 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground`,
                        e.column.columnDef.meta?.align === `right` && `text-right`,
                        e.column.columnDef.meta?.className,
                      ),
                      children: e.isPlaceholder ? null : (0, $.jsx)(l.FlexRender, { header: e }),
                    },
                    e.id,
                  ),
                ),
              },
              e.id,
            ),
          ),
        }),
        (0, $.jsxs)(Wt, {
          children: [
            h > 0 && (0, $.jsx)(Qt, { height: h, span: e.length }),
            m.map((e) => {
              let t = u[e.index];
              return (0, $.jsx)(
                Gt,
                {
                  ref: f.measureElement,
                  "data-index": e.index,
                  "aria-rowindex": e.index + 1 + p,
                  className: `h-16.5`,
                  children: t.getAllCells().map((e) =>
                    (0, $.jsx)(
                      qt,
                      {
                        className: a(
                          `px-4`,
                          e.column.columnDef.meta?.align === `right` && `text-right`,
                          e.column.columnDef.meta?.className,
                        ),
                        children: (0, $.jsx)(l.FlexRender, { cell: e }),
                      },
                      e.id,
                    ),
                  ),
                },
                t.id,
              );
            }),
            g > 0 && (0, $.jsx)(Qt, { height: g, span: e.length }),
          ],
        }),
      ],
    }),
  });
}
function Qt({ height: e, span: t }) {
  return (0, $.jsx)(`tr`, {
    "aria-hidden": !0,
    style: { height: e },
    children: (0, $.jsx)(`td`, { colSpan: t, className: `p-0` }),
  });
}
export { Zt as t };
