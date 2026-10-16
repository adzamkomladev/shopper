import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  i as require_react,
  n as useSelector,
  r as require_jsx_runtime,
  t as require_react_dom,
} from "./react-dom-BCYT53bd.js";
import { m as cn } from "./createLucideIcon-DmKyVZgg.js";
import { it as createAtom, rt as batch } from "./router-Dr1B-bFG.js";
//#region ../../node_modules/.pnpm/@tanstack+store@0.11.2/node_modules/@tanstack/store/dist/shallow.js
function shallow(objA, objB) {
  if (Object.is(objA, objB)) return true;
  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null)
    return false;
  if (objA instanceof Map && objB instanceof Map) {
    if (objA.size !== objB.size) return false;
    for (const [k, v] of objA) if (!objB.has(k) || !Object.is(v, objB.get(k))) return false;
    return true;
  }
  if (objA instanceof Set && objB instanceof Set) {
    if (objA.size !== objB.size) return false;
    for (const v of objA) if (!objB.has(v)) return false;
    return true;
  }
  if (objA instanceof Date && objB instanceof Date) {
    if (objA.getTime() !== objB.getTime()) return false;
    return true;
  }
  const keysA = getOwnKeys(objA);
  if (keysA.length !== getOwnKeys(objB).length) return false;
  for (let i = 0; i < keysA.length; i++)
    if (
      !Object.prototype.hasOwnProperty.call(objB, keysA[i]) ||
      !Object.is(objA[keysA[i]], objB[keysA[i]])
    )
      return false;
  return true;
}
function getOwnKeys(obj) {
  return Object.keys(obj).concat(Object.getOwnPropertySymbols(obj));
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-table@9.2.8_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-table/dist/FlexRender.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
function isReactComponent(component) {
  return (
    isClassComponent(component) || typeof component === "function" || isExoticComponent(component)
  );
}
function isClassComponent(component) {
  return (
    typeof component === "function" &&
    (() => {
      const proto = Object.getPrototypeOf(component);
      return proto.prototype && proto.prototype.isReactComponent;
    })()
  );
}
function isExoticComponent(component) {
  return (
    typeof component === "object" &&
    typeof component.$$typeof === "symbol" &&
    ["react.memo", "react.forward_ref"].includes(component.$$typeof.description)
  );
}
/**
 * If rendering headers, cells, or footers with custom markup, use flexRender instead of `cell.getValue()` or `cell.renderValue()`.
 * @example flexRender(cell.column.columnDef.cell, cell.getContext())
 */
function flexRender(Comp, props) {
  if (Comp === null || Comp === void 0) return null;
  return isReactComponent(Comp) ? /* @__PURE__ */ import_react.createElement(Comp, props) : Comp;
}
/**
 * Simplified component wrapper of `flexRender`. Use this utility component to render headers, cells, or footers with custom markup.
 * Only one prop (`cell`, `header`, or `footer`) may be passed.
 * @example
 * ```tsx
 * <FlexRender cell={cell} />
 * <FlexRender header={header} />
 * <FlexRender footer={footer} />
 * ```
 *
 * This replaces calling `flexRender` directly like this:
 * ```tsx
 * flexRender(cell.column.columnDef.cell, cell.getContext())
 * flexRender(header.column.columnDef.header, header.getContext())
 * flexRender(footer.column.columnDef.footer, footer.getContext())
 * ```
 */
function FlexRender(props) {
  if ("cell" in props && props.cell) {
    const cell = props.cell;
    const def = cell.column.columnDef;
    const groupingCell = cell;
    const groupingDef = def;
    if (groupingCell.getIsAggregated?.())
      return flexRender(groupingDef.aggregatedCell ?? def.cell, cell.getContext());
    if (groupingCell.getIsPlaceholder?.()) return null;
    return flexRender(def.cell, cell.getContext());
  }
  if ("header" in props && props.header)
    return flexRender(props.header.column.columnDef.header, props.header.getContext());
  if ("footer" in props && props.footer)
    return flexRender(props.footer.column.columnDef.footer, props.footer.getContext());
  return null;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-table@9.2.8_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-table/dist/Subscribe.js
function Subscribe(props) {
  const selected = useSelector(props.source, props.selector, { compare: shallow });
  return typeof props.children === "function" ? props.children(selected) : props.children;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/reactivity/coreReactivityFeature.utils.js
/**
 * Bridges atom instances to the `Store`/`ReadonlyStore` API by exposing
 * a `state` getter backed by `atom.get()`, and wiring `setState` for
 * writable atoms.
 *
 * @example
 * ```ts
 * const store = atomToStore(atom)
 * ```
 */
function atomToStore(atom) {
  const store = atom;
  Object.defineProperty(atom, "state", {
    get() {
      return atom.get();
    },
  });
  if ("set" in atom) store.setState = atom.set.bind(atom);
  return store;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/reactivity/renderPhaseReactivity.js
/**
 * Creates reactivity bindings for render-phase adapters (React, Preact, Lit):
 * frameworks with plain, non-reactive options that are re-synchronized during
 * component render, where store notifications must not fire until the host
 * commits.
 *
 * Readonly atoms are exposed as live facades. `get()` re-evaluates the
 * resolver against the options of the render in progress — a normal computed
 * cannot know that plain `options.state` changed — and caches the result
 * through the configured comparator so external-store consumers (e.g. React's
 * `useSyncExternalStore`) see referentially stable snapshots. `subscribe()`
 * goes through a hidden computed that tracks the resolver's real atom
 * dependencies plus a commit version, so subscribers are invalidated by
 * actual reactive writes and by the adapter's post-commit publication.
 *
 * @example
 * ```ts
 * import { batch, createAtom } from '@tanstack/react-store'
 *
 * export const reactReactivity = () =>
 *   renderPhaseReactivity({ createAtom, batch })
 * ```
 */
function renderPhaseReactivity(primitives) {
  const { createAtom, batch } = primitives;
  const commitAtom = createAtom(0);
  return {
    createOptionsStore: false,
    wrapExternalAtoms: false,
    addSubscription: () => {
      throw new Error("Feature not supported in current reactivity implementation");
    },
    unmount: () => {
      throw new Error("Feature not supported in current reactivity implementation");
    },
    schedule: primitives.schedule ?? ((fn) => queueMicrotask(fn)),
    batch,
    untrack: (fn) => fn(),
    createReadonlyAtom: (fn, atomOptions) => {
      const compare = atomOptions?.compare ?? Object.is;
      let hasSnapshot = false;
      let snapshot;
      const getSnapshot = () => {
        const nextSnapshot = fn();
        if (!hasSnapshot || !compare(snapshot, nextSnapshot)) {
          snapshot = nextSnapshot;
          hasSnapshot = true;
        }
        return snapshot;
      };
      const reactiveAtom = createAtom(
        () => {
          commitAtom.get();
          return getSnapshot();
        },
        { compare },
      );
      return {
        get: getSnapshot,
        subscribe: reactiveAtom.subscribe.bind(reactiveAtom),
      };
    },
    createWritableAtom: (value, atomOptions) => {
      return createAtom(value, { compare: atomOptions?.compare });
    },
    commit: () => {
      commitAtom.set((version) => version + 1);
    },
  };
}
/**
 * Creates a render-phase source with an explicit commit baseline.
 *
 * Render-phase adapters publish controlled state after the host framework
 * commits so isolated subscribers update, but the component that owns the
 * table already rendered that exact snapshot — forwarding the notification to
 * its root subscription would produce a redundant render. Unlike a last-read
 * filter, speculative reads do not change notification behavior: only
 * `markCommitted()` advances the baseline.
 */
function createRenderPhaseSource(source, compare = Object.is) {
  let hasCommittedSnapshot = false;
  let committedSnapshot;
  return {
    get: source.get,
    markCommitted: (snapshot) => {
      committedSnapshot = snapshot;
      hasCommittedSnapshot = true;
    },
    subscribe: (listener) =>
      source.subscribe((value) => {
        if (!hasCommittedSnapshot || !compare(committedSnapshot, value)) listener(value);
      }),
  };
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-table@9.2.8_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-table/dist/reactivity.js
/**
 * Creates the table-core reactivity bindings used by the React adapter.
 *
 * React stores table state in TanStack Store atoms and leaves options as plain
 * resolved data because `useTable` synchronizes options during render. The
 * render-phase preset supplies the live readonly-atom facades and the `commit`
 * hook; the store primitives are passed in from `@tanstack/react-store` so all
 * atoms share one store instance with user-provided external atoms.
 */
function reactReactivity() {
  return renderPhaseReactivity({
    createAtom,
    batch,
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/utils.js
/**
 * Applies a TanStack updater to a value.
 *
 * If the updater is a function it is called with the previous value; otherwise the updater value is returned directly.
 */
function functionalUpdate(updater, input) {
  return typeof updater === "function" ? updater(input) : updater;
}
/**
 * Clones table state values while preserving non-plain objects.
 *
 * Plain objects and arrays are copied recursively so state updates can avoid mutating existing references.
 */
function cloneState(value) {
  if (Array.isArray(value)) return value.map(cloneState);
  if (value && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return value;
    const copy = proto === null ? makeObjectMap() : {};
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: cloneState(value[key]),
        writable: true,
      });
    }
    return copy;
  }
  return value;
}
/**
 * Creates an object intended only for string-keyed dictionary lookups.
 *
 * The null prototype keeps user-controlled ids such as `__proto__` and
 * `hasOwnProperty` as plain data keys.
 */
function makeObjectMap() {
  return Object.create(null);
}
/**
 * Checks whether an object owns a key, including null-prototype dictionaries.
 */
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}
/**
 * Flattens a tree of nodes by recursively reading child nodes.
 *
 * The original nodes are preserved in depth-first order.
 */
function flattenBy(arr, getChildren) {
  const flat = [];
  const recurse = (subArr) => {
    subArr.forEach((item) => {
      flat.push(item);
      const children = getChildren(item);
      if (children.length) recurse(children);
    });
  };
  recurse(arr);
  return flat;
}
/**
 * Creates a dependency-tracked memoized function for table internals.
 *
 * The memo recomputes only when its dependency tuple changes and can emit debug timing information.
 */
var memo$1 = ({ fn, memoDeps, onAfterCompare, onAfterUpdate, onBeforeCompare, onBeforeUpdate }) => {
  let deps = [];
  let result;
  const memoizedFn = (depArgs) => {
    onBeforeCompare?.();
    const newDeps = memoDeps?.(depArgs);
    let depsChanged = !newDeps || newDeps.length !== deps?.length;
    if (!depsChanged && newDeps) {
      for (let i = 0; i < newDeps.length; i++)
        if (newDeps[i] !== deps[i]) {
          depsChanged = true;
          break;
        }
    }
    onAfterCompare?.(depsChanged);
    if (!depsChanged) return result;
    deps = newDeps;
    onBeforeUpdate?.();
    result = fn(...(newDeps ?? []));
    onAfterUpdate?.(result);
    return result;
  };
  return memoizedFn;
};
/**
 * Wraps a callback so that its first invocation is skipped.
 *
 * Row-model `onAfterUpdate` hooks schedule auto-resets when their inputs
 * change. The initial computation of a row model is not a change, so state
 * resets must not fire for it — otherwise merely reading a row model on mount
 * would wipe initial or controlled state.
 */
function skipFirstRun(fn) {
  let hasRun = false;
  return () => {
    if (!hasRun) {
      hasRun = true;
      return;
    }
    fn();
  };
}
/**
 * Creates a table-aware memoized function.
 *
 * This wraps `memo` with table debug options and feature metadata so row models and derived APIs can share consistent diagnostics.
 */
function tableMemo({ feature, fnName, objectId, onAfterUpdate, table, ...memoOptions }) {
  const onAfterUpdateHandler = () => {
    if (!onAfterUpdate) return;
    const { schedule, untrack } = table._reactivity;
    schedule(() => untrack(() => onAfterUpdate()));
  };
  const debugOptions = {
    onAfterUpdate: () => {
      onAfterUpdateHandler();
    },
  };
  return memo$1({
    ...memoOptions,
    ...debugOptions,
  });
}
/**
 * Assumes that a function name is in the format of `parentName_fnKey` and returns the `fnKey` and `fnName` in the format of `parentName.fnKey`.
 */
function getFunctionNameInfo(staticFnName, splitBy = "_") {
  const [parentName, fnKey] = staticFnName.split(splitBy);
  return {
    fnKey,
    fnName: `${parentName}.${fnKey}`,
    parentName,
  };
}
/**
 * Assigns Table API methods directly to the table instance.
 * Unlike row/cell/column/header, the table is a singleton so methods are assigned directly.
 */
function assignTableAPIs(feature, table, apis) {
  for (const [staticFnName, { fn, memoDeps }] of Object.entries(apis)) {
    const { fnKey, fnName } = getFunctionNameInfo(staticFnName);
    table[fnKey] = memoDeps
      ? tableMemo({
          memoDeps,
          fn,
          fnName,
          table,
          feature,
        })
      : fn;
  }
}
/**
 * Assigns API methods to a prototype object for memory-efficient method sharing.
 * All instances created with this prototype will share the same method references.
 *
 * For memoized methods, the memo state is lazily created and stored on each instance.
 * This provides the best of both worlds: shared method code + per-instance caching.
 */
function assignPrototypeAPIs(feature, prototype, table, apis) {
  for (const [staticFnName, { fn, memoDeps }] of Object.entries(apis)) {
    const { fnKey, fnName } = getFunctionNameInfo(staticFnName);
    if (memoDeps) {
      const memoKey = `_memo_${fnKey}`;
      prototype[fnKey] = function (...args) {
        if (!this[memoKey]) {
          const self = this;
          this[memoKey] = tableMemo({
            memoDeps: (depArgs) => memoDeps(self, depArgs),
            fn: (...deps) => fn(self, ...deps),
            fnName,
            objectId: self.id,
            table,
            feature,
          });
        }
        return this[memoKey](...args);
      };
    } else
      prototype[fnKey] = function (...args) {
        return fn(this, ...args);
      };
  }
}
/**
 * Looks to run the memoized function with the builder pattern on the object if it exists, otherwise fall back to the static method passed in.
 */
function callMemoOrStaticFn(obj, fnKey, staticFn, ...args) {
  return obj[fnKey]?.(...args) ?? staticFn(obj, ...args);
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/cells/coreCellsFeature.utils.js
/**
 * Reads this cell's accessor value from its owning row and column.
 *
 * This is the standalone implementation behind `cell.getValue()`, useful when
 * importing static APIs instead of calling methods from the cell prototype.
 *
 * @example
 * ```ts
 * const value = cell_getValue(cell)
 * ```
 */
function cell_getValue(cell) {
  return cell.row.getValue(cell.column.id);
}
/**
 * Reads the value that should be rendered for this cell.
 *
 * Nullish accessor values are replaced with `table.options.renderFallbackValue`,
 * matching the behavior of `cell.renderValue()`.
 *
 * @example
 * ```ts
 * const rendered = cell_renderValue(cell)
 * ```
 */
function cell_renderValue(cell) {
  return cell.getValue() ?? cell.table.options.renderFallbackValue;
}
/**
 * Builds the render context passed to a column's `cell` template.
 *
 * The returned object includes stable references to the table, row, column, and
 * cell, plus bound `getValue` and `renderValue` helpers for render functions.
 *
 * @example
 * ```ts
 * const context = cell_getContext(cell)
 * ```
 */
function cell_getContext(cell) {
  return {
    table: cell.table,
    column: cell.column,
    row: cell.row,
    cell,
    getValue: () => cell.getValue(),
    renderValue: () => cell.renderValue(),
  };
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/cells/coreCellsFeature.js
/**
 * Core feature that adds cell value, render, and context APIs.
 */
var coreCellsFeature = {
  assignCellPrototype: (prototype, table) => {
    assignPrototypeAPIs("coreCellsFeature", prototype, table, {
      cell_getValue: { fn: (cell) => cell_getValue(cell) },
      cell_renderValue: { fn: (cell) => cell_renderValue(cell) },
      cell_getContext: {
        fn: (cell) => cell_getContext(cell),
        memoDeps: (cell) => [cell],
      },
    });
  },
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/headers/constructHeader.js
/**
 * Creates or retrieves the header prototype for a table.
 * The prototype is cached on the table and shared by all header instances.
 */
function getHeaderPrototype(table) {
  if (!table._headerPrototype) {
    table._headerPrototype = { table };
    const features = Object.values(table._features);
    for (let i = 0; i < features.length; i++)
      features[i].assignHeaderPrototype?.(table._headerPrototype, table);
  }
  return table._headerPrototype;
}
/**
 * Constructs a header instance from normalized table internals.
 *
 * This wires core properties, feature prototype APIs, and instance data used by table rendering and row-model operations.
 */
function constructHeader(table, column, options) {
  const headerPrototype = getHeaderPrototype(table);
  const header = Object.create(headerPrototype);
  header.colSpan = 0;
  header.column = column;
  header.depth = options.depth;
  header.headerGroup = null;
  header.id = options.id ?? column.id;
  header.index = options.index;
  header.isPlaceholder = !!options.isPlaceholder;
  header.placeholderId = options.placeholderId;
  header.rowSpan = 0;
  header.subHeaders = [];
  const initFns = table._headerInstanceInitFns;
  for (let i = 0; i < initFns.length; i++) initFns[i](header);
  return header;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/featureStubs.js
/**
 * Stubs for optional features, used by the core and by row models that
 * another feature owns.
 *
 * Importing a feature's utils from shared code would bundle that feature into
 * every table that uses the shared code, registered or not. Each stub calls
 * the API the feature registers on the table or column when it is present,
 * and otherwise behaves as if the feature were absent.
 *
 * Internal: not exported from any package entry point.
 */
/** Whether a column is visible; every column is without the feature. */
function getIsColumnVisible(column) {
  return column.getIsVisible?.() ?? true;
}
/** Visible leaf columns; all leaf columns without the feature. */
function getVisibleLeafColumns(table) {
  return table.getVisibleLeafColumns?.() ?? table.getAllLeafColumns();
}
/** Resets expanded state if row expanding is registered. */
function autoResetExpanded(table) {
  table.autoResetExpanded?.();
}
/** Resets the page index if row pagination is registered. */
function autoResetPageIndex(table) {
  table.autoResetPageIndex?.();
}
/** Resets sorting if row sorting is registered. */
function autoResetSorting(table) {
  table.autoResetSorting?.();
}
/** Resets cell selection if cell selection is registered. */
function autoResetCellSelection(table) {
  table.autoResetCellSelection?.();
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/headers/buildHeaderGroups.js
function getMaxHeaderDepth(columns, depth = 1) {
  let maxDepth = depth;
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    if (getIsColumnVisible(column) && column.columns.length)
      maxDepth = Math.max(maxDepth, getMaxHeaderDepth(column.columns, depth + 1));
  }
  return maxDepth;
}
function formatHeaderGroupId(headerFamily, depth) {
  return headerFamily ? `${headerFamily}_${depth}` : String(depth);
}
function formatHeaderId(headerFamily, depth, columnId, childHeaderId) {
  let id = headerFamily ?? "";
  if (depth) id = id ? `${id}_${depth}` : String(depth);
  if (columnId) id = id ? `${id}_${columnId}` : columnId;
  if (childHeaderId) id = id ? `${id}_${childHeaderId}` : childHeaderId;
  return id;
}
function countPendingHeadersForColumn(headers, column) {
  let count = 0;
  for (let i = 0; i < headers.length; i++) if (headers[i].column === column) count++;
  return count;
}
function constructHeaderGroup(
  headersToGroup,
  depth,
  table,
  headerFamily,
  headerGroups,
  headerGroupInitFns,
) {
  const headerGroup = {
    depth,
    id: formatHeaderGroupId(headerFamily, depth),
    headers: [],
  };
  const pendingParentHeaders = [];
  for (let i = 0; i < headersToGroup.length; i++) {
    if (!(i in headersToGroup)) continue;
    const headerToGroup = headersToGroup[i];
    const latestPendingParentHeader = pendingParentHeaders[pendingParentHeaders.length - 1];
    const isLeafHeader = headerToGroup.column.depth === headerGroup.depth;
    let column;
    let isPlaceholder = false;
    if (isLeafHeader && headerToGroup.column.parent) column = headerToGroup.column.parent;
    else {
      column = headerToGroup.column;
      isPlaceholder = true;
    }
    if (latestPendingParentHeader && latestPendingParentHeader.column === column)
      latestPendingParentHeader.subHeaders.push(headerToGroup);
    else {
      const header = constructHeader(table, column, {
        id: formatHeaderId(headerFamily, depth, column.id, headerToGroup.id),
        isPlaceholder,
        placeholderId: isPlaceholder
          ? String(countPendingHeadersForColumn(pendingParentHeaders, column))
          : void 0,
        depth,
        index: pendingParentHeaders.length,
      });
      header.subHeaders.push(headerToGroup);
      pendingParentHeaders.push(header);
    }
    headerGroup.headers.push(headerToGroup);
    headerToGroup.headerGroup = headerGroup;
  }
  for (let i = 0; i < headerGroupInitFns.length; i++) headerGroupInitFns[i](headerGroup);
  headerGroups.push(headerGroup);
  if (depth > 0)
    constructHeaderGroup(
      pendingParentHeaders,
      depth - 1,
      table,
      headerFamily,
      headerGroups,
      headerGroupInitFns,
    );
}
function updateHeaderSpans(headers) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    if (!getIsColumnVisible(header.column)) continue;
    let colSpan = 0;
    if (header.subHeaders.length) {
      updateHeaderSpans(header.subHeaders);
      for (let j = 0; j < header.subHeaders.length; j++) {
        const child = header.subHeaders[j];
        if (!getIsColumnVisible(child.column)) continue;
        colSpan += child.colSpan;
      }
    } else colSpan = 1;
    header.colSpan = colSpan;
    if (
      header.isPlaceholder &&
      header.subHeaders.length === 1 &&
      header.subHeaders[0].column === header.column
    ) {
      let rowSpan = 1;
      let chainChild = header.subHeaders[0];
      while (chainChild) {
        chainChild.rowSpan = 0;
        rowSpan++;
        chainChild =
          chainChild.subHeaders.length === 1 && chainChild.subHeaders[0].column === header.column
            ? chainChild.subHeaders[0]
            : void 0;
      }
      header.rowSpan = rowSpan;
    } else header.rowSpan = 1;
  }
}
/**
 * Builds the nested header group structure for a table.
 *
 * The result accounts for visible leaf columns, pinned column groups, and placeholder headers needed to render multi-level headers.
 */
function buildHeaderGroups(allColumns, columnsToGroup, table, headerFamily) {
  const maxDepth = getMaxHeaderDepth(allColumns);
  const headerGroups = [];
  const headerGroupInitFns = table._headerGroupInstanceInitFns;
  const bottomHeaders = new Array(columnsToGroup.length);
  for (let i = 0; i < columnsToGroup.length; i++) {
    if (!(i in columnsToGroup)) continue;
    bottomHeaders[i] = constructHeader(table, columnsToGroup[i], {
      depth: maxDepth,
      index: i,
    });
  }
  constructHeaderGroup(
    bottomHeaders,
    maxDepth - 1,
    table,
    headerFamily,
    headerGroups,
    headerGroupInitFns,
  );
  headerGroups.reverse();
  updateHeaderSpans(headerGroups[0]?.headers ?? []);
  return headerGroups;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/columns/constructColumn.js
/**
 * Creates or retrieves the column prototype for a table.
 * The prototype is cached on the table and shared by all column instances.
 */
function getColumnPrototype(table) {
  if (!table._columnPrototype) {
    table._columnPrototype = { table };
    const features = Object.values(table._features);
    for (let i = 0; i < features.length; i++)
      features[i].assignColumnPrototype?.(table._columnPrototype, table);
  }
  return table._columnPrototype;
}
/**
 * Constructs a column instance from normalized table internals.
 *
 * This wires core properties, feature prototype APIs, and instance data used by table rendering and row-model operations.
 */
function constructColumn(table, columnDef, depth, parent) {
  const resolvedColumnDef = {
    ...table.getDefaultColumnDef(),
    ...columnDef,
  };
  const accessorKey = resolvedColumnDef.accessorKey;
  const accessorKeyString = accessorKey === void 0 ? void 0 : String(accessorKey);
  const id =
    resolvedColumnDef.id ??
    accessorKeyString?.replaceAll(".", "_") ??
    (typeof resolvedColumnDef.header === "string" ? resolvedColumnDef.header : void 0);
  let accessorFn;
  if (resolvedColumnDef.accessorFn) accessorFn = resolvedColumnDef.accessorFn;
  else if (accessorKey !== void 0) {
    if (typeof accessorKey === "string" && accessorKey.includes(".")) {
      const keys = accessorKey.split(".");
      accessorFn = (originalRow) => {
        let result = originalRow;
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          result = result?.[key];
        }
        return result;
      };
    } else accessorFn = (originalRow) => originalRow[resolvedColumnDef.accessorKey];
  }
  if (!id) throw new Error();
  const columnPrototype = getColumnPrototype(table);
  const column = Object.create(columnPrototype);
  column.accessorFn = accessorFn;
  column.columnDef = resolvedColumnDef;
  column.columns = [];
  column.depth = depth;
  column.id = `${String(id)}`;
  column.parent = parent;
  const initFns = table._columnInstanceInitFns;
  for (let i = 0; i < initFns.length; i++) initFns[i](column);
  return column;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/features/column-ordering/columnOrderingFeature.utils.js
/**
 * Creates the ordering function used to arrange leaf columns.
 *
 * The returned function applies `state.columnOrder`, preserves unspecified
 * columns in their original order, then delegates to grouping rules.
 *
 * @example
 * ```ts
 * const orderColumnsForTable = table_getOrderColumnsFn(table)
 * ```
 */
function table_getOrderColumnsFn(table) {
  const columnOrder = table.atoms.columnOrder?.get();
  return (columns) => {
    let orderedColumns = [];
    if (!columnOrder?.length) orderedColumns = columns;
    else {
      const remaining = /* @__PURE__ */ new Map();
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        remaining.set(column.id, column);
      }
      for (let i = 0; i < columnOrder.length; i++) {
        const id = columnOrder[i];
        const column = remaining.get(id);
        if (column) {
          orderedColumns.push(column);
          remaining.delete(id);
        }
      }
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        if (remaining.has(column.id)) orderedColumns.push(column);
      }
    }
    return orderColumns(table, orderedColumns);
  };
}
/**
 * Applies grouped-column placement rules to an already ordered leaf-column list.
 *
 * `groupedColumnMode: 'remove'` drops grouped columns from the list.
 * `groupedColumnMode: 'reorder'` moves grouped columns to the front in grouping
 * state order.
 *
 * @example
 * ```ts
 * const orderedColumns = orderColumns(table, leafColumns)
 * ```
 */
function orderColumns(table, leafColumns) {
  const grouping = table.atoms.grouping?.get() ?? [];
  const { groupedColumnMode } = table.options;
  if (!grouping.length || !groupedColumnMode) return leafColumns;
  const nonGroupingColumns = leafColumns.filter((col) => !grouping.includes(col.id));
  if (groupedColumnMode === "remove") return nonGroupingColumns;
  const leafColumnsById = /* @__PURE__ */ new Map();
  for (let i = 0; i < leafColumns.length; i++) {
    const col = leafColumns[i];
    leafColumnsById.set(col.id, col);
  }
  const groupingColumns = [];
  for (let i = 0; i < grouping.length; i++) {
    const col = leafColumnsById.get(grouping[i]);
    if (col) groupingColumns.push(col);
  }
  return [...groupingColumns, ...nonGroupingColumns];
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/columns/coreColumnsFeature.utils.js
/**
 * Flattens this column and every descendant column into a single array.
 *
 * Group columns appear before their child columns, which matches the normalized
 * column hierarchy produced during table construction.
 *
 * @example
 * ```ts
 * const flatColumns = column_getFlatColumns(column)
 * ```
 */
function column_getFlatColumns(column) {
  return [column, ...column.columns.flatMap((col) => col.getFlatColumns())];
}
/**
 * Collects the terminal leaf columns below this column.
 *
 * Group columns return their ordered descendants. Non-group columns return an
 * array containing only the column itself.
 *
 * @example
 * ```ts
 * const leafColumns = column_getLeafColumns(column)
 * ```
 */
function column_getLeafColumns(column) {
  if (column.columns.length) {
    const leafColumns = column.columns.flatMap((col) => col.getLeafColumns());
    return callMemoOrStaticFn(
      column.table,
      "getOrderColumnsFn",
      table_getOrderColumnsFn,
    )(leafColumns);
  }
  return [column];
}
/**
 * Merges built-in, feature, and user default column definitions.
 *
 * Built-in defaults provide a header and fallback cell renderer, feature
 * defaults can add feature-specific column options, and
 * `options.defaultColumn` wins last.
 *
 * @example
 * ```ts
 * const defaultColumn = table_getDefaultColumnDef(table)
 * ```
 */
function table_getDefaultColumnDef(table) {
  return {
    header: (props) => {
      const resolvedColumnDef = props.header.column.columnDef;
      if (resolvedColumnDef.accessorKey) return resolvedColumnDef.accessorKey;
      if (resolvedColumnDef.accessorFn) return resolvedColumnDef.id;
      return null;
    },
    cell: (props) => props.renderValue()?.toString?.() ?? null,
    ...Object.values(table._features).reduce((obj, feature) => {
      return Object.assign(obj, feature.getDefaultColumnDef?.());
    }, {}),
    ...table.options.defaultColumn,
  };
}
function constructColumns(table, columnDefs, parent, depth = 0) {
  const columns = new Array(columnDefs.length);
  for (let i = 0; i < columnDefs.length; i++) {
    if (!(i in columnDefs)) continue;
    const columnDef = columnDefs[i];
    const column = constructColumn(table, columnDef, depth, parent);
    const groupingColumnDef = columnDef;
    column.columns = groupingColumnDef.columns
      ? constructColumns(table, groupingColumnDef.columns, column, depth + 1)
      : [];
    columns[i] = column;
  }
  return columns;
}
/**
 * Normalizes `options.columns` into the table's nested column tree.
 *
 * Each column definition is constructed with its parent and depth, and group
 * column children are recursively constructed.
 *
 * @example
 * ```ts
 * const columns = table_getAllColumns(table)
 * ```
 */
function table_getAllColumns(table) {
  return constructColumns(table, table.options.columns);
}
/**
 * Flattens every table column, including group columns and leaf columns.
 *
 * Use this when parent/group columns must be included in addition to data leaf
 * columns.
 *
 * @example
 * ```ts
 * const flatColumns = table_getAllFlatColumns(table)
 * ```
 */
function table_getAllFlatColumns(table) {
  return table.getAllColumns().flatMap((column) => column.getFlatColumns());
}
/**
 * Builds an id lookup for every flat column in the table.
 *
 * Group columns and leaf columns are included. Later columns with the same id
 * replace earlier entries.
 *
 * @example
 * ```ts
 * const columnsById = table_getAllFlatColumnsById(table)
 * ```
 */
function table_getAllFlatColumnsById(table) {
  const result = makeObjectMap();
  const flatColumns = table.getAllFlatColumns();
  for (let i = 0; i < flatColumns.length; i++) {
    const column = flatColumns[i];
    result[column.id] = column;
  }
  return result;
}
/**
 * Collects all terminal leaf columns in their current table order.
 *
 * Column ordering features can reorder the collected leaves before the result
 * is returned.
 *
 * @example
 * ```ts
 * const leafColumns = table_getAllLeafColumns(table)
 * ```
 */
function table_getAllLeafColumns(table) {
  const leafColumns = table.getAllColumns().flatMap((c) => c.getLeafColumns());
  return callMemoOrStaticFn(table, "getOrderColumnsFn", table_getOrderColumnsFn)(leafColumns);
}
/**
 * Builds an id lookup for terminal leaf columns only.
 *
 * Parent/group columns are excluded, making this lookup appropriate for row
 * cells and feature state keyed by data columns.
 *
 * @example
 * ```ts
 * const leavesById = table_getAllLeafColumnsById(table)
 * ```
 */
function table_getAllLeafColumnsById(table) {
  const result = makeObjectMap();
  const leafColumns = table.getAllLeafColumns();
  for (let i = 0; i < leafColumns.length; i++) {
    const column = leafColumns[i];
    result[column.id] = column;
  }
  return result;
}
/**
 * Looks up a column by id from the flat column map.
 *
 * The lookup can return group columns or leaf columns. In development, a
 * missing id logs a warning to help catch stale column references.
 *
 * @example
 * ```ts
 * const column = table_getColumn(table, 'firstName')
 * ```
 */
function table_getColumn(table, columnId) {
  return table.getAllFlatColumnsById()[columnId];
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/columns/coreColumnsFeature.js
/**
 * Core feature that builds the column tree and exposes table/column APIs.
 */
var coreColumnsFeature = {
  assignColumnPrototype: (prototype, table) => {
    assignPrototypeAPIs("coreColumnsFeature", prototype, table, {
      column_getFlatColumns: {
        fn: (column) => column_getFlatColumns(column),
        memoDeps: (column) => [column.table.options.columns],
      },
      column_getLeafColumns: {
        fn: (column) => column_getLeafColumns(column),
        memoDeps: (column) => [
          column.table.atoms.columnOrder?.get(),
          column.table.atoms.grouping?.get(),
          column.table.options.columns,
          column.table.options.groupedColumnMode,
        ],
      },
    });
  },
  constructTableAPIs: (table) => {
    assignTableAPIs("coreColumnsFeature", table, {
      table_getDefaultColumnDef: {
        fn: () => table_getDefaultColumnDef(table),
        memoDeps: () => [table.options.defaultColumn],
      },
      table_getAllColumns: {
        fn: () => table_getAllColumns(table),
        memoDeps: () => [table.options.columns],
      },
      table_getAllFlatColumns: {
        fn: () => table_getAllFlatColumns(table),
        memoDeps: () => [table.options.columns],
      },
      table_getAllFlatColumnsById: {
        fn: () => table_getAllFlatColumnsById(table),
        memoDeps: () => [table.options.columns],
      },
      table_getAllLeafColumns: {
        fn: () => table_getAllLeafColumns(table),
        memoDeps: () => [
          table.atoms.columnOrder?.get(),
          table.atoms.grouping?.get(),
          table.options.columns,
          table.options.groupedColumnMode,
        ],
      },
      table_getAllLeafColumnsById: {
        fn: () => table_getAllLeafColumnsById(table),
        memoDeps: () => [table.getAllLeafColumns()],
      },
      table_getColumn: { fn: (columnId) => table_getColumn(table, columnId) },
    });
  },
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/headers/coreHeadersFeature.utils.js
function collectLeafHeaders(header, leafHeaders) {
  for (let i = 0; i < header.subHeaders.length; i++)
    collectLeafHeaders(header.subHeaders[i], leafHeaders);
  leafHeaders.push(header);
}
/**
 * Walks a header tree and collects all descendant leaf headers.
 *
 * The header itself is included after its descendants, matching the recursive
 * shape used by nested header groups.
 *
 * @example
 * ```ts
 * const leafHeaders = header_getLeafHeaders(header)
 * ```
 */
function header_getLeafHeaders(header) {
  const leafHeaders = [];
  collectLeafHeaders(header, leafHeaders);
  return leafHeaders;
}
/**
 * Builds the render context passed to a column's `header` or `footer` template.
 *
 * The context contains the header, its column, and the owning table instance.
 *
 * @example
 * ```ts
 * const context = header_getContext(header)
 * ```
 */
function header_getContext(header) {
  return {
    column: header.column,
    header,
    table: header.column.table,
  };
}
/**
 * Builds visible header groups for the current column tree.
 *
 * Column visibility and pinning are applied before groups are built. When no
 * columns are pinned, the fast path skips pin partitioning.
 *
 * @example
 * ```ts
 * const headerGroups = table_getHeaderGroups(table)
 * ```
 */
function table_getHeaderGroups(table) {
  const columnPinning = table.atoms.columnPinning?.get();
  const start = columnPinning?.start ?? [];
  const end = columnPinning?.end ?? [];
  const allColumns = table.getAllColumns();
  const leafColumns = getVisibleLeafColumns(table);
  if (!start.length && !end.length) return buildHeaderGroups(allColumns, leafColumns, table);
  const leafColumnsById = table.getAllLeafColumnsById();
  const leftColumns = [];
  for (let i = 0; i < start.length; i++) {
    const column = leafColumnsById[start[i]];
    if (column && getIsColumnVisible(column)) leftColumns.push(column);
  }
  const rightColumns = [];
  for (let i = 0; i < end.length; i++) {
    const column = leafColumnsById[end[i]];
    if (column && getIsColumnVisible(column)) rightColumns.push(column);
  }
  const centerColumns = leafColumns.filter(
    (column) => !start.includes(column.id) && !end.includes(column.id),
  );
  return buildHeaderGroups(allColumns, [...leftColumns, ...centerColumns, ...rightColumns], table);
}
/**
 * Builds footer groups by reversing the current header groups.
 *
 * Footer rendering uses the same header objects and grouping structure, but
 * renders them from leaf level back toward the root.
 *
 * @example
 * ```ts
 * const footerGroups = table_getFooterGroups(table)
 * ```
 */
function table_getFooterGroups(table) {
  return [...table.getHeaderGroups()].reverse();
}
/**
 * Flattens every header from every header group into one array.
 *
 * The result includes parent headers and placeholder headers, in header-group
 * order from top to bottom.
 *
 * @example
 * ```ts
 * const flatHeaders = table_getFlatHeaders(table)
 * ```
 */
function table_getFlatHeaders(table) {
  const headerGroups = table.getHeaderGroups();
  const result = [];
  for (let i = 0; i < headerGroups.length; i++) {
    const headers = headerGroups[i].headers;
    for (let j = 0; j < headers.length; j++) result.push(headers[j]);
  }
  return result;
}
/**
 * Collects only the leaf headers from the current header tree.
 *
 * Parent/group headers are skipped, making the result suitable for rendering
 * one header per visible leaf column.
 *
 * @example
 * ```ts
 * const leafHeaders = table_getLeafHeaders(table)
 * ```
 */
function table_getLeafHeaders(table) {
  const topHeaders = table.getHeaderGroups()[0]?.headers ?? [];
  const result = [];
  for (let i = 0; i < topHeaders.length; i++) {
    const leafHeaders = topHeaders[i].getLeafHeaders();
    for (let j = 0; j < leafHeaders.length; j++) result.push(leafHeaders[j]);
  }
  return result;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/headers/coreHeadersFeature.js
/**
 * Core feature that builds header groups and exposes header context APIs.
 */
var coreHeadersFeature = {
  assignHeaderPrototype: (prototype, table) => {
    assignPrototypeAPIs("coreHeadersFeature", prototype, table, {
      header_getLeafHeaders: {
        fn: (header) => header_getLeafHeaders(header),
        memoDeps: (header) => [header.column.table.options.columns],
      },
      header_getContext: {
        fn: (header) => header_getContext(header),
        memoDeps: (header) => [header.column.table.options.columns],
      },
    });
  },
  constructTableAPIs: (table) => {
    assignTableAPIs("coreHeadersFeature", table, {
      table_getHeaderGroups: {
        fn: () => table_getHeaderGroups(table),
        memoDeps: () => [
          table.options.columns,
          table.atoms.columnOrder?.get(),
          table.atoms.grouping?.get(),
          table.atoms.columnPinning?.get(),
          table.atoms.columnVisibility?.get(),
          table.options.groupedColumnMode,
        ],
      },
      table_getFooterGroups: {
        fn: () => table_getFooterGroups(table),
        memoDeps: () => [table.getHeaderGroups()],
      },
      table_getFlatHeaders: {
        fn: () => table_getFlatHeaders(table),
        memoDeps: () => [table.getHeaderGroups()],
      },
      table_getLeafHeaders: {
        fn: () => table_getLeafHeaders(table),
        memoDeps: () => [table.getHeaderGroups()],
      },
    });
  },
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/rows/constructRow.js
/**
 * Creates or retrieves the row prototype for a table.
 * The prototype is cached on the table and shared by all row instances.
 */
function getRowPrototype(table) {
  if (!table._rowPrototype) {
    table._rowPrototype = { table };
    const features = Object.values(table._features);
    for (let i = 0; i < features.length; i++)
      features[i].assignRowPrototype?.(table._rowPrototype, table);
  }
  return table._rowPrototype;
}
/**
 * Constructs a row instance from normalized table internals.
 *
 * This wires core properties, feature prototype APIs, and instance data used by table rendering and row-model operations.
 */
var constructRow = (table, id, original, rowIndex, depth, subRows, parentId) => {
  const rowPrototype = getRowPrototype(table);
  const row = Object.create(rowPrototype);
  row._displayIndexCache = -1;
  row._uniqueValuesCache = makeObjectMap();
  row._valuesCache = makeObjectMap();
  row.depth = depth;
  row.id = id;
  row.index = rowIndex;
  row.original = original;
  row.parentId = parentId;
  row.subRows = subRows ?? [];
  const initFns = table._rowInstanceInitFns;
  for (let i = 0; i < initFns.length; i++) initFns[i](row);
  return row;
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/row-models/createCoreRowModel.js
/**
 * Creates a memoized core row model factory.
 *
 * The factory reads the relevant table state atoms and options, then returns a row model function used by the table row-model pipeline.
 */
function createCoreRowModel() {
  return (table) => {
    return tableMemo({
      feature: "coreRowModelsFeature",
      table,
      fnName: "table.getCoreRowModel",
      memoDeps: () => [table.options.data],
      fn: () => _createCoreRowModel(table, table.options.data),
      onAfterUpdate: skipFirstRun(() => {
        autoResetExpanded(table);
        autoResetPageIndex(table);
        autoResetSorting(table);
        autoResetCellSelection(table);
      }),
    });
  };
}
function accessRows(table, rowModel, originalRows, depth = 0, parentRow) {
  const rows = [];
  for (let i = 0; i < originalRows.length; i++) {
    const originalRow = originalRows[i];
    const row = constructRow(
      table,
      table.getRowId(originalRow, i, parentRow),
      originalRow,
      i,
      depth,
      void 0,
      parentRow?.id,
    );
    rowModel.flatRows.push(row);
    rowModel.rowsById[row.id] = row;
    rows.push(row);
    if (table.options.getSubRows) {
      row.originalSubRows = table.options.getSubRows(originalRow, i);
      if (row.originalSubRows?.length)
        row.subRows = accessRows(table, rowModel, row.originalSubRows, depth + 1, row);
    }
  }
  return rows;
}
function _createCoreRowModel(table, data) {
  const rowModel = {
    rows: [],
    flatRows: [],
    rowsById: makeObjectMap(),
  };
  rowModel.rows = accessRows(table, rowModel, data);
  return rowModel;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/row-models/coreRowModelsFeature.utils.js
/**
 * Resolves the table's unmodified core row model.
 *
 * The factory is created once per table, either from the `coreRowModel` slot on the `features` option
 * or the built-in `createCoreRowModel()`, then reused for later calls.
 *
 * @example
 * ```ts
 * const coreRows = table_getCoreRowModel(table)
 * ```
 */
function table_getCoreRowModel(table) {
  if (!table._rowModels.coreRowModel)
    table._rowModels.coreRowModel =
      table.options.features.coreRowModel?.(table) ?? createCoreRowModel()(table);
  return table._rowModels.coreRowModel();
}
/**
 * Reads the row model immediately before column/global filtering.
 *
 * Filtering is the first derived row-model stage, so this currently aliases
 * `table.getCoreRowModel()`.
 *
 * @example
 * ```ts
 * const rowsBeforeFiltering = table_getPreFilteredRowModel(table)
 * ```
 */
function table_getPreFilteredRowModel(table) {
  return table.getCoreRowModel();
}
/**
 * Resolves the row model after column and global filtering.
 *
 * When `manualFiltering` is enabled, or no filtered row-model factory was
 * registered, this returns the pre-filtered row model because filtering is
 * expected to happen outside the table.
 *
 * @example
 * ```ts
 * const filteredRows = table_getFilteredRowModel(table)
 * ```
 */
function table_getFilteredRowModel(table) {
  if (!table._rowModels.filteredRowModel)
    table._rowModels.filteredRowModel = table.options.features.filteredRowModel?.(table);
  if (table.options.manualFiltering || !table._rowModels.filteredRowModel)
    return table.getPreFilteredRowModel();
  return table._rowModels.filteredRowModel();
}
/**
 * Reads the row model immediately before grouping.
 *
 * Grouping runs after filtering, so this aliases `table.getFilteredRowModel()`.
 *
 * @example
 * ```ts
 * const rowsBeforeGrouping = table_getPreGroupedRowModel(table)
 * ```
 */
function table_getPreGroupedRowModel(table) {
  return table.getFilteredRowModel();
}
/**
 * Resolves the row model after grouping has produced grouped rows.
 *
 * When `manualGrouping` is enabled, or no grouped row-model factory was
 * registered, this returns the pre-grouped row model unchanged.
 *
 * @example
 * ```ts
 * const groupedRows = table_getGroupedRowModel(table)
 * ```
 */
function table_getGroupedRowModel(table) {
  if (!table._rowModels.groupedRowModel)
    table._rowModels.groupedRowModel = table.options.features.groupedRowModel?.(table);
  if (table.options.manualGrouping || !table._rowModels.groupedRowModel)
    return table.getPreGroupedRowModel();
  return table._rowModels.groupedRowModel();
}
/**
 * Reads the row model immediately before sorting.
 *
 * Sorting runs after grouping, so this aliases `table.getGroupedRowModel()`.
 *
 * @example
 * ```ts
 * const rowsBeforeSorting = table_getPreSortedRowModel(table)
 * ```
 */
function table_getPreSortedRowModel(table) {
  return table.getGroupedRowModel();
}
/**
 * Resolves the row model after sorting has been applied.
 *
 * When `manualSorting` is enabled, or no sorted row-model factory was
 * registered, this returns the pre-sorted row model because sorted data is
 * expected to be supplied by the caller.
 *
 * @example
 * ```ts
 * const sortedRows = table_getSortedRowModel(table)
 * ```
 */
function table_getSortedRowModel(table) {
  if (!table._rowModels.sortedRowModel)
    table._rowModels.sortedRowModel = table.options.features.sortedRowModel?.(table);
  if (table.options.manualSorting || !table._rowModels.sortedRowModel)
    return table.getPreSortedRowModel();
  return table._rowModels.sortedRowModel();
}
/**
 * Reads the row model immediately before row expansion.
 *
 * Expansion runs after sorting, so this aliases `table.getSortedRowModel()`.
 *
 * @example
 * ```ts
 * const rowsBeforeExpansion = table_getPreExpandedRowModel(table)
 * ```
 */
function table_getPreExpandedRowModel(table) {
  return table.getSortedRowModel();
}
/**
 * Resolves the row model after expanded rows have been flattened into view.
 *
 * When `manualExpanding` is enabled, or no expanded row-model factory was
 * registered, this returns the pre-expanded row model unchanged.
 *
 * @example
 * ```ts
 * const expandedRows = table_getExpandedRowModel(table)
 * ```
 */
function table_getExpandedRowModel(table) {
  if (!table._rowModels.expandedRowModel)
    table._rowModels.expandedRowModel = table.options.features.expandedRowModel?.(table);
  if (table.options.manualExpanding || !table._rowModels.expandedRowModel)
    return table.getPreExpandedRowModel();
  return table._rowModels.expandedRowModel();
}
/**
 * Reads the row model immediately before pagination.
 *
 * Pagination is the final built-in row-model stage, so this aliases
 * `table.getExpandedRowModel()`.
 *
 * @example
 * ```ts
 * const rowsBeforePagination = table_getPrePaginatedRowModel(table)
 * ```
 */
function table_getPrePaginatedRowModel(table) {
  return table.getExpandedRowModel();
}
/**
 * Resolves the row model after pagination has sliced rows for the current page.
 *
 * When `manualPagination` is enabled, or no paginated row-model factory was
 * registered, this returns the pre-paginated row model because pagination is
 * expected to happen before data reaches the table.
 *
 * @example
 * ```ts
 * const pageRows = table_getPaginatedRowModel(table)
 * ```
 */
function table_getPaginatedRowModel(table) {
  if (!table._rowModels.paginatedRowModel)
    table._rowModels.paginatedRowModel = table.options.features.paginatedRowModel?.(table);
  if (table.options.manualPagination || !table._rowModels.paginatedRowModel)
    return table.getPrePaginatedRowModel();
  return table._rowModels.paginatedRowModel();
}
/**
 * Resolves the final row model consumed by renderers.
 *
 * This is the end of the built-in row-model pipeline: core -> filtering ->
 * grouping -> sorting -> expanding -> pagination.
 *
 * @example
 * ```ts
 * const visibleRows = table_getRowModel(table)
 * ```
 */
function table_getRowModel(table) {
  return table.getPaginatedRowModel();
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/row-models/coreRowModelsFeature.js
/**
 * Core feature that wires table row-model accessors and row-model caches.
 */
var coreRowModelsFeature = {
  constructTableAPIs: (table) => {
    assignTableAPIs("coreRowModelsFeature", table, {
      table_getCoreRowModel: { fn: () => table_getCoreRowModel(table) },
      table_getPreFilteredRowModel: { fn: () => table_getPreFilteredRowModel(table) },
      table_getFilteredRowModel: { fn: () => table_getFilteredRowModel(table) },
      table_getPreGroupedRowModel: { fn: () => table_getPreGroupedRowModel(table) },
      table_getGroupedRowModel: { fn: () => table_getGroupedRowModel(table) },
      table_getPreSortedRowModel: { fn: () => table_getPreSortedRowModel(table) },
      table_getSortedRowModel: { fn: () => table_getSortedRowModel(table) },
      table_getPreExpandedRowModel: { fn: () => table_getPreExpandedRowModel(table) },
      table_getExpandedRowModel: { fn: () => table_getExpandedRowModel(table) },
      table_getPrePaginatedRowModel: { fn: () => table_getPrePaginatedRowModel(table) },
      table_getPaginatedRowModel: { fn: () => table_getPaginatedRowModel(table) },
      table_getRowModel: { fn: () => table_getRowModel(table) },
    });
  },
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/cells/constructCell.js
/**
 * Creates or retrieves the cell prototype for a table.
 * The prototype is cached on the table and shared by all cell instances.
 */
function getCellPrototype(table) {
  if (!table._cellPrototype) {
    table._cellPrototype = { table };
    const features = Object.values(table._features);
    for (let i = 0; i < features.length; i++)
      features[i].assignCellPrototype?.(table._cellPrototype, table);
  }
  return table._cellPrototype;
}
/**
 * Constructs a cell instance from normalized table internals.
 *
 * This wires core properties, feature prototype APIs, and instance data used by table rendering and row-model operations.
 */
function constructCell(column, row, table) {
  const cellPrototype = getCellPrototype(table);
  const cell = Object.create(cellPrototype);
  cell.column = column;
  cell.id = `${row.id}_${column.id}`;
  cell.row = row;
  const initFns = table._cellInstanceInitFns;
  for (let i = 0; i < initFns.length; i++) initFns[i](cell);
  return cell;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/rows/coreRowsFeature.utils.js
/**
 * Returns this row's zero-based position in the current pre-pagination row
 * model. Rows outside that model return `-1`.
 */
function row_getDisplayIndex(row) {
  const rows = row.table.getRowsInDisplayOrder();
  const displayIndex = row._displayIndexCache;
  return rows[displayIndex] === row ? displayIndex : -1;
}
/**
 * Returns the rows in the current display order after assigning their
 * zero-based display indexes.
 *
 * When expanded rows bypass pagination, expanded descendants are inserted into
 * the returned order even though they are absent from the pre-pagination row
 * model.
 */
function table_getRowsInDisplayOrder(table) {
  const rows = table.getPrePaginatedRowModel().rows;
  if (table.options.paginateExpandedRows === false) {
    const displayRows = [];
    const handleRow = (row) => {
      row._displayIndexCache = displayRows.length;
      displayRows.push(row);
      if (row.subRows.length && row.getIsExpanded?.()) row.subRows.forEach(handleRow);
    };
    rows.forEach(handleRow);
    return displayRows;
  }
  for (let i = 0; i < rows.length; i++) rows[i]._displayIndexCache = i;
  return rows;
}
/**
 * Reads and caches this row's value for a column.
 *
 * The value is produced by the column accessor. Missing columns or display
 * columns without an accessor return `undefined`.
 *
 * @example
 * ```ts
 * const firstName = row_getValue(row, 'firstName')
 * ```
 */
function row_getValue(row, columnId) {
  if (hasOwn(row._valuesCache, columnId)) return row._valuesCache[columnId];
  const column = row.table.getColumn(columnId);
  if (!column?.accessorFn) return;
  row._valuesCache[columnId] = column.accessorFn(row.original, row.index);
  return row._valuesCache[columnId];
}
/**
 * Reads and caches the values used by faceting/grouping for a column.
 *
 * If the column defines `getUniqueValues`, that result is used. Otherwise the
 * row's accessor value is wrapped in a single-item array.
 *
 * @example
 * ```ts
 * const values = row_getUniqueValues(row, 'tags')
 * ```
 */
function row_getUniqueValues(row, columnId) {
  if (hasOwn(row._uniqueValuesCache, columnId)) return row._uniqueValuesCache[columnId];
  const column = row.table.getColumn(columnId);
  if (!column?.accessorFn) return;
  if (!column.columnDef.getUniqueValues) {
    row._uniqueValuesCache[columnId] = [row.getValue(columnId)];
    return row._uniqueValuesCache[columnId];
  }
  row._uniqueValuesCache[columnId] = column.columnDef.getUniqueValues(row.original, row.index);
  return row._uniqueValuesCache[columnId];
}
/**
 * Returns a renderable row value for a column.
 *
 * If the accessor value is nullish, the table's `renderFallbackValue` is used
 * instead.
 *
 * @example
 * ```ts
 * const value = row_renderValue(row, 'firstName')
 * ```
 */
function row_renderValue(row, columnId) {
  return row.getValue(columnId) ?? row.table.options.renderFallbackValue;
}
/**
 * Flattens this row's descendant tree into leaf rows.
 *
 * The row itself is not included; only nested `subRows` are walked.
 *
 * @example
 * ```ts
 * const descendants = row_getLeafRows(row)
 * ```
 */
function row_getLeafRows(row) {
  return flattenBy(row.subRows, (d) => d.subRows);
}
/**
 * Returns the deepest structural row depth in the core row model.
 * Root rows are depth `0`, their direct sub-rows are depth `1`, and so on.
 */
function table_getMaxSubRowDepth(table) {
  const rows = table.getCoreRowModel().flatRows;
  let maxDepth = 0;
  for (let i = 0; i < rows.length; i++) maxDepth = Math.max(maxDepth, rows[i].depth);
  return maxDepth;
}
/**
 * Looks up this row's direct parent, if it has one.
 *
 * Parent lookup prefers the core row model for structural parents, then falls
 * back to the pre-pagination row model for generated parent rows.
 *
 * @example
 * ```ts
 * const parent = row_getParentRow(row)
 * ```
 */
function row_getParentRow(row) {
  if (!row.parentId) return;
  return row.table.getCoreRowModel().rowsById[row.parentId] ?? row.table.getRow(row.parentId, true);
}
/**
 * Collects this row's ancestor chain from root to direct parent.
 *
 * The current row is not included. Rows without a parent return an empty array.
 *
 * @example
 * ```ts
 * const ancestors = row_getParentRows(row)
 * ```
 */
function row_getParentRows(row) {
  const parentRows = [];
  let currentRow = row;
  while (true) {
    const parentRow = currentRow.getParentRow();
    if (!parentRow) break;
    parentRows.push(parentRow);
    currentRow = parentRow;
  }
  return parentRows.reverse();
}
/**
 * Constructs one cell for each leaf column in this row.
 *
 * The result follows `table.getAllLeafColumns()` order and includes hidden
 * columns; visibility-specific APIs filter this list later.
 *
 * @example
 * ```ts
 * const cells = row_getAllCells(row)
 * ```
 */
function row_getAllCells(row) {
  const columns = row.table.getAllLeafColumns();
  let cache = row._cellsCache;
  if (!cache) cache = row._cellsCache = /* @__PURE__ */ new WeakMap();
  const cells = new Array(columns.length);
  for (let i = 0; i < columns.length; i++) {
    const column = columns[i];
    let cell = cache.get(column);
    if (!cell) {
      cell = constructCell(column, row, row.table);
      cache.set(column, cell);
    }
    cells[i] = cell;
  }
  return cells;
}
/**
 * Builds a lookup map of this row's cells keyed by column id.
 *
 * This is the static implementation behind `row.getAllCellsByColumnId()`.
 *
 * @example
 * ```ts
 * const cellsById = row_getAllCellsByColumnId(row)
 * ```
 */
function row_getAllCellsByColumnId(row) {
  const result = makeObjectMap();
  const cells = row.getAllCells();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    result[cell.column.id] = cell;
  }
  return result;
}
/**
 * Resolves the stable id for a row.
 *
 * `options.getRowId` wins when provided. Otherwise root rows use their index
 * and child rows append their index to the parent id, such as `0.2`.
 *
 * @example
 * ```ts
 * const id = table_getRowId(originalRow, table, index, parentRow)
 * ```
 */
function table_getRowId(originalRow, table, index, parent) {
  return (
    table.options.getRowId?.(originalRow, index, parent) ??
    (parent ? `${parent.id}.${index}` : String(index))
  );
}
/**
 * Looks up a row by id from the current or full row model.
 *
 * By default this searches `table.getRowModel()`. Passing `searchAll` searches
 * the pre-pagination model first, then falls back to the core model.
 *
 * @example
 * ```ts
 * const row = table_getRow(table, rowId, true)
 * ```
 */
function table_getRow(table, rowId, searchAll) {
  let row = (searchAll ? table.getPrePaginatedRowModel() : table.getRowModel()).rowsById[rowId];
  if (!row) {
    row = table.getCoreRowModel().rowsById[rowId];
    if (!row) throw new Error();
  }
  return row;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/rows/coreRowsFeature.js
/**
 * Core feature that creates row APIs for values, cells, and tree traversal.
 */
var coreRowsFeature = {
  assignRowPrototype: (prototype, table) => {
    assignPrototypeAPIs("coreRowsFeature", prototype, table, {
      row_getDisplayIndex: { fn: (row) => row_getDisplayIndex(row) },
      row_getAllCellsByColumnId: {
        fn: (row) => row_getAllCellsByColumnId(row),
        memoDeps: (row) => [row.getAllCells()],
      },
      row_getAllCells: {
        fn: (row) => row_getAllCells(row),
        memoDeps: (row) => [row.table.getAllLeafColumns()],
      },
      row_getLeafRows: {
        fn: (row) => row_getLeafRows(row),
        memoDeps: (row) => [row.subRows],
      },
      row_getParentRow: { fn: (row) => row_getParentRow(row) },
      row_getParentRows: { fn: (row) => row_getParentRows(row) },
      row_getUniqueValues: { fn: (row, columnId) => row_getUniqueValues(row, columnId) },
      row_getValue: { fn: (row, columnId) => row_getValue(row, columnId) },
      row_renderValue: { fn: (row, columnId) => row_renderValue(row, columnId) },
    });
  },
  constructTableAPIs: (table) => {
    assignTableAPIs("coreRowsFeature", table, {
      table_getRowsInDisplayOrder: {
        fn: () => table_getRowsInDisplayOrder(table),
        memoDeps: () => [
          table.getPrePaginatedRowModel().rows,
          table.options.paginateExpandedRows,
          table.options.paginateExpandedRows === false ? table.atoms.expanded?.get() : void 0,
        ],
      },
      table_getRowId: {
        fn: (originalRow, index, parent) => table_getRowId(originalRow, table, index, parent),
      },
      table_getRow: { fn: (id, searchAll) => table_getRow(table, id, searchAll) },
      table_getMaxSubRowDepth: {
        fn: () => table_getMaxSubRowDepth(table),
        memoDeps: () => [table.getCoreRowModel()],
      },
    });
  },
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/table/coreTablesFeature.utils.js
/**
 * Synchronizes externally controlled state slices into the table's base atoms.
 *
 * This keeps `options.state` values mirrored in the atom graph so derived
 * atoms, stores, and table APIs read a consistent snapshot.
 *
 * Adapters that update options during their host's render phase pass the
 * state snapshot captured by the committed render as `capturedState` — the
 * shared options object may already hold values from a newer render that
 * never commits. Pass `null` to publish nothing (a captured "no controlled
 * state"); omitting the argument reads the current `table.options.state`
 * instead. An optional `compare` suppresses semantically unchanged slice
 * writes; the default remains reference equality.
 *
 * @example
 * ```ts
 * table_syncExternalStateToBaseAtoms(table)
 * table_syncExternalStateToBaseAtoms(table, capturedState ?? null, shallow)
 * ```
 */
function table_syncExternalStateToBaseAtoms(
  table,
  capturedState,
  compare = (currentState, externalState) => currentState === externalState,
) {
  const state = capturedState === void 0 ? table.options.state : capturedState;
  table._reactivity.batch(() => {
    if (state)
      for (const key in state) {
        const baseAtom = table.baseAtoms[key];
        if (!baseAtom) continue;
        const rawExternalState = state[key];
        const externalState =
          rawExternalState === void 0 ? table.initialState[key] : rawExternalState;
        if (
          !compare(
            table._reactivity.untrack(() => baseAtom.get()),
            externalState,
          )
        )
          baseAtom.set(() => externalState);
      }
  });
}
/**
 * Publishes captured controlled state after a host framework commits.
 *
 * Render-phase adapters stage options without synchronizing base atoms, then
 * pass the state captured by the committed render here. The commit signal also
 * invalidates ownership changes when no base atom was written.
 */
function table_publishExternalState(
  table,
  state,
  compare = (currentState, externalState) => currentState === externalState,
) {
  table._reactivity.batch(() => {
    table_syncExternalStateToBaseAtoms(table, state, compare);
    table._reactivity.commit?.();
  });
}
/**
 * Resets all internal table base atoms to `table.initialState`, then clears
 * transient instance data through registered feature reset hooks.
 *
 * This resets internally owned state slices in a single reactivity batch. Use
 * feature-specific reset APIs when a slice may be externally owned.
 *
 * @example
 * ```ts
 * table_reset(table)
 * ```
 */
function table_reset(table) {
  const snap = cloneState(table.initialState);
  table._reactivity.batch(() => {
    const keys = Object.keys(snap);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      table.baseAtoms[key].set(snap[key]);
    }
  });
  const features = Object.values(table._features);
  for (let i = 0; i < features.length; i++) features[i].resetTableInstanceData?.(table);
}
/**
 * Merges new table options with the current resolved options.
 *
 * If `options.mergeOptions` is provided, it owns the merge behavior; otherwise
 * options are shallow-merged. Static options that should never change after
 * initialization are restored on a fresh object so framework merge helpers may
 * return readonly getter/proxy objects.
 *
 * @example
 * ```ts
 * const options = table_mergeOptions(table, nextOptions)
 * ```
 */
function table_mergeOptions(table, newOptions) {
  const { features, atoms, initialState } = table.options;
  if (!table.options.mergeOptions)
    return {
      ...table.options,
      ...newOptions,
      features,
      atoms,
      initialState,
    };
  const mergedOptions = table.options.mergeOptions(table.options, newOptions);
  const descriptors = { ...Object.getOwnPropertyDescriptors(mergedOptions) };
  return Object.defineProperties(Object.create(Object.getPrototypeOf(mergedOptions)), {
    ...descriptors,
    features: {
      value: features,
      enumerable: true,
      configurable: true,
      writable: true,
    },
    atoms: {
      value: atoms,
      enumerable: true,
      configurable: true,
      writable: true,
    },
    initialState: {
      value: initialState,
      enumerable: true,
      configurable: true,
      writable: true,
    },
  });
}
/**
 * Updates the table options object.
 *
 * The updater receives the current resolved options and the merged result is
 * immediately assigned to the table instance.
 *
 * @example
 * ```ts
 * table_setOptions(table, (old) => old)
 * table_setOptions(table, (old) => old, { syncExternalState: false })
 * ```
 */
function table_setOptions(table, updater, options) {
  const mergedOptions = table_mergeOptions(table, functionalUpdate(updater, table.options));
  if (table.optionsStore) table.optionsStore.set(() => mergedOptions);
  else table.options = mergedOptions;
  if (options?.syncExternalState !== false)
    table_publishExternalState(table, mergedOptions.state ?? null);
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/coreFeatures.js
/**
 * The built-in core feature set required by every table.
 *
 * These features provide table, column, row, header, cell, and core row-model behavior before optional feature plugins are added.
 */
var coreFeatures = {
  coreCellsFeature,
  coreColumnsFeature,
  coreHeadersFeature,
  coreRowModelsFeature,
  coreRowsFeature,
  coreTablesFeature: {
    constructTableAPIs: (table) => {
      assignTableAPIs("coreTablesFeature", table, {
        table_reset: { fn: () => table_reset(table) },
        table_setOptions: { fn: (updater) => table_setOptions(table, updater) },
      });
    },
  },
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/helpers/metaHelper.js
/**
 * A helper for declaring the `tableMeta`/`columnMeta` type-only slots in the
 * `features` option without a type assertion.
 *
 * Equivalent to `{} as TMeta`, but reads as type-only at the call site and
 * avoids `@typescript-eslint/no-unnecessary-type-assertion` false positives
 * when the meta type has only optional properties (where an auto-fix removing
 * the assertion would silently degrade the inferred meta type to `{}`).
 *
 * The returned value is a phantom — it is ignored and stripped from the
 * table's registered features at runtime; only its type is used.
 * @example
 * ```
 * import { metaHelper, tableFeatures, rowSortingFeature } from '@tanstack/react-table'
 * const features = tableFeatures({
 *   rowSortingFeature,
 *   tableMeta: metaHelper<MyTableMeta>(),
 *   columnMeta: metaHelper<MyColumnMeta>(),
 * });
 * ```
 */
function metaHelper() {
  return {};
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/helpers/tableFeatures.js
/**
 * A helper function to help define the features that are to be imported and applied to a table instance.
 * Use this utility to make it easier to have the correct type inference for the features that are being imported.
 * **Note:** It is recommended to use this utility statically outside of a component.
 *
 * Alongside feature modules, this object carries everything else that is
 * statically stitched into the table:
 *
 * - Row model factories (`sortedRowModel`, `filteredRowModel`, etc.)
 * - Row model function registries (`sortFns`, `filterFns`, `aggregationFns`),
 *   whose keys become the valid string values for `sortFn`, `filterFn`,
 *   `globalFilterFn`, and `aggregationFn` with full inference
 * - Type-only `tableMeta`/`columnMeta` slots for declaring per-table meta types
 *   instead of using global declaration merging. The values are phantom
 *   (ignored and stripped at runtime); only their types are used.
 * @example
 * ```
 * import {
 *   columnFilteringFeature,
 *   createFilteredRowModel,
 *   createSortedRowModel,
 *   filterFn_includesString,
 *   rowSortingFeature,
 *   sortFn_alphanumeric,
 *   sortFn_text,
 *   tableFeatures,
 * } from '@tanstack/react-table'
 * const features = tableFeatures({
 *   columnFilteringFeature,
 *   rowSortingFeature,
 *   filteredRowModel: createFilteredRowModel(),
 *   sortedRowModel: createSortedRowModel(),
 *   filterFns: { includesString: filterFn_includesString, myCustomFilterFn },
 *   sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text },
 *   tableMeta: {} as { updateData: (rowIndex: number, columnId: string, value: unknown) => void },
 *   columnMeta: {} as { align?: 'left' | 'right' },
 * });
 * const table = useTable({ features, columns, data });
 * ```
 */
function tableFeatures(features) {
  return features;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+table-core@9.2.8/node_modules/@tanstack/table-core/dist/core/table/constructTable.js
/**
 * Builds the initial table state from registered features and user initial state.
 *
 * Each feature contributes its default state before user-provided `initialState` values are merged in.
 */
function getInitialTableState(features, initialState = {}) {
  Object.values(features).forEach((feature) => {
    initialState = feature.getInitialState?.(initialState) ?? initialState;
  });
  return cloneState(initialState);
}
/**
 * Constructs a table instance from normalized table internals.
 *
 * This wires core properties, feature prototype APIs, and instance data used by table rendering and row-model operations.
 */
function constructTable(tableOptions) {
  const _reactivity = tableOptions.features.coreReactivityFeature;
  const {
    aggregationFns,
    columnMeta: _columnMeta,
    coreRowModel,
    expandedRowModel,
    facetedMinMaxValues,
    facetedRowModel,
    facetedUniqueValues,
    filterFns,
    filterMeta: _filterMeta,
    filteredRowModel,
    groupedRowModel,
    paginatedRowModel,
    sortFns,
    sortedRowModel,
    tableMeta: _tableMeta,
    ...features
  } = tableOptions.features;
  const table = {
    _cellInstanceInitFns: [],
    _columnInstanceInitFns: [],
    _features: {
      ...coreFeatures,
      ...features,
    },
    _headerGroupInstanceInitFns: [],
    _headerInstanceInitFns: [],
    _reactivity,
    _rowInstanceInitFns: [],
    _rowModelFns: {
      aggregationFns,
      filterFns,
      sortFns,
    },
    _rowModels: {},
    atoms: {},
    baseAtoms: {},
  };
  const featuresList = Object.values(table._features);
  const mergedOptions = {
    ...featuresList.reduce((obj, feature) => {
      return Object.assign(obj, feature.getDefaultTableOptions?.(table));
    }, {}),
    ...tableOptions,
  };
  if (_reactivity.wrapExternalAtoms && mergedOptions.atoms)
    for (const [atomKey, _atom] of Object.entries(mergedOptions.atoms)) {
      const atom = _atom;
      const wrappedAtom = _reactivity.createWritableAtom(atom.get(), {
        debugName: `externalAtom/${atomKey}`,
      });
      mergedOptions.atoms[atomKey] = wrappedAtom;
      let syncExternal = false;
      const syncAtomToWrappedSub = atom.subscribe((value) => {
        if (syncExternal) return;
        wrappedAtom.set(value);
      });
      const syncWrappedToAtomSub = wrappedAtom.subscribe((value) => {
        syncExternal = true;
        atom.set(value);
        syncExternal = false;
      });
      _reactivity.addSubscription(syncAtomToWrappedSub);
      _reactivity.addSubscription(syncWrappedToAtomSub);
    }
  if (_reactivity.createOptionsStore) {
    table.optionsStore = _reactivity.createWritableAtom(mergedOptions, {
      debugName: "table/optionsStore",
    });
    Object.defineProperty(table, "options", {
      configurable: true,
      enumerable: true,
      get() {
        return table.optionsStore.get();
      },
      set(value) {
        table.optionsStore.set(() => value);
      },
    });
  } else table.options = mergedOptions;
  table.initialState = getInitialTableState(table._features, table.options.initialState);
  const stateKeys = Object.keys(table.initialState);
  for (let i = 0; i < stateKeys.length; i++) {
    const key = stateKeys[i];
    table.baseAtoms[key] = _reactivity.createWritableAtom(table.initialState[key], {
      debugName: `table/baseAtoms/${key}`,
    });
    table.atoms[key] = _reactivity.createReadonlyAtom(
      () => {
        const options = table.options;
        const externalAtom = options.atoms?.[key];
        const reactiveState = externalAtom ? externalAtom.get() : table.baseAtoms[key].get();
        if (externalAtom) return reactiveState;
        const controlledState = options.state;
        if (controlledState && hasOwn(controlledState, key)) {
          const controlledValue = controlledState[key];
          return controlledValue === void 0 ? table.initialState[key] : controlledValue;
        }
        return reactiveState;
      },
      { debugName: `table/atoms/${key}` },
    );
  }
  table_syncExternalStateToBaseAtoms(table);
  table.store = atomToStore(
    _reactivity.createReadonlyAtom(
      () => {
        const snapshot = {};
        for (let i = 0; i < stateKeys.length; i++) {
          const key = stateKeys[i];
          snapshot[key] = table.atoms[key].get();
        }
        return snapshot;
      },
      {
        compare: shallow,
        debugName: "table/store",
      },
    ),
  );
  for (let i = 0; i < featuresList.length; i++) {
    const feature = featuresList[i];
    feature.initTableInstanceData?.(table);
    if (feature.initCellInstanceData)
      table._cellInstanceInitFns.push(feature.initCellInstanceData.bind(feature));
    if (feature.initColumnInstanceData)
      table._columnInstanceInitFns.push(feature.initColumnInstanceData.bind(feature));
    if (feature.initHeaderGroupInstanceData)
      table._headerGroupInstanceInitFns.push(feature.initHeaderGroupInstanceData.bind(feature));
    if (feature.initHeaderInstanceData)
      table._headerInstanceInitFns.push(feature.initHeaderInstanceData.bind(feature));
    if (feature.initRowInstanceData)
      table._rowInstanceInitFns.push(feature.initRowInstanceData.bind(feature));
    feature.constructTableAPIs?.(table);
  }
  return table;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-table@9.2.8_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-table/dist/useTable.js
var useIsomorphicLayoutEffect$1 =
  typeof window === "undefined" ? import_react.useEffect : import_react.useLayoutEffect;
/**
 * Creates a React table instance backed by TanStack Store atoms.
 *
 * The optional selector projects from `table.store`; the selected value is
 * exposed on `table.state` and compared shallowly for React re-renders. Omit
 * the selector to subscribe to every registered table state slice, or pass a
 * narrower selector and use `table.Subscribe` lower in the tree for targeted
 * subscriptions.
 *
 * @example
 * ```tsx
 * const table = useTable(
 *   {
 *     features,
 *     columns,
 *     data,
 *   },
 *   (state) => ({ pagination: state.pagination }),
 * )
 *
 * table.state.pagination
 * ```
 */
function useTable(tableOptions, selector) {
  const [{ table, rootSource }] = (0, import_react.useState)(() => {
    const tableInstance = constructTable({
      ...tableOptions,
      features: {
        coreReactivityFeature: reactReactivity(),
        ...tableOptions.features,
      },
    });
    tableInstance.Subscribe = (props) => {
      return Subscribe({
        ...props,
        source: props.source ?? tableInstance.store,
      });
    };
    tableInstance.FlexRender = FlexRender;
    return {
      table: tableInstance,
      rootSource: createRenderPhaseSource(tableInstance.store, shallow),
    };
  });
  const coreTable = table;
  table_setOptions(
    coreTable,
    (prev) => ({
      ...prev,
      ...tableOptions,
    }),
    { syncExternalState: false },
  );
  const controlledState = coreTable.options.state;
  const renderSnapshot = rootSource.get();
  const state = useSelector(rootSource, selector, { compare: shallow });
  useIsomorphicLayoutEffect$1(() => {
    rootSource.markCommitted(renderSnapshot);
    table_publishExternalState(coreTable, controlledState ?? null, shallow);
  });
  return (0, import_react.useMemo)(
    () => ({
      ...table,
      options: tableOptions,
      state,
    }),
    [table, tableOptions, state],
  );
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+virtual-core@3.17.11/node_modules/@tanstack/virtual-core/dist/esm/lazy-measurements.js
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom(), 1);
function getMeasurementKey(item) {
  return typeof item === "object" ? item.key : item;
}
function createLazyMeasurementsView(cache, flat) {
  const count = cache.length;
  return new Proxy(cache, {
    get(target, prop, receiver) {
      if (typeof prop === "string") {
        const c = prop.charCodeAt(0);
        if (c >= 48 && c <= 57) {
          const i = +prop;
          if (Number.isInteger(i) && i >= 0 && i < count) {
            let v = target[i];
            if (typeof v !== "object") {
              const s = flat[i * 2];
              v = target[i] = {
                index: i,
                key: v,
                start: s,
                size: flat[i * 2 + 1],
                end: s + flat[i * 2 + 1],
                lane: 0,
              };
            }
            return v;
          }
        }
        if (prop === "length") return count;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+virtual-core@3.17.11/node_modules/@tanstack/virtual-core/dist/esm/utils.js
function memo(getDeps, fn, opts) {
  let deps = opts.initialDeps ?? [];
  let result;
  let isInitial = true;
  function memoizedFunction() {
    const newDeps = getDeps();
    if (!(newDeps.length !== deps.length || newDeps.some((dep, index) => deps[index] !== dep)))
      return result;
    deps = newDeps;
    result = fn(...newDeps);
    if ((opts == null ? void 0 : opts.onChange) && !(isInitial && opts.skipInitialOnChange))
      opts.onChange(result);
    isInitial = false;
    return result;
  }
  memoizedFunction.updateDeps = (newDeps) => {
    deps = newDeps;
  };
  return memoizedFunction;
}
function notUndefined(value, msg) {
  if (value === void 0) throw new Error(`Unexpected undefined${msg ? `: ${msg}` : ""}`);
  else return value;
}
var approxEqual = (a, b) => Math.abs(a - b) < 1.01;
var debounce = (targetWindow, fn, ms) => {
  let timeoutId;
  return Object.assign(
    function (...args) {
      targetWindow.clearTimeout(timeoutId);
      timeoutId = targetWindow.setTimeout(() => fn.apply(this, args), ms);
    },
    {
      cancel: () => {
        targetWindow.clearTimeout(timeoutId);
      },
    },
  );
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+virtual-core@3.17.11/node_modules/@tanstack/virtual-core/dist/esm/index.js
var _isIOSResult;
var isIOSWebKit = () => {
  if (_isIOSResult !== void 0) return _isIOSResult;
  if (typeof navigator === "undefined") return (_isIOSResult = false);
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return (_isIOSResult = true);
  const mtp = navigator.maxTouchPoints;
  return (_isIOSResult = navigator.platform === "MacIntel" && mtp !== void 0 && mtp > 0);
};
var getRect = (element) => {
  const { offsetWidth, offsetHeight } = element;
  return {
    width: offsetWidth,
    height: offsetHeight,
  };
};
var defaultKeyExtractor = (index) => index;
var defaultRangeExtractor = (range) => {
  const start = Math.max(range.startIndex - range.overscan, 0);
  const len = Math.min(range.endIndex + range.overscan, range.count - 1) - start + 1;
  const arr = new Array(len);
  for (let i = 0; i < len; i++) arr[i] = start + i;
  return arr;
};
var observeElementRect = (instance, cb) => {
  const element = instance.scrollElement;
  if (!element) return;
  const targetWindow = instance.targetWindow;
  if (!targetWindow) return;
  const handler = (rect) => {
    const { width, height } = rect;
    cb({
      width: Math.round(width),
      height: Math.round(height),
    });
  };
  handler(getRect(element));
  if (!targetWindow.ResizeObserver) return () => {};
  const observer = new targetWindow.ResizeObserver((entries) => {
    const run = () => {
      const entry = entries[0];
      if (entry == null ? void 0 : entry.borderBoxSize) {
        const box = entry.borderBoxSize[0];
        if (box) {
          handler({
            width: box.inlineSize,
            height: box.blockSize,
          });
          return;
        }
      }
      handler(getRect(element));
    };
    instance.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
  });
  observer.observe(element, { box: "border-box" });
  return () => {
    observer.unobserve(element);
  };
};
var addEventListenerOptions = { passive: true };
var supportsScrollend = typeof window == "undefined" ? true : "onscrollend" in window;
var observeOffset = (instance, cb, readOffset) => {
  const element = instance.scrollElement;
  if (!element) return;
  const targetWindow = instance.targetWindow;
  if (!targetWindow) return;
  const registerScrollendEvent = instance.options.useScrollendEvent && supportsScrollend;
  let offset = 0;
  const fallback = registerScrollendEvent
    ? null
    : debounce(
        targetWindow,
        () => cb(readOffset(element), false),
        instance.options.isScrollingResetDelay,
      );
  const createHandler = (isScrolling) => () => {
    offset = readOffset(element);
    fallback?.();
    cb(offset, isScrolling);
  };
  const handler = createHandler(true);
  const endHandler = createHandler(false);
  element.addEventListener("scroll", handler, addEventListenerOptions);
  if (registerScrollendEvent)
    element.addEventListener("scrollend", endHandler, addEventListenerOptions);
  return () => {
    element.removeEventListener("scroll", handler);
    if (registerScrollendEvent) element.removeEventListener("scrollend", endHandler);
    fallback?.cancel();
  };
};
var observeElementOffset = (instance, cb) =>
  observeOffset(instance, cb, (el) => {
    const { horizontal, isRtl } = instance.options;
    return horizontal ? el.scrollLeft * ((isRtl && -1) || 1) : el.scrollTop;
  });
var measureElement = (element, entry, instance) => {
  if (instance.options.useCachedMeasurements) {
    const index = instance.indexFromElement(element);
    const key = instance.options.getItemKey(index);
    return instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index);
  }
  if (entry == null ? void 0 : entry.borderBoxSize) {
    const box = entry.borderBoxSize[0];
    if (box) return Math.round(box[instance.options.horizontal ? "inlineSize" : "blockSize"]);
  }
  if (!entry) {
    const index = instance.indexFromElement(element);
    const key = instance.options.getItemKey(index);
    const cachedSize = instance.itemSizeCache.get(key);
    if (cachedSize !== void 0) return cachedSize;
  }
  return element[instance.options.horizontal ? "offsetWidth" : "offsetHeight"];
};
var scrollWithAdjustments = (offset, { adjustments = 0, behavior }, instance) => {
  var _a, _b;
  (_b = (_a = instance.scrollElement) == null ? void 0 : _a.scrollTo) == null ||
    _b.call(_a, {
      [instance.options.horizontal ? "left" : "top"]: offset + adjustments,
      behavior,
    });
};
var elementScroll = scrollWithAdjustments;
function isAppendWithTrim(prevCount, nextCount, getPreviousKey, getNextKey) {
  if (nextCount === 0) return false;
  const firstKey = getNextKey(0);
  const removedKeys = /* @__PURE__ */ new Set();
  let removedCount = 0;
  while (removedCount < prevCount) {
    const key = getPreviousKey(removedCount);
    if (key === firstKey) break;
    removedKeys.add(key);
    removedCount++;
  }
  const retainedCount = prevCount - removedCount;
  if (retainedCount === 0 || retainedCount >= nextCount) return false;
  for (let i = 0; i < retainedCount; i++)
    if (getNextKey(i) !== getPreviousKey(removedCount + i)) return false;
  for (let i = retainedCount; i < nextCount; i++) if (removedKeys.has(getNextKey(i))) return false;
  return true;
}
var Virtualizer = class {
  constructor(opts) {
    this.unsubs = [];
    this.scrollElement = null;
    this.targetWindow = null;
    this.isScrolling = false;
    this.scrollState = null;
    this.measurementsCache = [];
    this._singleLaneMeasurements = null;
    this.itemSizeCache = /* @__PURE__ */ new Map();
    this.itemSizeCacheVersion = 0;
    this.laneAssignments = /* @__PURE__ */ new Map();
    this.pendingMin = null;
    this.prevLanes = void 0;
    this.lanesChangedFlag = false;
    this.lanesSettling = false;
    this.pendingScrollAnchor = null;
    this.scrollRect = null;
    this.scrollOffset = null;
    this.scrollDirection = null;
    this.scrollAdjustments = 0;
    this._iosDeferredAdjustment = 0;
    this._iosTouching = false;
    this._iosJustTouchEnded = false;
    this._iosTouchEndTimerId = null;
    this._intendedScrollOffset = null;
    this._clampedAdjustment = null;
    this.elementsCache = /* @__PURE__ */ new Map();
    this.now = () => {
      var _a, _b, _c;
      return (
        ((_c =
          (_b = (_a = this.targetWindow) == null ? void 0 : _a.performance) == null
            ? void 0
            : _b.now) == null
          ? void 0
          : _c.call(_b)) ?? Date.now()
      );
    };
    this.observer = /* @__PURE__ */ (() => {
      let _ro = null;
      const get = () => {
        if (_ro) return _ro;
        if (!this.targetWindow || !this.targetWindow.ResizeObserver) return null;
        return (_ro = new this.targetWindow.ResizeObserver((entries) => {
          entries.forEach((entry) => {
            const run = () => {
              const node = entry.target;
              const index = this.indexFromElement(node);
              if (!node.isConnected) {
                this.observer.unobserve(node);
                for (const [cacheKey, cachedNode] of this.elementsCache)
                  if (cachedNode === node) {
                    this.elementsCache.delete(cacheKey);
                    break;
                  }
                return;
              }
              if (!this.isIndexInRange(index)) return;
              if (this.shouldMeasureDuringScroll(index))
                this.resizeItem(index, this.options.measureElement(node, entry, this));
            };
            this.options.useAnimationFrameWithResizeObserver ? requestAnimationFrame(run) : run();
          });
        }));
      };
      return {
        disconnect: () => {
          var _a;
          (_a = get()) == null || _a.disconnect();
          _ro = null;
        },
        observe: (target) => {
          var _a;
          return (_a = get()) == null ? void 0 : _a.observe(target, { box: "border-box" });
        },
        unobserve: (target) => {
          var _a;
          return (_a = get()) == null ? void 0 : _a.unobserve(target);
        },
      };
    })();
    this.range = null;
    this.setOptions = (opts2) => {
      var _a;
      const merged = {
        debug: false,
        initialOffset: 0,
        overscan: 1,
        paddingStart: 0,
        paddingEnd: 0,
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0,
        horizontal: false,
        getItemKey: defaultKeyExtractor,
        rangeExtractor: defaultRangeExtractor,
        onChange: () => {},
        measureElement,
        initialRect: {
          width: 0,
          height: 0,
        },
        scrollMargin: 0,
        gap: 0,
        indexAttribute: "data-index",
        initialMeasurementsCache: [],
        lanes: 1,
        anchorTo: "start",
        followOnAppend: false,
        scrollEndThreshold: 1,
        isScrollingResetDelay: 150,
        enabled: true,
        isRtl: false,
        useScrollendEvent: false,
        useAnimationFrameWithResizeObserver: false,
        laneAssignmentMode: "estimate",
        useCachedMeasurements: false,
      };
      for (const key in opts2) {
        const v = opts2[key];
        if (v !== void 0) merged[key] = v;
      }
      const prevOptions = this.options;
      let anchor = null;
      let followOnAppend = null;
      let edgeKeysChanged = false;
      if (
        prevOptions !== void 0 &&
        prevOptions.enabled &&
        merged.enabled &&
        merged.anchorTo === "end" &&
        this.scrollElement !== null
      ) {
        const prevCount = prevOptions.count;
        const nextCount = merged.count;
        const measurements = this.getMeasurements();
        const previousItems =
          ((_a = this._singleLaneMeasurements) == null ? void 0 : _a.items) ?? measurements;
        const getPreviousKey = (index) => getMeasurementKey(previousItems[index]);
        const prevFirstKey = prevCount > 0 ? getPreviousKey(0) : null;
        const prevLastKey = prevCount > 0 ? getPreviousKey(prevCount - 1) : null;
        if (
          nextCount !== prevCount ||
          (prevCount > 0 &&
            nextCount > 0 &&
            (merged.getItemKey(0) !== prevFirstKey ||
              merged.getItemKey(nextCount - 1) !== prevLastKey))
        ) {
          edgeKeysChanged = true;
          const item =
            prevCount > 0
              ? (this.getVirtualItemForOffset(this.getScrollOffset()) ?? measurements[0])
              : null;
          if (item) anchor = [item.key, this.getScrollOffset() - item.start];
          const behavior = merged.followOnAppend === true ? "auto" : merged.followOnAppend || null;
          if (
            behavior &&
            nextCount > 0 &&
            this.isAtEnd(prevOptions.scrollEndThreshold) &&
            (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)
          ) {
            if (
              nextCount > prevCount ||
              isAppendWithTrim(prevCount, nextCount, getPreviousKey, merged.getItemKey)
            )
              followOnAppend = behavior;
          }
        }
      }
      this.options = merged;
      if (edgeKeysChanged) {
        this.pendingMin = 0;
        this.itemSizeCacheVersion++;
      }
      let anchorResolved = false;
      let anchorDelta = 0;
      if (anchor && this.scrollOffset !== null) {
        const [anchorKey, anchorOffset] = anchor;
        const newMeasurements = this.getMeasurements();
        const { count, getItemKey } = this.options;
        let idx = 0;
        while (idx < count && getItemKey(idx) !== anchorKey) idx++;
        if (idx < count) {
          const anchorItem = newMeasurements[idx];
          if (anchorItem) {
            const newOffset = Math.max(0, anchorItem.start + anchorOffset);
            if (!followOnAppend && newOffset !== this.scrollOffset) {
              anchorDelta = newOffset - this.scrollOffset;
              this.scrollOffset = newOffset;
              anchorResolved = true;
            }
          }
        }
      }
      if (anchorResolved || followOnAppend)
        this.pendingScrollAnchor = [
          anchorResolved ? anchor[0] : null,
          anchorResolved ? anchor[1] : 0,
          followOnAppend,
          anchorDelta,
        ];
    };
    this.notify = (sync) => {
      var _a, _b;
      (_b = (_a = this.options).onChange) == null || _b.call(_a, this, sync);
    };
    this.maybeNotify = memo(
      () => {
        this.calculateRange();
        return [
          this.isScrolling,
          this.range ? this.range.startIndex : null,
          this.range ? this.range.endIndex : null,
        ];
      },
      (isScrolling) => {
        this.notify(isScrolling);
      },
      {
        key: false,
        debug: () => this.options.debug,
        initialDeps: [
          this.isScrolling,
          this.range ? this.range.startIndex : null,
          this.range ? this.range.endIndex : null,
        ],
      },
    );
    this.cleanup = () => {
      this.unsubs.filter(Boolean).forEach((d) => d());
      this.unsubs = [];
      this.observer.disconnect();
      if (this.rafId != null && this.targetWindow) {
        this.targetWindow.cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.scrollState = null;
      this.isScrolling = false;
      this.scrollDirection = null;
      this._iosDeferredAdjustment = 0;
      this._iosTouching = false;
      this._iosJustTouchEnded = false;
      this._clampedAdjustment = null;
      this.scrollElement = null;
      this.targetWindow = null;
    };
    this._didMount = () => {
      return () => {
        this.cleanup();
      };
    };
    this._willUpdate = () => {
      var _a, _b;
      const scrollElement = this.options.enabled ? this.options.getScrollElement() : null;
      if (this.scrollElement !== scrollElement) {
        this.cleanup();
        if (!scrollElement) {
          this.maybeNotify();
          return;
        }
        this.scrollElement = scrollElement;
        if (this.scrollElement && "ownerDocument" in this.scrollElement)
          this.targetWindow = this.scrollElement.ownerDocument.defaultView;
        else this.targetWindow = ((_a = this.scrollElement) == null ? void 0 : _a.window) ?? null;
        this.elementsCache.forEach((cached) => {
          this.observer.observe(cached);
        });
        this.unsubs.push(
          this.options.observeElementRect(this, (rect) => {
            this.scrollRect = rect;
            this.maybeNotify();
          }),
        );
        this.unsubs.push(
          this.options.observeElementOffset(this, (offset, isScrolling) => {
            if (isScrolling && this._intendedScrollOffset === null && offset === this.scrollOffset)
              return;
            if (
              this._intendedScrollOffset !== null &&
              Math.abs(offset - this._intendedScrollOffset) < 1.5
            )
              offset = this._intendedScrollOffset;
            this._intendedScrollOffset = null;
            if (
              this._clampedAdjustment !== null &&
              Math.abs(offset - this._clampedAdjustment.maxAtWrite) >= 1.5
            )
              this._clampedAdjustment = null;
            this.scrollAdjustments = 0;
            const prevOffset = this.getScrollOffset();
            this.scrollDirection = isScrolling
              ? prevOffset === offset
                ? this.scrollDirection
                : prevOffset < offset
                  ? "forward"
                  : "backward"
              : null;
            this.scrollOffset = offset;
            this.isScrolling = isScrolling;
            this._flushIosDeferredIfReady();
            if (this.scrollState) this.scheduleScrollReconcile();
            this.maybeNotify();
          }),
        );
        if ("addEventListener" in this.scrollElement) {
          const scrollEl = this.scrollElement;
          const onTouchStart = () => {
            this._iosTouching = true;
            this._iosJustTouchEnded = false;
            if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
              this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
              this._iosTouchEndTimerId = null;
            }
          };
          const onTouchEnd = () => {
            this._iosTouching = false;
            if (!isIOSWebKit() || this.targetWindow == null) return;
            this._iosJustTouchEnded = true;
            this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
              this._iosJustTouchEnded = false;
              this._iosTouchEndTimerId = null;
              this._flushIosDeferredIfReady();
            }, 150);
          };
          scrollEl.addEventListener("touchstart", onTouchStart, addEventListenerOptions);
          scrollEl.addEventListener("touchend", onTouchEnd, addEventListenerOptions);
          this.unsubs.push(() => {
            scrollEl.removeEventListener("touchstart", onTouchStart);
            scrollEl.removeEventListener("touchend", onTouchEnd);
            if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
              this.targetWindow.clearTimeout(this._iosTouchEndTimerId);
              this._iosTouchEndTimerId = null;
            }
          });
        }
        this._scrollToOffset(this.getScrollOffset(), {
          adjustments: void 0,
          behavior: void 0,
        });
      }
      const anchor = this.pendingScrollAnchor;
      this.pendingScrollAnchor = null;
      if (anchor && this.scrollElement && this.options.enabled) {
        const [key, _offset, followOnAppend, anchorDelta] = anchor;
        if (key !== null && !followOnAppend) {
          if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
            if (anchorDelta !== 0) this._iosDeferredAdjustment += anchorDelta;
          } else if (
            ((_b = this.scrollState) == null ? void 0 : _b.behavior) === "smooth" &&
            !approxEqual(this.getScrollOffset() - anchorDelta, this.scrollState.lastTargetOffset)
          );
          else
            this._scrollToOffset(this.getScrollOffset(), {
              adjustments: void 0,
              behavior: void 0,
            });
        }
        if (followOnAppend) this.scrollToEnd({ behavior: followOnAppend });
      }
      this._retryClampedAdjustment();
    };
    this._retryClampedAdjustment = () => {
      if (this._clampedAdjustment === null || !this.scrollElement || !this.options.enabled) return;
      const { target, maxAtWrite } = this._clampedAdjustment;
      const max = this.getMaxScrollOffset();
      if (max > maxAtWrite + 0.5) {
        this._clampedAdjustment =
          target > max + 0.5
            ? {
                target,
                maxAtWrite: max,
              }
            : null;
        this._scrollToOffset(target, {
          adjustments: void 0,
          behavior: void 0,
        });
      }
    };
    this._flushIosDeferredIfReady = () => {
      if (this._iosDeferredAdjustment === 0) return;
      if (this.isScrolling) return;
      if (this._iosTouching) return;
      if (this._iosJustTouchEnded) return;
      const cur = this.getScrollOffset();
      const max = this.getMaxScrollOffset();
      if (cur < 0 || cur > max) return;
      if (this._iosDeferredAdjustment < 0 && cur >= max - 1) {
        this._iosDeferredAdjustment = 0;
        return;
      }
      const delta = this._iosDeferredAdjustment;
      this._iosDeferredAdjustment = 0;
      this._scrollToOffset(cur, {
        adjustments: (this.scrollAdjustments += delta),
        behavior: void 0,
      });
    };
    this.rafId = null;
    this.getSize = () => {
      if (!this.options.enabled) {
        this.scrollRect = null;
        return 0;
      }
      this.scrollRect = this.scrollRect ?? this.options.initialRect;
      return this.scrollRect[this.options.horizontal ? "width" : "height"];
    };
    this.getScrollOffset = () => {
      if (!this.options.enabled) {
        this.scrollOffset = null;
        return 0;
      }
      this.scrollOffset =
        this.scrollOffset ??
        (typeof this.options.initialOffset === "function"
          ? this.options.initialOffset()
          : this.options.initialOffset);
      return this.scrollOffset;
    };
    this.getMeasurementOptions = memo(
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
      (count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap) => {
        if (this.prevLanes !== void 0 && this.prevLanes !== lanes) this.lanesChangedFlag = true;
        this.prevLanes = lanes;
        this.pendingMin = null;
        return {
          count,
          paddingStart,
          scrollMargin,
          getItemKey,
          enabled,
          lanes,
          laneAssignmentMode,
          gap,
        };
      },
      { key: false },
    );
    this.isIndexInRange = (index) => index >= 0 && index < this.options.count;
    this.getMeasurements = memo(
      () => [this.getMeasurementOptions(), this.itemSizeCacheVersion],
      (
        { count, paddingStart, scrollMargin, getItemKey, enabled, lanes, laneAssignmentMode, gap },
        _itemSizeCacheVersion,
      ) => {
        var _a;
        const itemSizeCache = this.itemSizeCache;
        if (!enabled) {
          this.measurementsCache = [];
          this._singleLaneMeasurements = null;
          this.itemSizeCache.clear();
          this.laneAssignments.clear();
          return [];
        }
        if (this.laneAssignments.size > count) {
          for (const index of this.laneAssignments.keys())
            if (index >= count) this.laneAssignments.delete(index);
        }
        if (this.lanesChangedFlag) {
          this.lanesChangedFlag = false;
          this.lanesSettling = true;
          this.measurementsCache = [];
          this._singleLaneMeasurements = null;
          this.itemSizeCache.clear();
          this.laneAssignments.clear();
          this.pendingMin = null;
        }
        if (this.measurementsCache.length === 0 && !this.lanesSettling) {
          this.measurementsCache = this.options.initialMeasurementsCache;
          this.measurementsCache.forEach((item) => {
            this.itemSizeCache.set(item.key, item.size);
          });
        }
        const min = this.lanesSettling ? 0 : (this.pendingMin ?? 0);
        this.pendingMin = null;
        if (this.lanesSettling && this.measurementsCache.length === count)
          this.lanesSettling = false;
        if (lanes === 1) {
          const need = count * 2;
          let flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
          if (!flat || flat.length < need) {
            const next = new Float64Array(need);
            if (flat && min > 0) next.set(flat.subarray(0, min * 2));
            flat = next;
          }
          const items = min === 0 ? new Array(count) : this._singleLaneMeasurements.items.slice();
          let runningStart;
          if (min === 0) runningStart = paddingStart + scrollMargin;
          else {
            const prevIdx = min - 1;
            runningStart = flat[prevIdx * 2] + flat[prevIdx * 2 + 1] + gap;
          }
          for (let i = min; i < count; i++) {
            const key = getItemKey(i);
            items[i] = key;
            const measuredSize = itemSizeCache.get(key);
            const size =
              typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
            flat[i * 2] = runningStart;
            flat[i * 2 + 1] = size;
            runningStart += size + gap;
          }
          this._singleLaneMeasurements = {
            flat,
            items,
          };
          const view = createLazyMeasurementsView(items, flat);
          this.measurementsCache = view;
          return view;
        }
        const measurements = this.measurementsCache.slice(0, min);
        const laneLastIndex = new Array(lanes).fill(void 0);
        const laneEnds = new Float64Array(lanes);
        let filledLanes = 0;
        for (let m = 0; m < min; m++) {
          const item = measurements[m];
          if (item) {
            if (laneLastIndex[item.lane] === void 0) filledLanes++;
            laneLastIndex[item.lane] = m;
            laneEnds[item.lane] = item.end;
          }
        }
        for (let i = min; i < count; i++) {
          const key = getItemKey(i);
          const cachedLane = this.laneAssignments.get(i);
          let lane;
          let start;
          const shouldCacheLane = laneAssignmentMode === "estimate" || itemSizeCache.has(key);
          if (cachedLane !== void 0 && this.options.lanes > 1) {
            lane = cachedLane;
            const prevIndex = laneLastIndex[lane];
            const prevInLane = prevIndex !== void 0 ? measurements[prevIndex] : void 0;
            start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin;
          } else if (filledLanes === lanes) {
            let bestLane = 0;
            let bestEnd = laneEnds[0];
            let bestIdx = laneLastIndex[0];
            for (let l = 1; l < lanes; l++) {
              const e = laneEnds[l];
              if (e < bestEnd || (e === bestEnd && laneLastIndex[l] < bestIdx)) {
                bestLane = l;
                bestEnd = e;
                bestIdx = laneLastIndex[l];
              }
            }
            lane = bestLane;
            start = bestEnd + gap;
            if (shouldCacheLane) this.laneAssignments.set(i, lane);
          } else {
            lane = i % this.options.lanes;
            start = paddingStart + scrollMargin;
            if (shouldCacheLane) this.laneAssignments.set(i, lane);
          }
          const measuredSize = itemSizeCache.get(key);
          const size =
            typeof measuredSize === "number" ? measuredSize : this.options.estimateSize(i);
          const end = start + size;
          measurements[i] = {
            index: i,
            start,
            size,
            end,
            key,
            lane,
          };
          if (laneLastIndex[lane] === void 0) filledLanes++;
          laneLastIndex[lane] = i;
          laneEnds[lane] = end;
        }
        this.measurementsCache = measurements;
        return measurements;
      },
      {
        key: false,
        debug: () => this.options.debug,
      },
    );
    this.calculateRange = memo(
      () => [this.getMeasurements(), this.getSize(), this.getScrollOffset(), this.options.lanes],
      (measurements, outerSize, scrollOffset, lanes) => {
        if (measurements.length === 0 || outerSize === 0) {
          this.range = null;
          return null;
        }
        this.range = calculateRangeImpl(
          measurements,
          outerSize,
          scrollOffset,
          lanes,
          lanes === 1 && this._singleLaneMeasurements !== null
            ? this._singleLaneMeasurements.flat
            : null,
        );
        return this.range;
      },
      {
        key: false,
        debug: () => this.options.debug,
      },
    );
    this.getVirtualIndexes = memo(
      () => {
        let startIndex = null;
        let endIndex = null;
        const range = this.calculateRange();
        if (range) {
          startIndex = range.startIndex;
          endIndex = range.endIndex;
        }
        this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex]);
        return [
          this.options.rangeExtractor,
          this.options.overscan,
          this.options.count,
          startIndex,
          endIndex,
        ];
      },
      (rangeExtractor, overscan, count, startIndex, endIndex) => {
        return startIndex === null || endIndex === null
          ? []
          : rangeExtractor({
              startIndex,
              endIndex,
              overscan,
              count,
            });
      },
      {
        key: false,
        debug: () => this.options.debug,
      },
    );
    this.indexFromElement = (node) => {
      const attributeName = this.options.indexAttribute;
      const indexStr = node.getAttribute(attributeName);
      if (!indexStr) {
        console.warn(`Missing attribute name '${attributeName}={index}' on measured element.`);
        return -1;
      }
      return parseInt(indexStr, 10);
    };
    this.shouldMeasureDuringScroll = (index) => {
      var _a;
      if (!this.scrollState || this.scrollState.behavior !== "smooth") return true;
      const scrollIndex =
        this.scrollState.index ??
        ((_a = this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)) == null
          ? void 0
          : _a.index);
      if (scrollIndex !== void 0 && this.range) {
        const bufferSize = Math.max(
          this.options.overscan,
          Math.ceil((this.range.endIndex - this.range.startIndex) / 2),
        );
        const minIndex = Math.max(0, scrollIndex - bufferSize);
        const maxIndex = Math.min(this.options.count - 1, scrollIndex + bufferSize);
        return index >= minIndex && index <= maxIndex;
      }
      return true;
    };
    this.measureElement = (node) => {
      if (!node) {
        this.elementsCache.forEach((cached, key2) => {
          if (!cached.isConnected) {
            this.observer.unobserve(cached);
            this.elementsCache.delete(key2);
          }
        });
        return;
      }
      const index = this.indexFromElement(node);
      if (!this.isIndexInRange(index)) return;
      const key = this.options.getItemKey(index);
      const prevNode = this.elementsCache.get(key);
      if (prevNode !== node) {
        if (prevNode) this.observer.unobserve(prevNode);
        this.observer.observe(node);
        this.elementsCache.set(key, node);
      }
      if ((!this.isScrolling || this.scrollState) && this.shouldMeasureDuringScroll(index))
        this.resizeItem(index, this.options.measureElement(node, void 0, this));
    };
    this.resizeItem = (index, size) => {
      var _a, _b, _c;
      if (!this.isIndexInRange(index)) return;
      let cachedSize;
      let itemStart;
      let key;
      const flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
      if (this.options.lanes === 1 && flat != null) {
        key = this.options.getItemKey(index);
        itemStart = flat[index * 2];
        cachedSize = flat[index * 2 + 1];
      } else {
        const item = this.measurementsCache[index];
        if (!item) return;
        key = item.key;
        itemStart = item.start;
        cachedSize = item.size;
      }
      const itemSize = this.itemSizeCache.get(key) ?? cachedSize;
      const delta = size - itemSize;
      if (delta !== 0) {
        const wasAtEnd =
          this.options.anchorTo === "end" &&
          ((_b = this.scrollState) == null ? void 0 : _b.behavior) !== "smooth" &&
          this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold;
        const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0;
        const scrollOffsetWithAdj = this.getScrollOffset() + this.scrollAdjustments;
        const defaultShouldAdjust = !this.itemSizeCache.has(key)
          ? itemStart < scrollOffsetWithAdj
          : itemStart + itemSize <= scrollOffsetWithAdj && this.scrollDirection !== "backward";
        const shouldAdjustScroll =
          ((_c = this.scrollState) == null ? void 0 : _c.behavior) !== "smooth" &&
          (this.shouldAdjustScrollPositionOnItemSizeChange !== void 0
            ? this.shouldAdjustScrollPositionOnItemSizeChange(
                this.measurementsCache[index] ?? {
                  index,
                  key,
                  start: itemStart,
                  size: cachedSize,
                  end: itemStart + cachedSize,
                  lane: 0,
                },
                delta,
                this,
              )
            : defaultShouldAdjust);
        if (this.pendingMin === null || index < this.pendingMin) this.pendingMin = index;
        this.itemSizeCache.set(key, size);
        this.itemSizeCacheVersion++;
        let adjustedSync = false;
        if (wasAtEnd)
          adjustedSync = this.applyScrollAdjustment(this.getTotalSize() - prevTotalSize);
        else if (shouldAdjustScroll) adjustedSync = this.applyScrollAdjustment(delta);
        this.notify(adjustedSync);
        this._retryClampedAdjustment();
      }
    };
    this.getVirtualItems = memo(
      () => [this.getVirtualIndexes(), this.getMeasurements()],
      (indexes, measurements) => {
        const virtualItems = [];
        for (let k = 0, len = indexes.length; k < len; k++) {
          const measurement = measurements[indexes[k]];
          virtualItems.push(measurement);
        }
        return virtualItems;
      },
      {
        key: false,
        debug: () => this.options.debug,
      },
    );
    this.getVirtualItemForOffset = (offset) => {
      var _a;
      const measurements = this.getMeasurements();
      if (measurements.length === 0) return;
      const flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
      const useFlat = this.options.lanes === 1 && flat != null;
      return notUndefined(
        measurements[
          findNearestBinarySearch(
            0,
            measurements.length - 1,
            useFlat ? (i) => flat[i * 2] : (i) => notUndefined(measurements[i]).start,
            offset,
          )
        ],
      );
    };
    this.getMaxScrollOffset = () => {
      if (!this.scrollElement) return 0;
      if ("scrollHeight" in this.scrollElement)
        return this.options.horizontal
          ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth
          : this.scrollElement.scrollHeight - this.scrollElement.clientHeight;
      else {
        const doc = this.scrollElement.document.documentElement;
        return this.options.horizontal
          ? doc.scrollWidth - this.scrollElement.innerWidth
          : doc.scrollHeight - this.scrollElement.innerHeight;
      }
    };
    this.getVirtualDistanceFromEnd = () => {
      return Math.max(this.getTotalSize() - this.getSize() - this.getScrollOffset(), 0);
    };
    this.getDistanceFromEnd = () => {
      return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0);
    };
    this.isAtEnd = (threshold = this.options.scrollEndThreshold) => {
      return this.getDistanceFromEnd() <= threshold;
    };
    this.getOffsetForAlignment = (toOffset, align, itemSize = 0) => {
      if (!this.scrollElement) return 0;
      const size = this.getSize();
      const scrollOffset = this.getScrollOffset();
      if (align === "auto") align = toOffset >= scrollOffset + size ? "end" : "start";
      if (align === "center") toOffset += (itemSize - size) / 2;
      else if (align === "end") toOffset -= size;
      const maxOffset = this.getMaxScrollOffset();
      return Math.max(Math.min(maxOffset, toOffset), 0);
    };
    this.getOffsetForIndex = (index, align = "auto") => {
      index = Math.max(0, Math.min(index, this.options.count - 1));
      const size = this.getSize();
      const scrollOffset = this.getScrollOffset();
      const item = this.measurementsCache[index];
      if (!item) return;
      if (align === "auto") {
        if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) align = "end";
        else if (item.start <= scrollOffset + this.options.scrollPaddingStart) align = "start";
        else return [scrollOffset, align];
      }
      if (align === "end" && index === this.options.count - 1)
        return [this.getMaxScrollOffset(), align];
      const toOffset =
        align === "end"
          ? item.end + this.options.scrollPaddingEnd
          : item.start - this.options.scrollPaddingStart;
      return [this.getOffsetForAlignment(toOffset, align, item.size), align];
    };
    this.scrollToOffset = (toOffset, { align = "start", behavior = "auto" } = {}) => {
      this._iosDeferredAdjustment = 0;
      const offset = this.getOffsetForAlignment(toOffset, align);
      const now = this.now();
      this.scrollState = {
        index: null,
        align,
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0,
      };
      this._scrollToOffset(offset, {
        adjustments: void 0,
        behavior,
      });
      this.scheduleScrollReconcile();
    };
    this.scrollToIndex = (index, { align: initialAlign = "auto", behavior = "auto" } = {}) => {
      this._iosDeferredAdjustment = 0;
      index = Math.max(0, Math.min(index, this.options.count - 1));
      const offsetInfo = this.getOffsetForIndex(index, initialAlign);
      if (!offsetInfo) return;
      const [offset, align] = offsetInfo;
      const now = this.now();
      this.scrollState = {
        index,
        align,
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0,
      };
      this._scrollToOffset(offset, {
        adjustments: void 0,
        behavior,
      });
      this.scheduleScrollReconcile();
    };
    this.scrollBy = (delta, { behavior = "auto" } = {}) => {
      const offset = this.getScrollOffset() + delta;
      const now = this.now();
      this.scrollState = {
        index: null,
        align: "start",
        behavior,
        startedAt: now,
        lastTargetOffset: offset,
        stableFrames: 0,
      };
      this._scrollToOffset(offset, {
        adjustments: void 0,
        behavior,
      });
      this.scheduleScrollReconcile();
    };
    this.scrollToEnd = ({ behavior = "auto" } = {}) => {
      if (this.options.count > 0) {
        this.scrollToIndex(this.options.count - 1, {
          align: "end",
          behavior,
        });
        return;
      }
      this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), { behavior });
    };
    this.getTotalSize = () => {
      var _a, _b;
      const measurements = this.getMeasurements();
      let end;
      if (measurements.length === 0) end = this.options.paddingStart;
      else if (this.options.lanes === 1) {
        const lastIdx = measurements.length - 1;
        const flat = (_a = this._singleLaneMeasurements) == null ? void 0 : _a.flat;
        if (flat != null) end = flat[lastIdx * 2] + flat[lastIdx * 2 + 1];
        else end = ((_b = measurements[lastIdx]) == null ? void 0 : _b.end) ?? 0;
      } else {
        const endByLane = Array(this.options.lanes).fill(null);
        let endIndex = measurements.length - 1;
        while (endIndex >= 0 && endByLane.some((val) => val === null)) {
          const item = measurements[endIndex];
          if (endByLane[item.lane] === null) endByLane[item.lane] = item.end;
          endIndex--;
        }
        end = Math.max(...endByLane.filter((val) => val !== null));
      }
      return Math.max(end - this.options.scrollMargin + this.options.paddingEnd, 0);
    };
    this.takeSnapshot = () => {
      const snapshot = [];
      if (this.itemSizeCache.size === 0) return snapshot;
      const m = this.getMeasurements();
      for (const item of m)
        if (item && this.itemSizeCache.has(item.key))
          snapshot.push({
            index: item.index,
            key: item.key,
            start: item.start,
            size: item.size,
            end: item.end,
            lane: item.lane,
          });
      return snapshot;
    };
    this._scrollToOffset = (offset, { adjustments, behavior }) => {
      this._intendedScrollOffset = offset + (adjustments ?? 0);
      this.options.scrollToFn(
        offset,
        {
          behavior,
          adjustments,
        },
        this,
      );
    };
    this.measure = () => {
      this.pendingMin = null;
      this.itemSizeCache.clear();
      this.laneAssignments.clear();
      this.itemSizeCacheVersion++;
      this.notify(false);
    };
    this.setOptions(opts);
  }
  applyScrollAdjustment(delta, behavior) {
    if (delta === 0) return false;
    if (isIOSWebKit() && (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)) {
      this._iosDeferredAdjustment += delta;
      return false;
    } else {
      const target = this.getScrollOffset() + this.scrollAdjustments + delta;
      const el = this.scrollElement;
      const maxAtWrite =
        el !== null && ("scrollHeight" in el || "document" in el)
          ? this.getMaxScrollOffset()
          : null;
      this._clampedAdjustment =
        maxAtWrite !== null && target > maxAtWrite + 0.5
          ? {
              target,
              maxAtWrite,
            }
          : null;
      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: (this.scrollAdjustments += delta),
        behavior,
      });
      if (this.scrollOffset !== null) {
        this.scrollOffset += this.scrollAdjustments;
        if (this.scrollOffset < 0) this.scrollOffset = 0;
        this.scrollAdjustments = 0;
      }
      return true;
    }
  }
  scheduleScrollReconcile() {
    if (!this.targetWindow) {
      this.scrollState = null;
      return;
    }
    if (this.rafId != null) return;
    this.rafId = this.targetWindow.requestAnimationFrame(() => {
      this.rafId = null;
      this.reconcileScroll();
    });
  }
  reconcileScroll() {
    if (!this.scrollState) return;
    if (!this.scrollElement) return;
    if (this.now() - this.scrollState.startedAt > 5e3) {
      this.scrollState = null;
      return;
    }
    const offsetInfo =
      this.scrollState.index != null
        ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align)
        : void 0;
    const targetOffset = offsetInfo ? offsetInfo[0] : this.scrollState.lastTargetOffset;
    const STABLE_FRAMES = 1;
    const targetChanged = targetOffset !== this.scrollState.lastTargetOffset;
    if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
      this.scrollState.stableFrames++;
      if (this.scrollState.stableFrames >= STABLE_FRAMES) {
        if (this.getScrollOffset() !== targetOffset)
          this._scrollToOffset(targetOffset, {
            adjustments: void 0,
            behavior: "auto",
          });
        this.scrollState = null;
        return;
      }
    } else {
      this.scrollState.stableFrames = 0;
      if (targetChanged) {
        const viewport = this.getSize() || 600;
        const distance = Math.abs(targetOffset - this.getScrollOffset());
        const keepSmooth = this.scrollState.behavior === "smooth" && distance > viewport;
        this.scrollState.lastTargetOffset = targetOffset;
        if (!keepSmooth) this.scrollState.behavior = "auto";
        this._scrollToOffset(targetOffset, {
          adjustments: void 0,
          behavior: keepSmooth ? "smooth" : "auto",
        });
      }
    }
    this.scheduleScrollReconcile();
  }
};
var findNearestBinarySearch = (low, high, getCurrentValue, value) => {
  while (low <= high) {
    const middle = ((low + high) / 2) | 0;
    const currentValue = getCurrentValue(middle);
    if (currentValue < value) low = middle + 1;
    else if (currentValue > value) high = middle - 1;
    else return middle;
  }
  if (low > 0) return low - 1;
  else return 0;
};
function findNearestBinarySearchFlat(flat, high, value) {
  let low = 0;
  while (low <= high) {
    const middle = ((low + high) / 2) | 0;
    const currentValue = flat[middle * 2];
    if (currentValue < value) low = middle + 1;
    else if (currentValue > value) high = middle - 1;
    else return middle;
  }
  return low > 0 ? low - 1 : 0;
}
function calculateRangeImpl(measurements, outerSize, scrollOffset, lanes, flat) {
  const lastIndex = measurements.length - 1;
  if (measurements.length <= lanes)
    return {
      startIndex: 0,
      endIndex: lastIndex,
    };
  if (lanes === 1 && flat !== null) {
    const startIndex2 = findNearestBinarySearchFlat(flat, lastIndex, scrollOffset);
    let endIndex2 = startIndex2;
    const limit = scrollOffset + outerSize;
    while (endIndex2 < lastIndex && flat[endIndex2 * 2] + flat[endIndex2 * 2 + 1] < limit)
      endIndex2++;
    return {
      startIndex: startIndex2,
      endIndex: endIndex2,
    };
  }
  const getStart = (index) => measurements[index].start;
  let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset);
  let endIndex = startIndex;
  if (lanes === 1)
    while (endIndex < lastIndex && measurements[endIndex].end < scrollOffset + outerSize)
      endIndex++;
  else if (lanes > 1) {
    const endPerLane = Array(lanes).fill(0);
    while (endIndex < lastIndex && endPerLane.some((pos) => pos < scrollOffset + outerSize)) {
      const item = measurements[endIndex];
      endPerLane[item.lane] = item.end;
      endIndex++;
    }
    const startPerLane = Array(lanes).fill(scrollOffset + outerSize);
    while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
      const item = measurements[startIndex];
      startPerLane[item.lane] = item.start;
      startIndex--;
    }
    startIndex = Math.max(0, startIndex - (startIndex % lanes));
    endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - (endIndex % lanes)));
  }
  return {
    startIndex,
    endIndex,
  };
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-virtual@3.14.13_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-virtual/dist/esm/index.js
var useIsomorphicLayoutEffect =
  typeof document !== "undefined" ? import_react.useLayoutEffect : import_react.useEffect;
function useVirtualizerBase({
  useFlushSync = true,
  directDomUpdates = false,
  directDomUpdatesMode = "transform",
  ...options
}) {
  const rerender = import_react.useReducer((x) => x + 1, 0)[1];
  const directRef = import_react.useRef({
    enabled: directDomUpdates,
    mode: directDomUpdatesMode,
    container: null,
    lastSize: null,
    lastPositions: /* @__PURE__ */ new WeakMap(),
    prevRange: null,
  });
  directRef.current.enabled = directDomUpdates;
  directRef.current.mode = directDomUpdatesMode;
  const measuringFromRef = import_react.useRef(false);
  const applyContainerSize = (instance2) => {
    const state = directRef.current;
    if (!state.enabled || !state.container) return;
    const totalSize = instance2.getTotalSize();
    if (totalSize !== state.lastSize) {
      state.lastSize = totalSize;
      const sizeAxis = instance2.options.horizontal ? "width" : "height";
      state.container.style[sizeAxis] = `${totalSize}px`;
    }
  };
  const applyDirectStyles = (instance2) => {
    const state = directRef.current;
    if (!state.enabled || !state.container) return;
    applyContainerSize(instance2);
    const horizontal = !!instance2.options.horizontal;
    const useTransform = state.mode === "transform";
    const posAxis = horizontal ? "left" : "top";
    const scrollMargin = instance2.options.scrollMargin;
    const items = instance2.getVirtualItems();
    for (const item of items) {
      const next = item.start - scrollMargin;
      const el = instance2.elementsCache.get(item.key);
      if (!el) continue;
      if (state.lastPositions.get(el) === next) continue;
      state.lastPositions.set(el, next);
      if (useTransform)
        el.style.transform = horizontal
          ? `translate3d(${next}px, 0, 0)`
          : `translate3d(0, ${next}px, 0)`;
      else el.style[posAxis] = `${next}px`;
    }
  };
  const resolvedOptions = {
    ...options,
    onChange: (instance2, sync) => {
      var _a;
      const state = directRef.current;
      let shouldRerender = true;
      if (state.enabled) {
        applyDirectStyles(instance2);
        const range = instance2.range;
        const prev = state.prevRange;
        shouldRerender =
          !prev ||
          prev.isScrolling !== instance2.isScrolling ||
          prev.startIndex !== (range == null ? void 0 : range.startIndex) ||
          prev.endIndex !== (range == null ? void 0 : range.endIndex);
        if (shouldRerender)
          state.prevRange = range
            ? {
                startIndex: range.startIndex,
                endIndex: range.endIndex,
                isScrolling: instance2.isScrolling,
              }
            : null;
      }
      if (shouldRerender) {
        if (useFlushSync && sync && !measuringFromRef.current)
          (0, import_react_dom.flushSync)(rerender);
        else rerender();
      }
      (_a = options.onChange) == null || _a.call(options, instance2, sync);
    },
  };
  const [instance] = import_react.useState(() => {
    const v = new Virtualizer(resolvedOptions);
    const measureElement = v.measureElement;
    v.measureElement = (node) => {
      measuringFromRef.current = true;
      try {
        measureElement(node);
      } finally {
        measuringFromRef.current = false;
      }
    };
    return Object.assign(v, {
      containerRef: (node) => {
        const state = directRef.current;
        state.container = node;
        state.lastSize = null;
        if (node && state.enabled) {
          const total = v.getTotalSize();
          state.lastSize = total;
          const axis = v.options.horizontal ? "width" : "height";
          node.style[axis] = `${total}px`;
        }
      },
    });
  });
  instance.setOptions(resolvedOptions);
  useIsomorphicLayoutEffect(() => {
    return instance._didMount();
  }, []);
  useIsomorphicLayoutEffect(() => {
    applyContainerSize(instance);
    return instance._willUpdate();
  });
  useIsomorphicLayoutEffect(() => {
    applyDirectStyles(instance);
  });
  return instance;
}
function useVirtualizer(options) {
  return useVirtualizerBase({
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    ...options,
  });
}
//#endregion
//#region ../../packages/ui/src/components/table/primitive.tsx
var import_jsx_runtime = require_jsx_runtime();
function TableHeader({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
    "data-slot": "table-header",
    className: cn("[&_tr]:border-b", className),
    ...props,
  });
}
function TableBody({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", {
    "data-slot": "table-body",
    className: cn("[&_tr:last-child]:border-0", className),
    ...props,
  });
}
function TableRow({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
    "data-slot": "table-row",
    className: cn(
      "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
      className,
    ),
    ...props,
  });
}
function TableHead({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
    "data-slot": "table-head",
    className: cn(
      "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    ),
    ...props,
  });
}
function TableCell({ className, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
    "data-slot": "table-cell",
    className: cn(
      "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    ),
    ...props,
  });
}
//#endregion
//#region ../../packages/ui/src/components/table/data.tsx
var ROW_HEIGHT = 66;
var OVERSCAN_ROWS = 8;
var features = tableFeatures({ columnMeta: metaHelper() });
function DataTable({ columns, data, getRowId, label, onEndReached, className }) {
  const scroller = (0, import_react.useRef)(null);
  const reportedAt = (0, import_react.useRef)(-1);
  const table = useTable({
    features,
    columns,
    data,
    getRowId,
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
  });
  const headerRows = table.getHeaderGroups().length;
  const items = virtualizer.getVirtualItems();
  const before = items[0]?.start ?? 0;
  const after = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
  function checkEnd(node) {
    if (
      node.scrollHeight - node.scrollTop - node.clientHeight >= 660 ||
      reportedAt.current === rows.length
    )
      return;
    reportedAt.current = rows.length;
    onEndReached?.();
  }
  function attach(node) {
    scroller.current = node;
    if (node) checkEnd(node);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
    ref: attach,
    onScroll: ({ currentTarget }) => checkEnd(currentTarget),
    tabIndex: 0,
    role: "region",
    "aria-label": label,
    className: cn("relative overflow-auto rounded-lg border bg-card shadow-sm", className),
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
      "aria-rowcount": rows.length + headerRows,
      className: "w-full text-sm",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableHeader, {
          className: "sticky top-0 z-10 bg-card",
          children: table.getHeaderGroups().map((group, index) =>
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              TableRow,
              {
                "aria-rowindex": index + 1,
                className: "hover:bg-transparent",
                children: group.headers.map((header) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    TableHead,
                    {
                      className: cn(
                        "h-10 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground",
                        header.column.columnDef.meta?.align === "right" && "text-right",
                        header.column.columnDef.meta?.className,
                      ),
                      children: header.isPlaceholder
                        ? null
                        : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(table.FlexRender, { header }),
                    },
                    header.id,
                  ),
                ),
              },
              group.id,
            ),
          ),
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TableBody, {
          children: [
            before > 0 &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpacerRow, {
                height: before,
                span: columns.length,
              }),
            items.map((item) => {
              const row = rows[item.index];
              return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                TableRow,
                {
                  ref: virtualizer.measureElement,
                  "data-index": item.index,
                  "aria-rowindex": item.index + 1 + headerRows,
                  className: "h-16.5",
                  children: row.getAllCells().map((cell) =>
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                      TableCell,
                      {
                        className: cn(
                          "px-4",
                          cell.column.columnDef.meta?.align === "right" && "text-right",
                          cell.column.columnDef.meta?.className,
                        ),
                        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(table.FlexRender, {
                          cell,
                        }),
                      },
                      cell.id,
                    ),
                  ),
                },
                row.id,
              );
            }),
            after > 0 &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpacerRow, {
                height: after,
                span: columns.length,
              }),
          ],
        }),
      ],
    }),
  });
}
function SpacerRow({ height, span }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
    "aria-hidden": true,
    style: { height },
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
      colSpan: span,
      className: "p-0",
    }),
  });
}
//#endregion
export { DataTable as t };
