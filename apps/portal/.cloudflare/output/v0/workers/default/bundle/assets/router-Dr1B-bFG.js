import { a as __toESM, r as __exportAll } from "./rolldown-runtime-7_rZTKki.js";
import {
  A as maxValue,
  B as parse,
  H as picklist,
  I as number,
  L as object,
  M as minValue,
  O as looseObject,
  P as null_,
  Q as string,
  R as omit,
  U as pipe,
  W as rawCheck,
  et as transform,
  i as require_react,
  m as array,
  q as regex,
  r as require_jsx_runtime,
  tt as trim,
  z as optional,
} from "./react-dom-BCYT53bd.js";
import { _ as mappingInput } from "./inputs-CH80xucg.js";
import {
  A as pinInput,
  C as roleListResponse,
  D as deviceListItem,
  P as userListResponse,
  S as roleListItem,
  _ as registrationViewResponse,
  a as invitationPreviewResponse,
  b as permissionListResponse,
  i as invitationListItem,
  j as revokeDeviceInput,
  k as enrollmentIssueInput,
  r as invitationIssueSchema,
  t as invitationAcceptResponse,
  u as registrationCompleteResponse,
} from "./schemas-DUCUNo6u.js";
import { a as rootRouteId, n as Outlet } from "./Match-C7HVSA6L.js";
import { n as redirect } from "./redirect-gaJ0mgfA.js";
import {
  T as isModuleNotFoundError,
  a as cleanPath,
  d as trimPathLeft,
  f as trimPathRight,
  i as useHydrated,
  t as useRouter,
  y as escapeHtml,
} from "./useRouter-DvEAwN-p.js";
import {
  a as getScriptPreloadAttrs,
  c as resolveManifestCssLink,
  f as RouterCore,
  g as createNonReactiveReadonlyStore,
  h as createNonReactiveMutableStore,
  i as getAssetCrossOrigin,
  t as appendUniqueUserTags,
  u as _getAssetMatches,
} from "./manifest-CgoYyAEh.js";
import { t as invariant } from "./invariant-tf8rw-KL.js";
import { n as useLayoutEffect, t as reactUse } from "./utils-DKOW6C-L.js";
import { t as Link$1 } from "./link-Dm8tj3is.js";
import { t as useMatch } from "./useMatch-CMI_LVJC.js";
import {
  A as functionalUpdate,
  B as resolveQueryValue,
  C as focusManager,
  F as matchMutation,
  I as matchQuery,
  K as QueryClientProvider,
  L as noop,
  M as hashQueryKeyByOptions,
  R as partialMatchKey,
  S as notifyManager,
  U as skipToken,
  c as Button,
  g as Mutation,
  h as useMutation,
  i as currentShop,
  j as hashKey,
  n as ApiError,
  q as useQueryClient,
  r as apiFetch,
  t as createLucideIcon,
  w as Subscribable,
  x as onlineManager,
} from "./createLucideIcon-DmKyVZgg.js";
import { a as Query, t as queryOptions } from "./queryOptions-eKLVKX7x.js";
import { t as AppBackdrop } from "./backdrop-CU13Mil9.js";
import { n as CardContent, t as Card } from "./card-Bdbyfds4.js";
import {
  a as EmptyMedia,
  i as EmptyHeader,
  n as EmptyContent,
  o as EmptyTitle,
  r as EmptyDescription,
  t as Empty,
} from "./empty-DvK46B-6.js";
import { t as Skeleton } from "./skeleton-BcUuuc0v.js";
import { c as productPage, n as categoryView, s as productDetail } from "./schemas-B4d_8FW9.js";
import { n as productQuery, t as branchesQuery } from "./detail-BqLEd-GC.js";
import { i as toast, t as Kbd } from "./kbd-DLpSQiun.js";
import { a as toProductBody } from "./catalogue-BxH-8PyC.js";
import { t as Package } from "./package-BBsfbWFw.js";
import { t as permissionsQuery } from "./permissions--dOQAlW8.js";
import {
  c as toBranchBody,
  l as toStoreBody,
  n as branchView,
  s as storeView,
} from "./management-BtgoPGrQ.js";
import { n as linkProblem, r as publicFetch, t as brokenLink } from "./api-DjRs8MRa.js";
import { i as requireSession, t as currentOrgQuery } from "./session-DN4yT67X.js";
import { t as useSignIn } from "./login-DiQv0Gul.js";
//#region ../../node_modules/.pnpm/@tanstack+router-core@1.171.34/node_modules/@tanstack/router-core/dist/esm/ssr/bodyScripts.js
function getSsrBodyScriptParts(matches, manifest, nonce, routeScriptAttrs) {
  const assetMatches = _getAssetMatches(matches);
  const routeScripts = [];
  const manifestScripts = [];
  for (const match of assetMatches)
    for (const script of Array.isArray(match.scripts) ? match.scripts : []) {
      if (!script) continue;
      const { children, ...attrs } = script;
      routeScripts.push({
        tag: "script",
        attrs: {
          ...attrs,
          ...routeScriptAttrs,
          nonce,
        },
        children,
      });
    }
  if (manifest)
    for (const match of assetMatches)
      for (const asset of manifest.routes[match.routeId]?.scripts ?? [])
        manifestScripts.push({
          tag: "script",
          attrs: {
            ...asset.attrs,
            nonce,
          },
          children: asset.children,
        });
  return [routeScripts, manifestScripts];
}
function composeSsrBodyScripts([routeScripts, manifestScripts], initialHydrationScripts) {
  if (!initialHydrationScripts) return [...routeScripts, ...manifestScripts];
  return [
    ...initialHydrationScripts.before,
    ...routeScripts,
    ...manifestScripts,
    initialHydrationScripts.boundary,
  ];
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+router-core@1.171.34/node_modules/@tanstack/router-core/dist/esm/route.js
var BaseRoute = class {
  get to() {
    return this._to;
  }
  get id() {
    return this._id;
  }
  get path() {
    return this._path;
  }
  get fullPath() {
    return this._fullPath;
  }
  constructor(options) {
    this.init = (originalIndex) => {
      this.originalIndex = originalIndex;
      this._branch = void 0;
      const options = this.options;
      const isRoot = !options?.path && !options?.id;
      this.parentRoute = this.options.getParentRoute?.();
      if (isRoot) this._path = rootRouteId;
      else if (!this.parentRoute) invariant();
      let path = isRoot ? rootRouteId : options?.path;
      if (path && path !== "/") path = trimPathLeft(path);
      const customId = options?.id || path;
      const id = isRoot
        ? rootRouteId
        : cleanPath(
            (this.parentRoute.id === "__root__" ? "" : this.parentRoute.id) +
              "/" +
              (customId ?? ""),
          );
      if (path === "__root__") path = "/";
      const fullPath =
        id === "__root__"
          ? "/"
          : path === void 0
            ? this.parentRoute.fullPath
            : cleanPath(this.parentRoute.fullPath + "/" + path);
      this._path = path;
      this._id = id;
      this._fullPath = fullPath;
      this._to = trimPathRight(fullPath);
    };
    this.addChildren = (children) => {
      return this._addFileChildren(children);
    };
    this._addFileChildren = (children) => {
      if (Array.isArray(children)) this.children = children;
      if (typeof children === "object" && children !== null)
        this.children = Object.values(children);
      return this;
    };
    this._addFileTypes = () => {
      return this;
    };
    this.updateLoader = (options) => {
      Object.assign(this.options, options);
      return this;
    };
    this.update = (options) => {
      Object.assign(this.options, options);
      return this;
    };
    this.lazy = (lazyFn) => {
      this.lazyFn = lazyFn;
      return this;
    };
    this.redirect = (opts) =>
      redirect({
        from: this.fullPath,
        ...opts,
      });
    this.options = options || {};
    this.isRoot = !options?.getParentRoute;
    if (options?.id && options?.path)
      throw new Error(`Route cannot have both an 'id' and a 'path' option.`);
  }
};
var BaseRootRoute = class extends BaseRoute {
  constructor(options) {
    super(options);
  }
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+store@0.11.2/node_modules/@tanstack/store/dist/alien.js
/* @__NO_SIDE_EFFECTS__ */
function createReactiveSystem({ update, notify, unwatched }) {
  return {
    link,
    unlink,
    propagate,
    checkDirty,
    shallowPropagate,
  };
  function link(dep, sub, version) {
    const prevDep = sub.depsTail;
    if (prevDep !== void 0 && prevDep.dep === dep) return;
    const nextDep = prevDep !== void 0 ? prevDep.nextDep : sub.deps;
    if (nextDep !== void 0 && nextDep.dep === dep) {
      nextDep.version = version;
      sub.depsTail = nextDep;
      return;
    }
    const prevSub = dep.subsTail;
    if (prevSub !== void 0 && prevSub.version === version && prevSub.sub === sub) return;
    const newLink =
      (sub.depsTail =
      dep.subsTail =
        {
          version,
          dep,
          sub,
          prevDep,
          nextDep,
          prevSub,
          nextSub: void 0,
        });
    if (nextDep !== void 0) nextDep.prevDep = newLink;
    if (prevDep !== void 0) prevDep.nextDep = newLink;
    else sub.deps = newLink;
    if (prevSub !== void 0) prevSub.nextSub = newLink;
    else dep.subs = newLink;
  }
  function unlink(link, sub = link.sub) {
    const dep = link.dep;
    const prevDep = link.prevDep;
    const nextDep = link.nextDep;
    const nextSub = link.nextSub;
    const prevSub = link.prevSub;
    if (nextDep !== void 0) nextDep.prevDep = prevDep;
    else sub.depsTail = prevDep;
    if (prevDep !== void 0) prevDep.nextDep = nextDep;
    else sub.deps = nextDep;
    if (nextSub !== void 0) nextSub.prevSub = prevSub;
    else dep.subsTail = prevSub;
    if (prevSub !== void 0) prevSub.nextSub = nextSub;
    else if ((dep.subs = nextSub) === void 0) unwatched(dep);
    return nextDep;
  }
  function propagate(link) {
    let next = link.nextSub;
    let stack;
    top: do {
      const sub = link.sub;
      let flags = sub.flags;
      if (!(flags & 60)) sub.flags = flags | 32;
      else if (!(flags & 12)) flags = 0;
      else if (!(flags & 4)) sub.flags = (flags & -9) | 32;
      else if (!(flags & 48) && isValidLink(link, sub)) {
        sub.flags = flags | 40;
        flags &= 1;
      } else flags = 0;
      if (flags & 2) notify(sub);
      if (flags & 1) {
        const subSubs = sub.subs;
        if (subSubs !== void 0) {
          const nextSub = (link = subSubs).nextSub;
          if (nextSub !== void 0) {
            stack = {
              value: next,
              prev: stack,
            };
            next = nextSub;
          }
          continue;
        }
      }
      if ((link = next) !== void 0) {
        next = link.nextSub;
        continue;
      }
      while (stack !== void 0) {
        link = stack.value;
        stack = stack.prev;
        if (link !== void 0) {
          next = link.nextSub;
          continue top;
        }
      }
      break;
    } while (true);
  }
  function checkDirty(link, sub) {
    let stack;
    let checkDepth = 0;
    let dirty = false;
    top: do {
      const dep = link.dep;
      const flags = dep.flags;
      if (sub.flags & 16) dirty = true;
      else if ((flags & 17) === 17) {
        if (update(dep)) {
          const subs = dep.subs;
          if (subs.nextSub !== void 0) shallowPropagate(subs);
          dirty = true;
        }
      } else if ((flags & 33) === 33) {
        if (link.nextSub !== void 0 || link.prevSub !== void 0)
          stack = {
            value: link,
            prev: stack,
          };
        link = dep.deps;
        sub = dep;
        ++checkDepth;
        continue;
      }
      if (!dirty) {
        const nextDep = link.nextDep;
        if (nextDep !== void 0) {
          link = nextDep;
          continue;
        }
      }
      while (checkDepth--) {
        const firstSub = sub.subs;
        const hasMultipleSubs = firstSub.nextSub !== void 0;
        if (hasMultipleSubs) {
          link = stack.value;
          stack = stack.prev;
        } else link = firstSub;
        if (dirty) {
          if (update(sub)) {
            if (hasMultipleSubs) shallowPropagate(firstSub);
            sub = link.sub;
            continue;
          }
          dirty = false;
        } else sub.flags &= -33;
        sub = link.sub;
        const nextDep = link.nextDep;
        if (nextDep !== void 0) {
          link = nextDep;
          continue top;
        }
      }
      return dirty;
    } while (true);
  }
  function shallowPropagate(link) {
    do {
      const sub = link.sub;
      const flags = sub.flags;
      if ((flags & 48) === 32) {
        sub.flags = flags | 16;
        if ((flags & 6) === 2) notify(sub);
      }
    } while ((link = link.nextSub) !== void 0);
  }
  function isValidLink(checkLink, sub) {
    let link = sub.depsTail;
    while (link !== void 0) {
      if (link === checkLink) return true;
      link = link.prevDep;
    }
    return false;
  }
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+store@0.11.2/node_modules/@tanstack/store/dist/atom.js
function toObserver(nextHandler, errorHandler, completionHandler) {
  const isObserver = typeof nextHandler === "object";
  const self = isObserver ? nextHandler : void 0;
  return {
    next: (isObserver ? nextHandler.next : nextHandler)?.bind(self),
    error: (isObserver ? nextHandler.error : errorHandler)?.bind(self),
    complete: (isObserver ? nextHandler.complete : completionHandler)?.bind(self),
  };
}
var queuedEffects = [];
var cycle = 0;
var {
  link: link$1,
  unlink,
  propagate,
  checkDirty,
  shallowPropagate,
} = /* @__PURE__ */ createReactiveSystem({
  update(atom) {
    return atom._update();
  },
  notify(effect) {
    queuedEffects[queuedEffectsLength++] = effect;
    effect.flags &= -3;
  },
  unwatched(atom) {
    if (atom.depsTail !== void 0) {
      atom.depsTail = void 0;
      atom.flags = 17;
      purgeDeps(atom);
    }
  },
});
var notifyIndex = 0;
var queuedEffectsLength = 0;
var activeSub;
var batchDepth = 0;
function batch(fn) {
  try {
    ++batchDepth;
    fn();
  } finally {
    if (!--batchDepth) flush();
  }
}
function purgeDeps(sub) {
  const depsTail = sub.depsTail;
  let dep = depsTail !== void 0 ? depsTail.nextDep : sub.deps;
  while (dep !== void 0) dep = unlink(dep, sub);
}
function flush() {
  if (batchDepth > 0) return;
  while (notifyIndex < queuedEffectsLength) {
    const effect = queuedEffects[notifyIndex];
    queuedEffects[notifyIndex++] = void 0;
    effect.notify();
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
}
function createAtom(valueOrFn, options) {
  const isComputed = typeof valueOrFn === "function";
  const getter = valueOrFn;
  const atom = {
    _snapshot: isComputed ? void 0 : valueOrFn,
    subs: void 0,
    subsTail: void 0,
    deps: void 0,
    depsTail: void 0,
    flags: isComputed ? 0 : 1,
    get() {
      if (activeSub !== void 0) link$1(atom, activeSub, cycle);
      return atom._snapshot;
    },
    subscribe(observerOrFn) {
      const obs = toObserver(observerOrFn);
      const observed = { current: false };
      const e = effect(() => {
        atom.get();
        if (!observed.current) observed.current = true;
        else {
          activeSub = void 0;
          obs.next?.(atom._snapshot);
        }
      });
      return {
        unsubscribe: () => {
          e.stop();
        },
      };
    },
    _update(getValue) {
      const prevSub = activeSub;
      const compare = options?.compare ?? Object.is;
      if (isComputed) {
        activeSub = atom;
        ++cycle;
        atom.depsTail = void 0;
      } else if (getValue === void 0) return false;
      if (isComputed) atom.flags = 5;
      try {
        const oldValue = atom._snapshot;
        const newValue =
          typeof getValue === "function"
            ? getValue(oldValue)
            : getValue === void 0 && isComputed
              ? getter(oldValue)
              : getValue;
        if (oldValue === void 0 || !compare(oldValue, newValue)) {
          atom._snapshot = newValue;
          return true;
        }
        return false;
      } finally {
        activeSub = prevSub;
        if (isComputed) atom.flags &= -5;
        purgeDeps(atom);
      }
    },
  };
  if (isComputed) {
    atom.flags = 17;
    atom.get = function () {
      const flags = atom.flags;
      if (flags & 16 || (flags & 32 && checkDirty(atom.deps, atom))) {
        if (atom._update()) {
          const subs = atom.subs;
          if (subs !== void 0) shallowPropagate(subs);
        }
      } else if (flags & 32) atom.flags = flags & -33;
      if (activeSub !== void 0) link$1(atom, activeSub, cycle);
      return atom._snapshot;
    };
  } else
    atom.set = function (valueOrFn) {
      if (atom._update(valueOrFn)) {
        const subs = atom.subs;
        if (subs !== void 0) {
          propagate(subs);
          shallowPropagate(subs);
          flush();
        }
      }
    };
  return atom;
}
function effect(fn) {
  const run = () => {
    const prevSub = activeSub;
    activeSub = effectObj;
    ++cycle;
    effectObj.depsTail = void 0;
    effectObj.flags = 6;
    try {
      return fn();
    } finally {
      activeSub = prevSub;
      effectObj.flags &= -5;
      purgeDeps(effectObj);
    }
  };
  const effectObj = {
    deps: void 0,
    depsTail: void 0,
    subs: void 0,
    subsTail: void 0,
    flags: 6,
    notify() {
      const flags = this.flags;
      if (flags & 16 || (flags & 32 && checkDirty(this.deps, this))) run();
      else this.flags = 2;
    },
    stop() {
      this.flags = 0;
      this.depsTail = void 0;
      purgeDeps(this);
    },
  };
  run();
  return effectObj;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useLoaderData.js
/**
 * Read and select the current route's loader data with type‑safety.
 *
 * Options:
 * - `from`/`strict`: Choose which route's data to read and strictness
 * - `select`: Map the loader data to a derived value
 * - `structuralSharing`: Enable structural sharing for stable references
 *
 * @returns The loader data (or selected value) for the matched route.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useLoaderDataHook
 */
function useLoaderData(opts) {
  return useMatch({
    from: opts.from,
    strict: opts.strict,
    structuralSharing: opts.structuralSharing,
    select: (match) => {
      return opts.select ? opts.select(match.loaderData) : match.loaderData;
    },
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useLoaderDeps.js
/**
 * Read and select the current route's loader dependencies object.
 *
 * Options:
 * - `from`: Choose which route's loader deps to read
 * - `select`: Map the deps to a derived value
 * - `structuralSharing`: Enable structural sharing for stable references
 *
 * @returns The loader deps (or selected value) for the matched route.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useLoaderDepsHook
 */
function useLoaderDeps(opts) {
  const { select, ...rest } = opts;
  return useMatch({
    ...rest,
    select: (match) => {
      return select ? select(match.loaderDeps) : match.loaderDeps;
    },
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useParams.js
/**
 * Access the current route's path parameters with type-safety.
 *
 * Options:
 * - `from`/`strict`: Specify the matched route and whether to enforce strict typing
 * - `select`: Project the params object to a derived value for memoized renders
 * - `structuralSharing`: Enable structural sharing for stable references
 * - `shouldThrow`: Throw if the route is not found in strict contexts
 *
 * @returns The params object (or selected value) for the matched route.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useParamsHook
 */
function useParams(opts) {
  return useMatch({
    from: opts.from,
    shouldThrow: opts.shouldThrow,
    structuralSharing: opts.structuralSharing,
    strict: opts.strict,
    select: (match) => {
      const params = opts.strict === false ? match.params : match._strictParams;
      return opts.select ? opts.select(params) : params;
    },
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useSearch.js
/**
 * Read and select the current route's search parameters with type-safety.
 *
 * Options:
 * - `from`/`strict`: Control which route's search is read and how strictly it's typed
 * - `select`: Map the search object to a derived value for render optimization
 * - `structuralSharing`: Enable structural sharing for stable references
 * - `shouldThrow`: Throw when the route is not found (strict contexts)
 *
 * @returns The search object (or selected value) for the matched route.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useSearchHook
 */
function useSearch(opts) {
  return useMatch({
    from: opts.from,
    strict: opts.strict,
    shouldThrow: opts.shouldThrow,
    structuralSharing: opts.structuralSharing,
    select: (match) => {
      return opts.select ? opts.select(match.search) : match.search;
    },
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useNavigate.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/**
 * Imperative navigation hook.
 *
 * Returns a stable `navigate(options)` function to change the current location
 * programmatically. Prefer the `Link` component for user-initiated navigation,
 * and use this hook from effects, callbacks, or handlers where imperative
 * navigation is required.
 *
 * Options:
 * - `from`: Optional route base used to resolve relative `to` paths.
 *
 * @returns A function that accepts `NavigateOptions`.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/useNavigateHook
 */
function useNavigate(_defaultOpts) {
  const router = useRouter();
  return import_react.useCallback(
    (options) => {
      return router.navigate({
        ...options,
        from: options.from ?? _defaultOpts?.from,
      });
    },
    [_defaultOpts?.from, router],
  );
}
/**
 * Component that triggers a navigation when rendered. Navigation executes
 * in an effect after mount/update.
 *
 * Props are the same as `NavigateOptions` used by `navigate()`.
 *
 * @returns null
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/navigateComponent
 */
function Navigate(props) {
  const router = useRouter();
  const navigate = useNavigate();
  const previousPropsRef = import_react.useRef(null);
  useLayoutEffect(() => {
    if (previousPropsRef.current !== props) {
      navigate(props);
      previousPropsRef.current = props;
    }
  }, [router, props, navigate]);
  return null;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/useRouteContext.js
function useRouteContext(opts) {
  return useMatch({
    ...opts,
    select: (match) => (opts.select ? opts.select(match.context) : match.context),
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/route.js
var import_jsx_runtime = require_jsx_runtime();
var Route$1 = class extends BaseRoute {
  /**
   * @deprecated Use the `createRoute` function instead.
   */
  constructor(options) {
    super(options);
    this.useMatch = (opts) => {
      return useMatch({
        ...opts,
        from: this.id,
      });
    };
    this.useRouteContext = (opts) => {
      return useRouteContext({
        ...opts,
        from: this.id,
      });
    };
    this.useSearch = (opts) => {
      return useSearch({
        ...opts,
        from: this.id,
      });
    };
    this.useParams = (opts) => {
      return useParams({
        ...opts,
        from: this.id,
      });
    };
    this.useLoaderDeps = (opts) => {
      return useLoaderDeps({
        ...opts,
        from: this.id,
      });
    };
    this.useLoaderData = (opts) => {
      return useLoaderData({
        ...opts,
        from: this.id,
      });
    };
    this.useNavigate = () => {
      return useNavigate({ from: this.fullPath });
    };
    this.Link = import_react.forwardRef((props, ref) => {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link$1, {
        ref,
        from: this.fullPath,
        ...props,
      });
    });
  }
};
/**
 * Creates a non-root Route instance for code-based routing.
 *
 * Use this to define a route that will be composed into a route tree
 * (typically via a parent route's `addChildren`). If you're using file-based
 * routing, prefer `createFileRoute`.
 *
 * @param options Route options (path, component, loader, context, etc.).
 * @returns A Route instance to be attached to the route tree.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRouteFunction
 */
function createRoute(options) {
  return new Route$1(options);
}
/**
 * Creates a root route factory that requires a router context type.
 *
 * Use when your root route expects `context` to be provided to `createRouter`.
 * The returned function behaves like `createRootRoute` but enforces a context type.
 *
 * @returns A factory function to configure and return a root route.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRootRouteWithContextFunction
 */
function createRootRouteWithContext() {
  return (options) => {
    return createRootRoute(options);
  };
}
var RootRoute = class extends BaseRootRoute {
  /**
   * @deprecated `RootRoute` is now an internal implementation detail. Use `createRootRoute()` instead.
   */
  constructor(options) {
    super(options);
    this.useMatch = (opts) => {
      return useMatch({
        ...opts,
        from: this.id,
      });
    };
    this.useRouteContext = (opts) => {
      return useRouteContext({
        ...opts,
        from: this.id,
      });
    };
    this.useSearch = (opts) => {
      return useSearch({
        ...opts,
        from: this.id,
      });
    };
    this.useParams = (opts) => {
      return useParams({
        ...opts,
        from: this.id,
      });
    };
    this.useLoaderDeps = (opts) => {
      return useLoaderDeps({
        ...opts,
        from: this.id,
      });
    };
    this.useLoaderData = (opts) => {
      return useLoaderData({
        ...opts,
        from: this.id,
      });
    };
    this.useNavigate = () => {
      return useNavigate({ from: this.fullPath });
    };
    this.Link = import_react.forwardRef((props, ref) => {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link$1, {
        ref,
        from: this.fullPath,
        ...props,
      });
    });
  }
};
/**
 * Creates a root Route instance used to build your route tree.
 *
 * Typically paired with `createRouter({ routeTree })`. If you need to require
 * a typed router context, use `createRootRouteWithContext` instead.
 *
 * @param options Root route options (component, error, pending, etc.).
 * @returns A root route instance.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRootRouteFunction
 */
function createRootRoute(options) {
  return new RootRoute(options);
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/lazyRouteComponent.js
/**
 * Wrap a dynamic import to create a route component that supports
 * `.preload()` and friendly reload-on-module-missing behavior.
 *
 * @param importer Function returning a module promise
 * @param exportName Named export to use (default: `default`)
 * @returns A lazy route component compatible with TanStack Router
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/lazyRouteComponentFunction
 */
function lazyRouteComponent(importer, exportName) {
  let loadPromise;
  let comp;
  let error;
  const load = () => {
    if (!loadPromise) {
      error = void 0;
      loadPromise = importer()
        .then((res) => {
          comp = res[exportName ?? "default"];
        })
        .catch((err) => {
          loadPromise = void 0;
          error = err;
        });
    }
    return loadPromise;
  };
  const lazyComp = function Lazy(props) {
    if (error) {
      if (isModuleNotFoundError(error) && false);
      throw error;
    }
    if (!comp)
      if (reactUse) reactUse(load());
      else throw load();
    return import_react.createElement(comp, props);
  };
  lazyComp.preload = load;
  return lazyComp;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/routerStores.js
var getStoreFactory = (opts) => {
  return {
    createMutableStore: createNonReactiveMutableStore,
    createReadonlyStore: createNonReactiveReadonlyStore,
    batch: (fn) => fn(),
  };
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/router.js
/**
 * Creates a new Router instance for React.
 *
 * Pass the returned router to `RouterProvider` to enable routing.
 * Notable options: `routeTree` (your route definitions) and `context`
 * (required if the root route was created with `createRootRouteWithContext`).
 *
 * @param options Router options used to configure the router.
 * @returns A Router instance to be provided to `RouterProvider`.
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/createRouterFunction
 */
var createRouter = (options) => {
  return new Router(options);
};
var Router = class extends RouterCore {
  constructor(options) {
    super(options, getStoreFactory);
  }
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/Asset.js
var noopScriptHandler = () => {};
function setScriptAttrs(script, attrs) {
  if (!attrs) return;
  for (const [key, value] of Object.entries(attrs))
    if (key !== "suppressHydrationWarning" && value !== void 0 && value !== false)
      script.setAttribute(key, typeof value === "boolean" ? "" : String(value));
}
function Asset(asset) {
  const { attrs, children, nonce, preventScriptHoist } = asset;
  const innerHTML = import_react.useMemo(
    () => (children === void 0 ? void 0 : { __html: children }),
    [children],
  );
  switch (asset.tag) {
    case "title":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", {
        ...attrs,
        suppressHydrationWarning: true,
        children,
      });
    case "meta":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("meta", {
        ...attrs,
        suppressHydrationWarning: true,
      });
    case "link":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("link", {
        ...attrs,
        precedence: attrs?.precedence ?? (attrs?.rel === "stylesheet" ? "default" : void 0),
        nonce,
        suppressHydrationWarning: true,
      });
    case "style":
      if (asset.inlineCss && false);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("style", {
        ...attrs,
        dangerouslySetInnerHTML: innerHTML,
        nonce,
      });
    case "script":
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Script, {
        attrs,
        preventScriptHoist,
        children,
      });
    default:
      return null;
  }
}
function Script({ attrs, children, preventScriptHoist }) {
  useRouter();
  useHydrated();
  const innerHTML = import_react.useMemo(
    () => (children === void 0 ? void 0 : { __html: children }),
    [children],
  );
  const dataScript =
    typeof attrs?.type === "string" &&
    attrs.type !== "" &&
    attrs.type !== "text/javascript" &&
    attrs.type !== "module";
  import_react.useEffect(() => {
    if (dataScript) return;
    if (attrs?.src) {
      const link = document.createElement("a");
      link.href = attrs.src;
      const normSrc = link.href;
      for (const el of document.scripts) if (el.src === normSrc) return;
      const script = document.createElement("script");
      setScriptAttrs(script, attrs);
      document.head.appendChild(script);
      return () => script.remove();
    }
    if (typeof children === "string") {
      const typeAttr = typeof attrs?.type === "string" ? attrs.type : "text/javascript";
      const nonceAttr = typeof attrs?.nonce === "string" ? attrs.nonce : void 0;
      for (const el of document.scripts) {
        if (el.hasAttribute("src")) continue;
        const sType = el.getAttribute("type") ?? "text/javascript";
        const sNonce = el.getAttribute("nonce") ?? void 0;
        if (el.textContent === children && sType === typeAttr && sNonce === nonceAttr) return;
      }
      const script = document.createElement("script");
      script.textContent = children;
      setScriptAttrs(script, attrs);
      document.head.appendChild(script);
      return () => script.remove();
    }
  }, [attrs, children, dataScript]);
  if (attrs?.src) {
    if (!preventScriptHoist)
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", {
        ...attrs,
        suppressHydrationWarning: true,
      });
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", {
      ...attrs,
      onLoad: noopScriptHandler,
      suppressHydrationWarning: true,
    });
  }
  if (typeof children === "string")
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("script", {
      ...attrs,
      dangerouslySetInnerHTML: innerHTML,
      suppressHydrationWarning: true,
    });
  return null;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/headContentUtils.js
function buildTagsFromMatches(router, nonce, matches, assetCrossOrigin) {
  matches = _getAssetMatches(matches);
  const routeMeta = matches.map((match) => match.meta).filter((meta) => meta !== void 0);
  const resultMeta = [];
  const metaByAttribute = {};
  let title;
  for (let i = routeMeta.length - 1; i >= 0; i--) {
    const metas = routeMeta[i];
    for (let j = metas.length - 1; j >= 0; j--) {
      const m = metas[j];
      if (!m) continue;
      if (m.title) {
        if (!title)
          title = {
            tag: "title",
            children: m.title,
          };
      } else if ("script:ld+json" in m)
        try {
          const json = JSON.stringify(m["script:ld+json"]);
          resultMeta.push({
            tag: "script",
            attrs: { type: "application/ld+json" },
            children: escapeHtml(json),
          });
        } catch {}
      else {
        const attribute = m.name ?? m.property;
        if (attribute)
          if (metaByAttribute[attribute]) continue;
          else metaByAttribute[attribute] = true;
        resultMeta.push({
          tag: "meta",
          attrs: {
            ...m,
            nonce,
          },
        });
      }
    }
  }
  if (title) resultMeta.push(title);
  if (nonce)
    resultMeta.push({
      tag: "meta",
      attrs: {
        property: "csp-nonce",
        content: nonce,
      },
    });
  resultMeta.reverse();
  const constructedLinks = matches
    .flatMap((match) => match.links ?? [])
    .filter((link) => link !== void 0)
    .map((link) => ({
      tag: "link",
      attrs: {
        ...link,
        nonce,
      },
    }));
  const manifest = router.ssr?.manifest;
  const manifestCssTags = [];
  if (manifest) {
    matches.forEach((match) => {
      manifest.routes[match.routeId]?.css?.forEach((link) => {
        const resolvedLink = resolveManifestCssLink(link);
        manifestCssTags.push({
          tag: "link",
          attrs: {
            rel: "stylesheet",
            ...resolvedLink,
            crossOrigin:
              getAssetCrossOrigin(assetCrossOrigin, "stylesheet") ?? resolvedLink.crossOrigin,
            suppressHydrationWarning: true,
            nonce,
          },
        });
      });
    });
    if (manifest.inlineStyle)
      manifestCssTags.push({
        tag: "style",
        attrs: {
          ...manifest.inlineStyle.attrs,
          nonce,
        },
        children: manifest.inlineStyle.children,
        inlineCss: true,
      });
  }
  const preloadLinks = [];
  if (manifest)
    matches.forEach((match) => {
      manifest.routes[match.routeId]?.preloads?.forEach((preload) => {
        preloadLinks.push({
          tag: "link",
          attrs: {
            ...getScriptPreloadAttrs(manifest, preload, assetCrossOrigin),
            nonce,
          },
        });
      });
    });
  const styles = matches
    .flatMap((match) => match.styles ?? [])
    .filter((style) => style !== void 0)
    .map(({ children, ...attrs }) => ({
      tag: "style",
      attrs: {
        ...attrs,
        nonce,
      },
      children,
    }));
  const headScripts = matches
    .flatMap((match) => match.headScripts ?? [])
    .filter((script) => script !== void 0)
    .map(({ children, ...script }) => ({
      tag: "script",
      attrs: {
        ...script,
        nonce,
      },
      children,
    }));
  const tags = [];
  appendUniqueUserTags(tags, resultMeta);
  tags.push(...preloadLinks);
  appendUniqueUserTags(tags, constructedLinks);
  tags.push(...manifestCssTags);
  appendUniqueUserTags(tags, styles);
  appendUniqueUserTags(tags, headScripts);
  return tags;
}
/**
 * Build the head/link/meta/script tags from the renderable presented prefix.
 * Used internally by `HeadContent`.
 */
var useTags = (assetCrossOrigin) => {
  const router = useRouter();
  const nonce = router.options.ssr?.nonce;
  return buildTagsFromMatches(router, nonce, router.stores.matches.get(), assetCrossOrigin);
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/HeadContent.js
/**
 * Render route-managed head tags (title, meta, links, styles, head scripts).
 * Place inside the document head of your app shell.
 * @link https://tanstack.com/router/latest/docs/framework/react/guide/document-head-management
 */
function HeadContent(props) {
  const tags = useTags(props.assetCrossOrigin);
  const nonce = useRouter().options.ssr?.nonce;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, {
    children: tags.map((tag) =>
      /* @__PURE__ */ (0, import_react.createElement)(Asset, {
        ...tag,
        key: `tsr-meta-${JSON.stringify(tag)}`,
        nonce,
      }),
    ),
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-router@1.170.41_react-dom@19.3.0_react@19.3.0__react@19.3.0/node_modules/@tanstack/react-router/dist/esm/Scripts.js
var routeScriptAttrs = { suppressHydrationWarning: true };
/**
 * Render body script tags collected from route matches and SSR manifests.
 * During streaming SSR, `<Scripts>` marks where late hydration scripts may
 * begin to be inserted.
 */
var Scripts = () => {
  const router = useRouter();
  const nonce = router.options.ssr?.nonce;
  const getParts = (matches) => {
    const parts = getSsrBodyScriptParts(matches, router.ssr?.manifest, nonce, routeScriptAttrs);
    for (const script of parts[1])
      if (typeof script.attrs?.src === "string") {
        const scriptWithHoist = script;
        scriptWithHoist.preventScriptHoist = true;
      }
    return parts;
  };
  return renderScripts(
    composeSsrBodyScripts(
      getParts(router.stores.matches.get()),
      router.serverSsr?.takeInitialHydrationScriptTags(),
    ),
  );
};
function renderScripts(scripts) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, {
    children: scripts.map((asset, i) =>
      /* @__PURE__ */ (0, import_react.createElement)(Asset, {
        ...asset,
        key: `tsr-scripts-${asset.tag}-${i}`,
      }),
    ),
  });
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/mutationCache.js
/**
 * The `MutationCache` is the storage for mutations.
 *
 * Normally, you will not interact with the `MutationCache` directly and instead use a
 * `QueryClient`. You can subscribe to it (inherited from `Subscribable`) to be informed of
 * safe/known updates to the cache, such as mutations being added, removed, or updated.
 *
 * @example
 * ```ts
 * const unsubscribe = mutationCache.subscribe((event) => {
 *   console.log(event.type, event.mutation)
 * })
 * ```
 */
var MutationCache = class extends Subscribable {
  #mutations;
  #scopes;
  #mutationId;
  constructor(config = {}) {
    super();
    this.config = config;
    this.#mutations = /* @__PURE__ */ new Set();
    this.#scopes = /* @__PURE__ */ new Map();
    this.#mutationId = 0;
  }
  /** @internal */
  build(client, options, state) {
    const mutation = new Mutation({
      client,
      mutationCache: this,
      mutationId: ++this.#mutationId,
      options: client.defaultMutationOptions(options),
      state,
    });
    this.add(mutation);
    return mutation;
  }
  /** @internal */
  add(mutation) {
    this.#mutations.add(mutation);
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const scopedMutations = this.#scopes.get(scope);
      if (scopedMutations) scopedMutations.push(mutation);
      else this.#scopes.set(scope, [mutation]);
    }
    this.notify({
      type: "added",
      mutation,
    });
  }
  /** @internal */
  remove(mutation) {
    if (this.#mutations.delete(mutation)) {
      const scope = scopeFor(mutation);
      if (typeof scope === "string") {
        const scopedMutations = this.#scopes.get(scope);
        if (scopedMutations) {
          if (scopedMutations.length > 1) {
            const index = scopedMutations.indexOf(mutation);
            if (index !== -1) scopedMutations.splice(index, 1);
          } else if (scopedMutations[0] === mutation) this.#scopes.delete(scope);
        }
      }
    }
    this.notify({
      type: "removed",
      mutation,
    });
  }
  /** @internal */
  canRun(mutation) {
    const scope = scopeFor(mutation);
    if (typeof scope === "string") {
      const firstPendingMutation = this.#scopes
        .get(scope)
        ?.find((m) => m.state.status === "pending");
      return !firstPendingMutation || firstPendingMutation === mutation;
    } else return true;
  }
  /** @internal */
  runNext(mutation) {
    const scope = scopeFor(mutation);
    if (typeof scope === "string")
      return (
        this.#scopes
          .get(scope)
          ?.find((m) => m !== mutation && m.state.isPaused)
          ?.continue() ?? Promise.resolve()
      );
    else return Promise.resolve();
  }
  /**
   * Removes all mutations from the cache.
   *
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * mutationCache.clear()
   * ```
   */
  clear() {
    notifyManager.batch(() => {
      this.#mutations.forEach((mutation) => {
        this.notify({
          type: "removed",
          mutation,
        });
      });
      this.#mutations.clear();
      this.#scopes.clear();
    });
  }
  /**
   * Returns all mutations within the cache.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about a mutation in rare scenarios.
   *
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * const mutations = mutationCache.getAll()
   * ```
   */
  getAll() {
    return Array.from(this.#mutations);
  }
  /**
   * A slightly more advanced method that can be used to get an existing mutation instance from
   * the cache. If the mutation does not exist, `undefined` is returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about a mutation in rare scenarios.
   *
   * @see {@link MutationCache#findAll}
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
   * ```
   */
  find(filters) {
    const defaultedFilters = {
      exact: true,
      ...filters,
    };
    return this.getAll().find((mutation) => matchMutation(defaultedFilters, mutation));
  }
  /**
   * An even more advanced method that can be used to get existing mutation instances from the
   * cache that match the given filters. If no mutations match, an empty array is returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about mutations in rare scenarios.
   *
   * @see {@link MutationCache#find}
   * @example
   * ```ts
   * const mutationCache = queryClient.getMutationCache()
   *
   * const mutations = mutationCache.findAll({ mutationKey: ['addPost'] })
   * ```
   */
  findAll(filters = {}) {
    return this.getAll().filter((mutation) => matchMutation(filters, mutation));
  }
  /** @internal */
  notify(event) {
    notifyManager.batch(() => {
      this.listeners.forEach((listener) => {
        listener(event);
      });
    });
  }
  /** @internal */
  resumePausedMutations() {
    const pausedMutations = this.getAll().filter((x) => x.state.isPaused);
    return notifyManager.batch(() =>
      Promise.all(pausedMutations.map((mutation) => mutation.continue().catch(noop))),
    );
  }
};
function scopeFor(mutation) {
  return mutation.options.scope?.id;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/queryCache.js
/**
 * The `QueryCache` is the storage mechanism for TanStack Query. It stores all the data, meta
 * information, and state of the queries it contains.
 *
 * Normally, you will not interact with the `QueryCache` directly and instead use a `QueryClient`
 * for a specific cache. You can subscribe to it (inherited from `Subscribable`) to be informed of
 * safe/known updates to the cache, such as queries being added, removed, or updated — updates made
 * outside of the cache's own tracked mechanisms (e.g. mutating a query's state object directly) do
 * not notify subscribers.
 *
 * @example
 * ```ts
 * const unsubscribe = queryCache.subscribe((event) => {
 *   console.log(event.type, event.query)
 * })
 * ```
 */
var QueryCache = class extends Subscribable {
  #queries;
  constructor(config = {}) {
    super();
    this.config = config;
    this.#queries = /* @__PURE__ */ new Map();
  }
  /**
   * Returns the existing `Query` instance for the given options' `queryKey`/`queryHash`, or
   * builds and adds a new one to the cache if none exists yet. Used by framework adapters and
   * plugins (e.g. broadcast/persistence) that need to get-or-create a `Query` directly, bypassing
   * the reactive `QueryObserver` machinery.
   *
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const query = queryCache.build(queryClient, {
   *   queryKey: ['posts'],
   *   queryFn: fetchPosts,
   * })
   * ```
   */
  build(client, options, state) {
    const queryKey = options.queryKey;
    const queryHash = options.queryHash ?? hashQueryKeyByOptions(queryKey, options);
    let query = this.get(queryHash);
    if (!query) {
      query = new Query({
        client,
        queryKey,
        queryHash,
        options: client.defaultQueryOptions(options),
        state,
        defaultOptions: client.getQueryDefaults(queryKey),
      });
      this.add(query);
    }
    return query;
  }
  /** @internal */
  add(query) {
    if (!this.#queries.has(query.queryHash)) {
      this.#queries.set(query.queryHash, query);
      this.notify({
        type: "added",
        query,
      });
    }
  }
  /**
   * Destroys the given `Query` and removes it from the cache, notifying subscribers with a
   * `'removed'` event. A no-op if the query is no longer the one currently stored under its hash
   * (e.g. it was already replaced). Used by plugins (e.g. the broadcast client) that mirror
   * removals across `QueryCache` instances.
   *
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   * const query = queryCache.find({ queryKey: ['posts'] })
   *
   * if (query) {
   *   queryCache.remove(query)
   * }
   * ```
   */
  remove(query) {
    if (this.#queries.get(query.queryHash) === query) {
      query.destroy();
      this.#queries.delete(query.queryHash);
      this.notify({
        type: "removed",
        query,
      });
    }
  }
  /**
   * Removes all queries from the cache.
   *
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * queryCache.clear()
   * ```
   */
  clear() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        this.remove(query);
      });
    });
  }
  /**
   * Returns the `Query` instance stored under the given `queryHash`, or `undefined` if none
   * exists. Unlike {@link QueryCache#find}, this looks up by the already-computed hash rather
   * than by `QueryFilters`. Used by plugins (e.g. broadcast/hydration) that already have a hash
   * to look up directly.
   *
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   * const queryHash = hashKey(['posts'])
   *
   * const query = queryCache.get(queryHash)
   * ```
   */
  get(queryHash) {
    return this.#queries.get(queryHash);
  }
  /**
   * Returns all queries within the cache.
   *
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const queries = queryCache.getAll()
   * ```
   */
  getAll() {
    return [...this.#queries.values()];
  }
  /**
   * A slightly more advanced method that can be used to get an existing query instance from the
   * cache. This instance not only contains all the state for the query, but all of the instances,
   * and underlying guts of the query as well. If the query does not exist, `undefined` is
   * returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about a query in rare scenarios (e.g. looking at `query.state.dataUpdatedAt` to
   * decide whether a query is fresh enough to be used as an initial value).
   *
   * @see {@link QueryCache#findAll}
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const query = queryCache.find({ queryKey: ['posts'] })
   * ```
   */
  find(filters) {
    const defaultedFilters = {
      exact: true,
      ...filters,
    };
    return this.getAll().find((query) => matchQuery(defaultedFilters, query));
  }
  /**
   * An even more advanced method that can be used to get existing query instances from the cache
   * that partially match a query key. If no queries match, an empty array is returned.
   *
   * This is not typically needed for most applications, but can come in handy when needing more
   * information about queries in rare scenarios.
   *
   * @see {@link QueryCache#find}
   * @example
   * ```ts
   * const queryCache = queryClient.getQueryCache()
   *
   * const queries = queryCache.findAll({ queryKey: ['posts'] })
   * ```
   */
  findAll(filters = {}) {
    const queries = this.getAll();
    return Object.keys(filters).length > 0
      ? queries.filter((query) => matchQuery(filters, query))
      : queries;
  }
  /** @internal */
  notify(event) {
    notifyManager.batch(() => {
      this.listeners.forEach((listener) => {
        listener(event);
      });
    });
  }
  /** @internal */
  onFocus() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        query.onFocus();
      });
    });
  }
  /** @internal */
  onOnline() {
    notifyManager.batch(() => {
      this.getAll().forEach((query) => {
        query.onOnline();
      });
    });
  }
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/queryClient.js
/**
 * `QueryClient` is used to interact with a cache of queries and mutations. It owns a
 * `QueryCache` and a `MutationCache` (creating default ones if none are passed in) and holds
 * the default options that are applied to queries and mutations created through it.
 *
 * @example
 * ```ts
 * const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: {
 *       staleTime: Infinity,
 *     },
 *   },
 * })
 *
 * await queryClient.query({ queryKey: ['posts'], queryFn: fetchPosts })
 * ```
 */
var QueryClient = class {
  #queryCache;
  #mutationCache;
  #defaultOptions;
  #queryDefaults;
  #mutationDefaults;
  #mountCount;
  #unsubscribeFocus;
  #unsubscribeOnline;
  constructor(config = {}) {
    this.#queryCache = config.queryCache || new QueryCache();
    this.#mutationCache = config.mutationCache || new MutationCache();
    this.#defaultOptions = config.defaultOptions || {};
    this.#queryDefaults = /* @__PURE__ */ new Map();
    this.#mutationDefaults = /* @__PURE__ */ new Map();
    this.#mountCount = 0;
  }
  /**
   * Called by a framework adapter's `QueryClientProvider`-equivalent when it mounts, to start
   * listening for focus/online events and resume paused mutations. Ref-counted via an internal
   * mount count, so nested or multiple providers sharing the same `QueryClient` don't tear down
   * the shared listeners until the last one unmounts.
   */
  mount() {
    this.#mountCount++;
    if (this.#mountCount !== 1) return;
    this.#unsubscribeFocus = focusManager.subscribe(async (focused) => {
      if (focused) {
        await this.resumePausedMutations();
        this.#queryCache.onFocus();
      }
    });
    this.#unsubscribeOnline = onlineManager.subscribe(async (online) => {
      if (online) {
        await this.resumePausedMutations();
        this.#queryCache.onOnline();
      }
    });
  }
  /**
   * The inverse of {@link QueryClient#mount} — called by a framework adapter's
   * `QueryClientProvider`-equivalent when it unmounts. Only tears down the focus/online
   * listeners once the mount count returns to `0`.
   */
  unmount() {
    this.#mountCount--;
    if (this.#mountCount !== 0) return;
    this.#unsubscribeFocus?.();
    this.#unsubscribeFocus = void 0;
    this.#unsubscribeOnline?.();
    this.#unsubscribeOnline = void 0;
  }
  /**
   * Returns the number of queries in the cache that are currently fetching, optionally
   * matching a set of filters. This includes background-fetching, loading new pages, and
   * loading more infinite query results.
   *
   * @example
   * ```ts
   * if (queryClient.isFetching()) {
   *   console.log('At least one query is fetching!')
   * }
   * ```
   */
  isFetching(filters) {
    return this.#queryCache.findAll({
      ...filters,
      fetchStatus: "fetching",
    }).length;
  }
  /**
   * Returns the number of mutations in the cache that are currently pending, optionally
   * matching a set of filters.
   *
   * @example
   * ```ts
   * if (queryClient.isMutating()) {
   *   console.log('At least one mutation is pending!')
   * }
   * ```
   */
  isMutating(filters) {
    return this.#mutationCache.findAll({
      ...filters,
      status: "pending",
    }).length;
  }
  /**
   * Imperative (non-reactive) way to retrieve data for a QueryKey.
   * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
   *
   * Hint: Do not use this function inside a component, because it won't receive updates.
   * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
   *
   * @returns The cached data for the query, or `undefined` if no query with this key has been observed yet.
   * @see {@link QueryClient#getQueriesData}
   */
  getQueryData(queryKey) {
    const options = this.defaultQueryOptions({ queryKey });
    return this.#queryCache.get(options.queryHash)?.state.data;
  }
  /**
   * @deprecated Use queryClient.query({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
   */
  ensureQueryData(options) {
    const defaultedOptions = this.defaultQueryOptions(options);
    const query = this.#queryCache.build(this, defaultedOptions);
    const cachedData = query.state.data;
    if (cachedData === void 0) return this.fetchQuery(options);
    if (
      options.revalidateIfStale &&
      query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query))
    )
      this.prefetchQuery(defaultedOptions);
    return Promise.resolve(cachedData);
  }
  /**
   * Imperative (non-reactive) way to retrieve the cached data of multiple queries at once.
   * Only queries matching the given filters are returned; if none match, an empty array is
   * returned.
   *
   * Because the matched queries can hold data of different shapes (e.g. a broad filter can match
   * queries with unrelated data types), the `TQueryFnData` generic defaults to `unknown` rather
   * than being inferred. Passing a more specific type is a convenience for call sites that know
   * every matched query holds the same shape — it is not checked against the actual cache
   * contents.
   *
   * @returns An array of query key and data pairs. The data is `undefined` for a query with no cached data.
   * @see {@link QueryClient#getQueryData}
   * @example
   * ```ts
   * const data = queryClient.getQueriesData({ queryKey: ['posts'] })
   * ```
   */
  getQueriesData(filters) {
    return this.#queryCache.findAll(filters).map(({ queryKey, state }) => {
      return [queryKey, state.data];
    });
  }
  /**
   * Synchronous way to immediately update a query's cached data. If the updater (or the value
   * passed) resolves to `undefined`, the cache is left untouched and no query is created;
   * otherwise, if the query does not exist yet, it will be created. To update multiple queries
   * at once by partially matching query keys, use {@link QueryClient#setQueriesData} instead.
   *
   * Updates must be performed immutably: do not mutate `oldData`, or data previously retrieved
   * via {@link QueryClient#getQueryData}, in place.
   *
   * @param queryKey - The query key to set data for.
   * @param updater - Either the new data, or a function that receives the current data (which
   * may be `undefined`) and returns the new data.
   * @param options - Set `updatedAt` to override the timestamp the written data is recorded with.
   * @returns The data that was written, or `undefined` if the updater returned `undefined` — in that case
   * the write is skipped and the cache is left unchanged.
   *
   * @example
   * ```ts
   * queryClient.setQueryData(['posts'], newPosts)
   *
   * // Or, using an updater function that receives the current data:
   * queryClient.setQueryData(['posts'], (oldPosts) => [...oldPosts, newPost])
   * ```
   */
  setQueryData(queryKey, updater, options) {
    const defaultedOptions = this.defaultQueryOptions({ queryKey });
    const prevData = this.#queryCache.get(defaultedOptions.queryHash)?.state.data;
    const data = functionalUpdate(updater, prevData);
    if (data === void 0) return;
    return this.#queryCache.build(this, defaultedOptions).setData(data, {
      ...options,
      manual: true,
    });
  }
  /**
   * Synchronous way to immediately update the cached data of multiple queries at once, using
   * filters or partial query key matching. Only queries that already exist and match the given
   * filters are updated; no new cache entries are created. Internally this calls
   * {@link QueryClient#setQueryData} for each matching query.
   *
   * @returns One `[queryKey, data]` tuple per matched query, in the same shape and with the same
   * `undefined` case as {@link QueryClient#setQueryData}.
   * @example
   * ```ts
   * queryClient.setQueriesData({ queryKey: ['posts'] }, (oldPosts) =>
   *   oldPosts ? oldPosts.filter((post) => post.id !== deletedId) : oldPosts,
   * )
   * ```
   */
  setQueriesData(filters, updater, options) {
    return notifyManager.batch(() =>
      this.#queryCache
        .findAll(filters)
        .map(({ queryKey }) => [queryKey, this.setQueryData(queryKey, updater, options)]),
    );
  }
  /**
   * Imperative (non-reactive) way to retrieve an existing query's state. If the query does not
   * exist, `undefined` is returned.
   *
   * @example
   * ```ts
   * const state = queryClient.getQueryState(['posts'])
   * console.log(state?.dataUpdatedAt)
   * ```
   */
  getQueryState(queryKey) {
    const options = this.defaultQueryOptions({ queryKey });
    return this.#queryCache.get(options.queryHash)?.state;
  }
  /**
   * Removes queries from the cache that match the given filters. Unlike
   * {@link QueryClient#invalidateQueries} or {@link QueryClient#refetchQueries}, this removes
   * matching queries from the cache instead of refetching them. Without filters, every query in
   * the cache is removed.
   *
   * @example
   * ```ts
   * queryClient.removeQueries({ queryKey: ['posts'], exact: true })
   * ```
   */
  removeQueries(filters) {
    const queryCache = this.#queryCache;
    notifyManager.batch(() => {
      queryCache.findAll(filters).forEach((query) => {
        queryCache.remove(query);
      });
    });
  }
  /**
   * Resets queries matching the given filters back to their initial state (e.g. any
   * `initialData`), notifying subscribers rather than removing them. Active queries among the
   * matched set are then refetched, and the returned promise resolves once that refetch settles.
   *
   * @example
   * ```ts
   * await queryClient.resetQueries({ queryKey: ['posts'], exact: true })
   * ```
   */
  resetQueries(filters, options) {
    const queryCache = this.#queryCache;
    return notifyManager.batch(() => {
      const matched = queryCache.findAll(filters);
      const queriesToRefetch = new Set(matched);
      matched.forEach((query) => {
        query.reset();
      });
      return this.refetchQueries(
        {
          type: "active",
          predicate: (query) => queriesToRefetch.has(query),
        },
        options,
      );
    });
  }
  /**
   * Cancels outgoing fetches for queries matching the given filters. Most useful when performing
   * optimistic updates, since any outgoing refetch that resolves afterwards would otherwise
   * overwrite the optimistic update. By default (`revert: true`), a cancelled query's data is
   * reverted to its state before the outgoing fetch started.
   *
   * The returned promise never rejects, even if individual cancellations fail.
   *
   * @example
   * ```ts
   * await queryClient.cancelQueries({ queryKey: ['posts'], exact: true })
   * ```
   */
  cancelQueries(filters, cancelOptions = {}) {
    const defaultedCancelOptions = {
      revert: true,
      ...cancelOptions,
    };
    const promises = notifyManager.batch(() =>
      this.#queryCache.findAll(filters).map((query) => query.cancel(defaultedCancelOptions)),
    );
    return Promise.all(promises).then(noop).catch(noop);
  }
  /**
   * Marks queries matching the given filters as invalidated. Unlike
   * {@link QueryClient#removeQueries}, invalidated queries stay in the cache.
   *
   * Unless `filters.refetchType` is `'none'`, matching queries are then refetched via
   * {@link QueryClient#refetchQueries}, using `filters.refetchType` if set, otherwise
   * `filters.type`, otherwise `'active'`.
   *
   * @example
   * ```ts
   * await queryClient.invalidateQueries({ queryKey: ['posts'], refetchType: 'active' })
   * ```
   */
  invalidateQueries(filters, options = {}) {
    return notifyManager.batch(() => {
      this.#queryCache.findAll(filters).forEach((query) => {
        query.invalidate();
      });
      if (filters?.refetchType === "none") return Promise.resolve();
      return this.refetchQueries(
        {
          ...filters,
          type: filters?.refetchType ?? filters?.type ?? "active",
        },
        options,
      );
    });
  }
  /**
   * Refetches queries matching the given filters, regardless of whether they are stale. Without
   * filters, every query in the cache is refetched. Queries that are disabled, or static (only
   * have observers with a static `staleTime`), are never refetched.
   *
   * By default (`cancelRefetch: true`), a currently running fetch is cancelled before the new
   * one starts. The returned promise resolves once all matching queries have settled; it does
   * not reject on individual query failures unless `throwOnError` is set.
   *
   * @example
   * ```ts
   * // refetch all active queries partially matching a query key:
   * await queryClient.refetchQueries({ queryKey: ['posts'], type: 'active' })
   * ```
   */
  refetchQueries(filters, options = {}) {
    const fetchOptions = {
      ...options,
      cancelRefetch: options.cancelRefetch ?? true,
    };
    const promises = notifyManager.batch(() =>
      this.#queryCache
        .findAll(filters)
        .filter((query) => !query.isDisabled() && !query.isStatic())
        .map((query) => {
          let promise = query.fetch(void 0, fetchOptions);
          if (!fetchOptions.throwOnError) promise = promise.catch(noop);
          return query.state.fetchStatus === "paused" ? Promise.resolve() : promise;
        }),
    );
    return Promise.all(promises).then(noop);
  }
  /**
   * Asynchronous method to fetch and cache a query, resolving with the data or throwing with
   * the error.
   *
   * If the query already exists in the cache and its data is not stale (per the given
   * `staleTime`), the cached data is returned without fetching. Otherwise, the query is fetched
   * and the promise resolves once the fetch settles. If a `select` function is provided, it is
   * applied to the data in both cases (cached or freshly fetched) before it is returned.
   *
   * Unlike a reactive observer, retries are disabled by default here (`retry: false`) unless
   * explicitly configured, since there is no component to catch a thrown error and retry through
   * re-render.
   *
   * The accepted options are `QueryObserverOptions` minus the fields that only make sense for a
   * reactive observer — `enabled`, `refetchInterval`, `refetchIntervalInBackground`,
   * `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount`, `retryOnMount`,
   * `notifyOnChangeProps`, `throwOnError`, `suspense`, and `placeholderData` are not part of this
   * method's options.
   *
   * This method replaces the deprecated `fetchQuery`, and — combined with
   * `{ staleTime: 'static' }` — the deprecated `ensureQueryData`.
   *
   * @example
   * ```ts
   * try {
   *   const data = await queryClient.query({ queryKey, queryFn, staleTime: 10000 })
   * } catch (error) {
   *   console.log(error)
   * }
   * ```
   */
  async query(options) {
    const defaultedOptions = this.defaultQueryOptions(options);
    if (defaultedOptions.retry === void 0) defaultedOptions.retry = false;
    const query = this.#queryCache.build(this, defaultedOptions);
    const queryData = query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query))
      ? await query.fetch(defaultedOptions)
      : query.state.data;
    const select = defaultedOptions.select;
    if (select) return select(queryData);
    return queryData;
  }
  /**
   * @deprecated Use queryClient.query(options) instead. This method will be removed in the next major version.
   */
  fetchQuery(options) {
    const defaultedOptions = this.defaultQueryOptions(options);
    if (defaultedOptions.retry === void 0) defaultedOptions.retry = false;
    const query = this.#queryCache.build(this, defaultedOptions);
    return query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query))
      ? query.fetch(defaultedOptions)
      : Promise.resolve(query.state.data);
  }
  /**
   * @deprecated Use queryClient.query(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
   */
  prefetchQuery(options) {
    return this.fetchQuery(options).then(noop).catch(noop);
  }
  /**
   * Asynchronous method to fetch and cache an infinite query, resolving with an
   * {@link InfiniteData} object or throwing with the error.
   *
   * Behaves like {@link QueryClient#query}, accepting the same options (minus
   * `initialPageParam`), plus the required `initialPageParam`, and an optional `pages` /
   * `getNextPageParam` pair used to refetch a fixed number of pages from the start.
   *
   * This method replaces the deprecated `fetchInfiniteQuery`, and — combined with
   * `{ staleTime: 'static' }` — the deprecated `ensureInfiniteQueryData`.
   *
   * @example
   * ```ts
   * try {
   *   const data = await queryClient.infiniteQuery({ queryKey, queryFn, initialPageParam: 0 })
   *   console.log(data.pages)
   * } catch (error) {
   *   console.log(error)
   * }
   * ```
   */
  infiniteQuery(options) {
    options._type = "infinite";
    return this.query(options);
  }
  /**
   * @deprecated Use queryClient.infiniteQuery(options) instead. This method will be removed in the next major version.
   */
  fetchInfiniteQuery(options) {
    options._type = "infinite";
    return this.fetchQuery(options);
  }
  /**
   * @deprecated Use queryClient.infiniteQuery(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
   */
  prefetchInfiniteQuery(options) {
    return this.fetchInfiniteQuery(options).then(noop).catch(noop);
  }
  /**
   * @deprecated Use queryClient.infiniteQuery({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
   */
  ensureInfiniteQueryData(options) {
    options._type = "infinite";
    return this.ensureQueryData(options);
  }
  /**
   * Resumes mutations that were paused because there was no network connection. Does nothing
   * (resolving immediately) if the client is currently offline.
   *
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * await queryClient.resumePausedMutations()
   * ```
   */
  resumePausedMutations() {
    if (onlineManager.isOnline()) return this.#mutationCache.resumePausedMutations();
    return Promise.resolve();
  }
  /**
   * Returns the query cache this client is connected to.
   *
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * const queryCache = queryClient.getQueryCache()
   * const queries = queryCache.findAll({ queryKey: ['posts'] })
   * ```
   */
  getQueryCache() {
    return this.#queryCache;
  }
  /**
   * Returns the mutation cache this client is connected to.
   *
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * const mutationCache = queryClient.getMutationCache()
   * const mutations = mutationCache.findAll({ status: 'pending' })
   * ```
   */
  getMutationCache() {
    return this.#mutationCache;
  }
  /**
   * Returns the default options that were set when creating the client, or via
   * {@link QueryClient#setDefaultOptions}.
   *
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * const defaultOptions = queryClient.getDefaultOptions()
   * ```
   */
  getDefaultOptions() {
    return this.#defaultOptions;
  }
  /**
   * Dynamically sets the default options for this client, overwriting any previously defined
   * default options.
   *
   * @see {@link QueryClient#getDefaultOptions}
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * queryClient.setDefaultOptions({
   *   queries: {
   *     staleTime: Infinity,
   *   },
   * })
   * ```
   */
  setDefaultOptions(options) {
    this.#defaultOptions = options;
  }
  /**
   * Sets default options for queries whose query key partially matches the given `queryKey`.
   *
   * If several registered query defaults match a given query key, they are merged together in
   * registration order by {@link QueryClient#getQueryDefaults}, so register defaults from the
   * most generic key to the least generic one — more specific defaults should be registered
   * after more generic ones so they take precedence.
   *
   * @example
   * ```ts
   * queryClient.setQueryDefaults(['posts'], { queryFn: fetchPosts })
   *
   * await queryClient.query({ queryKey: ['posts'] })
   * ```
   */
  setQueryDefaults(queryKey, options) {
    this.#queryDefaults.set(hashKey(queryKey), {
      queryKey,
      defaultOptions: options,
    });
  }
  /**
   * Returns the default options registered for queries whose query key partially matches the
   * given `queryKey`, via {@link QueryClient#setQueryDefaults}. If multiple registered defaults
   * match, they are merged together in registration order.
   *
   * @example
   * ```ts
   * const defaultOptions = queryClient.getQueryDefaults(['posts'])
   * ```
   */
  getQueryDefaults(queryKey) {
    const defaults = [...this.#queryDefaults.values()];
    const result = {};
    defaults.forEach((queryDefault) => {
      if (partialMatchKey(queryKey, queryDefault.queryKey))
        Object.assign(result, queryDefault.defaultOptions);
    });
    return result;
  }
  /**
   * Sets default options for mutations whose mutation key partially matches the given
   * `mutationKey`. As with {@link QueryClient#setQueryDefaults}, the order of registration
   * matters when several registered defaults match the same mutation key.
   *
   * @see {@link QueryClient#getMutationDefaults}
   * @example
   * ```ts
   * queryClient.setMutationDefaults(['addPost'], { mutationFn: addPost })
   * ```
   */
  setMutationDefaults(mutationKey, options) {
    this.#mutationDefaults.set(hashKey(mutationKey), {
      mutationKey,
      defaultOptions: options,
    });
  }
  /**
   * Returns the default options registered for mutations whose mutation key partially matches
   * the given `mutationKey`, via {@link QueryClient#setMutationDefaults}. If multiple registered
   * defaults match, they are merged together in registration order.
   *
   * @example
   * ```ts
   * const defaultOptions = queryClient.getMutationDefaults(['addPost'])
   * ```
   */
  getMutationDefaults(mutationKey) {
    const defaults = [...this.#mutationDefaults.values()];
    const result = {};
    defaults.forEach((queryDefault) => {
      if (partialMatchKey(mutationKey, queryDefault.mutationKey))
        Object.assign(result, queryDefault.defaultOptions);
    });
    return result;
  }
  /**
   * Called by framework adapters (e.g. inside `useQuery`) to resolve the options passed by the
   * caller into their final, defaulted form: merging `queryClient.setQueryDefaults` for the
   * given `queryKey`, then the client's own `defaultOptions.queries`, then the caller's options
   * on top. A no-op if the options are already defaulted (`_defaulted: true`).
   */
  defaultQueryOptions(options) {
    if (options._defaulted) return options;
    const defaultedOptions = {
      ...this.#defaultOptions.queries,
      ...this.getQueryDefaults(options.queryKey),
      ...options,
      _defaulted: true,
    };
    if (!defaultedOptions.queryHash)
      defaultedOptions.queryHash = hashQueryKeyByOptions(
        defaultedOptions.queryKey,
        defaultedOptions,
      );
    if (defaultedOptions.refetchOnReconnect === void 0)
      defaultedOptions.refetchOnReconnect = defaultedOptions.networkMode !== "always";
    if (defaultedOptions.throwOnError === void 0)
      defaultedOptions.throwOnError = !!defaultedOptions.suspense;
    if (!defaultedOptions.networkMode && defaultedOptions.persister)
      defaultedOptions.networkMode = "offlineFirst";
    if (defaultedOptions.queryFn === skipToken) defaultedOptions.enabled = false;
    return defaultedOptions;
  }
  /**
   * The mutation counterpart of {@link QueryClient#defaultQueryOptions}. Called by framework
   * adapters (e.g. inside `useMutation`) to merge `queryClient.setMutationDefaults` for the
   * given `mutationKey`, then the client's `defaultOptions.mutations`, then the caller's options
   * on top. A no-op if the options are already defaulted (`_defaulted: true`).
   */
  defaultMutationOptions(options) {
    if (options?._defaulted) return options;
    return {
      ...this.#defaultOptions.mutations,
      ...(options?.mutationKey && this.getMutationDefaults(options.mutationKey)),
      ...options,
      _defaulted: true,
    };
  }
  /**
   * Clears both the query cache and the mutation cache this client is connected to.
   *
   * @example
   * ```ts
   * import { QueryClient } from '@tanstack/query-core'
   *
   * const queryClient = new QueryClient()
   * queryClient.clear()
   * ```
   */
  clear() {
    this.#queryCache.clear();
    this.#mutationCache.clear();
  }
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/infiniteQueryOptions.js
function infiniteQueryOptions(options) {
  return options;
}
//#endregion
//#region ../../packages/backoffice/src/schemas/routes.ts
var shopSearch = object({ shop: optional(string()) });
var catalogueSearch = object({
  q: optional(string()),
  categoryId: optional(string()),
});
/** Shared by every route: a layout-shaped skeleton while loading and one error screen. */
var routeStates = {
  pendingComponent: PageSkeleton,
  errorComponent: RouteError,
  pendingMs: 300,
};
function PageSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex flex-col gap-6",
    role: "status",
    "aria-busy": "true",
    "aria-label": "Loading",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-48" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" }),
    ],
  });
}
function ShellSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppBackdrop, {
    className: "flex flex-col gap-8",
    role: "status",
    "aria-busy": "true",
    "aria-label": "Loading",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex items-center gap-6",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-50" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-32" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "ml-auto h-9 w-72" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
            className: "size-8 rounded-full",
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageSkeleton, {}),
    ],
  });
}
function LoginSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppBackdrop, {
    className: "grid place-items-center bg-transparent p-0 shadow-none",
    role: "status",
    "aria-busy": "true",
    "aria-label": "Loading",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
      className: "w-full max-w-3xl rounded-3xl border-0 p-10",
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
        className: "flex flex-col gap-9",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-40" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-14 w-full" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-full" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-full" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
            className: "h-10 w-full rounded-full",
          }),
        ],
      }),
    }),
  });
}
function RouteError({ error, reset }) {
  const router = useRouter();
  const status = error instanceof ApiError ? error.status : void 0;
  if (status === 403)
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Message, {
      title: "You don't have permission",
      description: "Ask the shop owner to give your role access to this page.",
    });
  if (status === 404)
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Message, {
      title: "Not found",
      description: "This page or record doesn't exist, or it was removed.",
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
        asChild: true,
        variant: "outline",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link$1, {
          to: "/products",
          children: "Back to products",
        }),
      }),
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Message, {
    title: "Something went wrong",
    description: error instanceof Error ? error.message : "Try again in a moment.",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
      variant: "outline",
      onClick: () => {
        reset();
        router.invalidate();
      },
      children: "Try again",
    }),
  });
}
function Message({ title, description, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, {
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EmptyHeader, {
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyTitle, {
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: title }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyDescription, { children: description }),
        ],
      }),
      children && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyContent, { children }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/detail/states.tsx
/** Same shape as the loaded page: back link, heading, then the cards in two columns. */
function ProductSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex flex-col gap-6",
    role: "status",
    "aria-busy": "true",
    "aria-label": "Loading product",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-3",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-8 w-40" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-72" }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "grid items-start gap-6 lg:grid-cols-2",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-col gap-6",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-96 w-full" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 w-full" }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-96 w-full" }),
        ],
      }),
    ],
  });
}
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/link.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$2 = {
  name: "link",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71",
        key: "1cjeqo",
      },
    ],
    [
      "path",
      {
        d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
        key: "19qd67",
      },
    ],
  ],
};
__iconData$2.node;
var Link = createLucideIcon(__iconData$2);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/search-x.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$1 = {
  name: "search-x",
  size: 24,
  node: [
    [
      "path",
      {
        d: "m13.5 8.5-5 5",
        key: "1cs55j",
      },
    ],
    [
      "path",
      {
        d: "m8.5 8.5 5 5",
        key: "a8mexj",
      },
    ],
    [
      "circle",
      {
        cx: "11",
        cy: "11",
        r: "8",
        key: "4ej97u",
      },
    ],
    [
      "path",
      {
        d: "m21 21-4.3-4.3",
        key: "1qie3q",
      },
    ],
  ],
};
__iconData$1.node;
var SearchX = createLucideIcon(__iconData$1);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/wifi-off.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData = {
  name: "wifi-off",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M12 20h.01",
        key: "zekei9",
      },
    ],
    [
      "path",
      {
        d: "M8.5 16.429a5 5 0 0 1 7 0",
        key: "1bycff",
      },
    ],
    [
      "path",
      {
        d: "M5 12.859a10 10 0 0 1 5.17-2.69",
        key: "1dl1wf",
      },
    ],
    [
      "path",
      {
        d: "M19 12.859a10 10 0 0 0-2.007-1.523",
        key: "4k23kn",
      },
    ],
    [
      "path",
      {
        d: "M2 8.82a15 15 0 0 1 4.177-2.643",
        key: "1grhjp",
      },
    ],
    [
      "path",
      {
        d: "M22 8.82a15 15 0 0 0-11.288-3.764",
        key: "z3jwby",
      },
    ],
    [
      "path",
      {
        d: "m2 2 20 20",
        key: "1ooewy",
      },
    ],
  ],
};
__iconData.node;
var WifiOff = createLucideIcon(__iconData);
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/list/states.tsx
var SKELETON_ROWS$1 = 6;
function EmptyCatalogue({ onAdd, addRef }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, {
    className: "border",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EmptyHeader, {
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyMedia, {
            variant: "icon",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Package, { "aria-hidden": true }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyTitle, { children: "No products yet" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyDescription, {
            children: "Add your first product, or bring in a whole spreadsheet.",
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EmptyContent, {
        className: "flex-row justify-center",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
            ref: addRef,
            onClick: onAdd,
            children: [
              "Add product",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                "aria-hidden": true,
                children: "N",
              }),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            asChild: true,
            variant: "outline",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link$1, {
              to: "/imports",
              children: "Import spreadsheet",
            }),
          }),
        ],
      }),
    ],
  });
}
/** A search (or only a category) found nothing. A search comes first: it is what the user typed. */
function NoMatch({ query, onClear }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, {
    className: "border",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EmptyHeader, {
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyMedia, {
            variant: "icon",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SearchX, { "aria-hidden": true }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyTitle, {
            children: query ? "No products match" : "No products in this category",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyDescription, {
            children: query
              ? `Nothing found for "${query}". Check the spelling, or clear the search.`
              : "Pick another category, or clear the filter.",
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyContent, {
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
          variant: "outline",
          onClick: onClear,
          children: query ? "Clear search" : "Clear filters",
        }),
      }),
    ],
  });
}
function TableSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    "aria-busy": "true",
    role: "status",
    "aria-label": "Loading products",
    className: "flex flex-col rounded-lg border",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 rounded-b-none" }),
      Array.from({ length: SKELETON_ROWS$1 }, (_, index) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            className: "flex h-16.5 items-center gap-6 border-t px-4",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-56" }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
                className: "ml-auto h-4 w-20",
              }),
            ],
          },
          index,
        ),
      ),
    ],
  });
}
/** Same shape as the loaded screen: heading, toolbar, then rows. */
function ProductsSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex items-center justify-between",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-48" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-32" }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-full" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableSkeleton, {}),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/schemas/catalogue/list.ts
var categoryList = array(categoryView);
/** Newest first, a page at a time. Keyed by shop and search, so shops never share a list. */
function productsQuery({ q, categoryId }, shop = currentShop()) {
  return infiniteQueryOptions({
    queryKey: ["products", shop?.id ?? "box", q ?? "", categoryId ?? ""],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(100) });
      if (q) params.set("q", q);
      if (categoryId) params.set("categoryId", categoryId);
      if (pageParam) params.set("cursor", pageParam);
      return apiFetch(`/products?${params}`, productPage, { shopId: shop?.id ?? null });
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? void 0,
  });
}
function categoriesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["categories", shop?.id ?? "box"],
    queryFn: () => apiFetch("/categories", categoryList, { shopId: shop?.id ?? null }),
  });
}
/** Adds the product; the list is refetched so the new row shows first. */
function useCreateProduct(onCreated) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) =>
      apiFetch("/products", productDetail, {
        method: "POST",
        body: toProductBody(values),
      }),
    onSuccess: async () => {
      toast.success("Product added");
      onCreated();
      await queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}
/** Creates a top-level category from the product form and refreshes the category list. */
function useCreateCategory(onCreated) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name) =>
      apiFetch("/categories", categoryView, {
        method: "POST",
        body: { name },
      }),
    onSuccess: async (category) => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery().queryKey });
      onCreated(category);
    },
    onError: (error) => toast.error(error.message),
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/admin/states.tsx
var SKELETON_ROWS = 5;
/** A list with nothing in it yet: what it is for, and the next action. */
function EmptyList({ icon: Icon, title, description, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Empty, {
    className: "border",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EmptyHeader, {
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyMedia, {
            variant: "icon",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { "aria-hidden": true }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
            className: "text-lg font-medium tracking-tight",
            children: title,
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyDescription, { children: description }),
        ],
      }),
      children &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyContent, {
          className: "flex-row justify-center",
          children,
        }),
    ],
  });
}
/** Heading, button and rows in the shape of the loaded list, so nothing jumps when it arrives. */
function ListSkeleton({ label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex flex-col gap-6",
    role: "status",
    "aria-busy": "true",
    "aria-label": label,
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex items-center justify-between",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-48" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-9 w-32" }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col rounded-lg border",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
            className: "h-10 rounded-b-none",
          }),
          Array.from({ length: SKELETON_ROWS }, (_, index) =>
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
              "div",
              {
                className: "flex h-16.5 items-center gap-6 border-t px-4",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-5 w-56" }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
                    className: "ml-auto h-8 w-28",
                  }),
                ],
              },
              index,
            ),
          ),
        ],
      }),
    ],
  });
}
/** Tells a member who can look but not change why the screen offers no buttons. */
function ReadOnlyNote({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
    role: "note",
    className: "text-sm text-muted-foreground",
    children,
  });
}
var CODE_DIGITS = 13;
/** The digits a field covers, or undefined while its start or length is not a usable number. */
function rangeOf(start, length) {
  if (!Number.isInteger(start) || !Number.isInteger(length) || start < 1 || length < 1) return;
  return {
    first: start,
    last: start + length - 1,
  };
}
/** "digit 8" or "digits 3–7". */
var digitsText = ({ first, last }) =>
  first === last ? `digit ${first}` : `digits ${first}–${last}`;
var sentence = (text) => text.charAt(0).toUpperCase() + text.slice(1);
var valueName = (kind) => (kind === "weight" ? "weight" : "price");
/** Which of the 13 digits belong to the product code, the value, both (a conflict), or neither. */
function roleOfDigit(digit, product, value) {
  const inside = (range) => !!range && digit >= range.first && digit <= range.last;
  if (inside(product) && inside(value)) return "conflict";
  if (inside(product)) return "product";
  if (inside(value)) return "value";
  if (digit < 3) return "prefix";
  return digit === CODE_DIGITS ? "check" : "free";
}
var DIGITS = Array.from({ length: CODE_DIGITS }, (_, index) => index + 1);
/** The one thing wrong with a pair of ranges, in plain words, and the field that fixes it. */
function layoutProblem(product, value, kind) {
  const name = valueName(kind);
  const overrun = (range, what) =>
    `${sentence(what)} ${digitsText(range)} run past digit 12. Digit ${CODE_DIGITS} is the check digit, so the data must stop at digit 12.`;
  if (product.last > 12)
    return {
      field: "productStart",
      message: overrun(product, "product code"),
    };
  if (value.last > 12)
    return {
      field: "valueStart",
      message: overrun(value, name),
    };
  const shared = {
    first: Math.max(product.first, value.first),
    last: Math.min(product.last, value.last),
  };
  if (shared.first <= shared.last)
    return {
      field: "valueStart",
      message: `Product code (${digitsText(product)}) and ${name} (${digitsText(value)}) share ${digitsText(shared)}. Move one of them so they don't overlap.`,
    };
}
//#endregion
//#region ../../packages/backoffice/src/schemas/catalogue/mappings.ts
var slice = object({
  start: number(),
  length: number(),
});
var mappingView = object({
  id: string(),
  prefix: number(),
  product: slice,
  value: slice,
  kind: picklist(["weight", "price"]),
  unit: optional(picklist(["g", "kg"])),
  decimals: number(),
});
var mappingList = array(mappingView);
var deletedMapping = null_();
var whole = (min, max, message) =>
  pipe(
    string(),
    trim(),
    regex(/^\d+$/, message),
    transform(Number),
    minValue(min, message),
    maxValue(max, message),
  );
/** Digits are what a person counts on the label: the first printed digit is 1. */
var mappingFormSchema = pipe(
  object({
    prefix: whole(20, 29, "Use a number from 20 to 29"),
    kind: picklist(["weight", "price"]),
    unit: picklist(["g", "kg"]),
    productStart: whole(3, 12, "Use a digit from 3 to 12"),
    productLength: whole(1, 10, "Use a number from 1 to 10"),
    valueStart: whole(3, 12, "Use a digit from 3 to 12"),
    valueLength: whole(1, 10, "Use a number from 1 to 10"),
    decimals: whole(0, 4, "Use a number from 0 to 4"),
  }),
  rawCheck(({ dataset, addIssue }) => {
    if (!dataset.typed || dataset.issues) return;
    const m = dataset.value;
    const problem = layoutProblem(
      rangeOf(m.productStart, m.productLength),
      rangeOf(m.valueStart, m.valueLength),
      m.kind,
    );
    if (!problem) return;
    addIssue({
      message: problem.message,
      path: [
        {
          type: "object",
          origin: "value",
          input: m,
          key: problem.field,
          value: m[problem.field],
        },
      ],
    });
  }),
);
/** A common scale label: 2 PPPPP WWWWW C, in kilograms with three decimals. */
var emptyMapping = {
  prefix: "",
  kind: "weight",
  unit: "kg",
  productStart: "3",
  productLength: "5",
  valueStart: "8",
  valueLength: "5",
  decimals: "3",
};
var mappingValues = (m) => ({
  prefix: String(m.prefix),
  kind: m.kind,
  unit: m.unit ?? "kg",
  productStart: String(m.product.start + 1),
  productLength: String(m.product.length),
  valueStart: String(m.value.start + 1),
  valueLength: String(m.value.length),
  decimals: String(m.decimals),
});
/** The API counts digits from 0, so a label's first printed digit is start 0. */
function toMappingBody(values) {
  const m = parse(mappingFormSchema, values);
  const layout = {
    prefix: m.prefix,
    product: {
      start: m.productStart - 1,
      length: m.productLength,
    },
    value: {
      start: m.valueStart - 1,
      length: m.valueLength,
    },
    decimals: m.decimals,
  };
  return parse(
    mappingInput,
    m.kind === "weight"
      ? {
          ...layout,
          kind: m.kind,
          unit: m.unit,
        }
      : {
          ...layout,
          kind: m.kind,
        },
  );
}
/** What to tell the owner when a write fails; a taken prefix belongs on the Prefix field. */
function mappingFailure(error, prefix) {
  if (error instanceof ApiError && error.status === 409)
    return {
      field: "prefix",
      message: `Prefix ${prefix} already has a layout. Edit that one instead.`,
    };
  if (error instanceof ApiError && error.status === 403)
    return { message: "You don't have permission to change barcode layouts. Ask the shop owner." };
  if (error instanceof ApiError && error.status === 404)
    return { message: "This layout was removed by someone else. Close this and check the list." };
  return { message: error.message };
}
//#endregion
//#region ../../packages/backoffice/src/queries/catalogue/mappings.ts
var PATH = "/catalogue/barcodes/mappings";
var KEY = "barcode-mappings";
function mappingsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: [KEY, shop?.id ?? "box"],
    queryFn: () => apiFetch(PATH, mappingList, { shopId: shop?.id ?? null }),
  });
}
/** Creates a layout, or updates `editing` when given. The list is refetched so it shows the change. */
function useSaveMapping(editing, onSaved) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) =>
      apiFetch(editing ? `${PATH}/${editing.id}` : PATH, mappingView, {
        method: editing ? "PATCH" : "POST",
        body: toMappingBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Layout saved" : "Layout added");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
function useDeleteMapping(onDeleted) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mapping) =>
      apiFetch(`${PATH}/${mapping.id}`, deletedMapping, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Layout deleted");
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: [KEY] });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/schemas/branches.ts
var deletedBranch = null_();
//#endregion
//#region ../../packages/backoffice/src/queries/branches.ts
/** Creates a branch, or updates `editing` when given. The list is refetched so it shows the change. */
function useSaveBranch(editing, onSaved) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) =>
      apiFetch(editing ? `/branches/${editing.id}` : "/branches", branchView, {
        method: editing ? "PATCH" : "POST",
        body: toBranchBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Branch saved" : "Branch added");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}
function useDeleteBranch(onDeleted) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (branch) => apiFetch(`/branches/${branch.id}`, deletedBranch, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Branch deleted");
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });
}
//#endregion
//#region ../../packages/backoffice/src/schemas/devices.ts
var deviceRow = object(deviceListItem.entries);
var enrolment = object({
  code: string(),
  expiresAt: string(),
});
var deviceList = array(deviceRow);
var revocationResponse = looseObject({});
var pinResponse = looseObject({});
//#endregion
//#region ../../packages/backoffice/src/queries/devices.ts
function devicesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["devices", shop?.id ?? "box"],
    queryFn: () => apiFetch("/devices", deviceList, { shopId: shop?.id ?? null }),
  });
}
/** What the devices screen needs before it can draw. Branches and members load after: they are optional context. */
var devicesScreenQueries = () => [devicesQuery(), permissionsQuery()];
/** Makes a six-digit code a till redeems once, within minutes. */
function useIssueEnrolment() {
  return useMutation({
    gcTime: 0,
    mutationFn: (branchId) =>
      apiFetch("/devices/enrollment", enrolment, {
        method: "POST",
        body: parse(enrollmentIssueInput, { branchId }),
      }),
  });
}
function useRevokeDevice(onRevoked) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (device) =>
      apiFetch("/devices/revoke", revocationResponse, {
        method: "POST",
        body: parse(revokeDeviceInput, { deviceId: device.id }),
      }),
    onSuccess: async () => {
      toast.success("Device revoked");
      onRevoked();
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
    },
  });
}
/** Sets or replaces a member's till PIN. */
function useSavePin(onSaved) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (input) => {
      try {
        return await apiFetch("/cashiers/pin", pinResponse, {
          method: "POST",
          body: parse(pinInput, {
            userId: input.userId,
            pin: input.pin,
          }),
        });
      } finally {
        input.pin = "";
      }
    },
    onSuccess: (_result, input) => {
      toast.success(`PIN saved for ${input.name}`);
      onSaved();
    },
  });
}
//#endregion
//#region ../../packages/backoffice/src/queries/roles.ts
function rolesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["roles", shop?.id ?? "box"],
    queryFn: () => apiFetch("/roles", roleListResponse, { shopId: shop?.id ?? null }),
  });
}
/** Every permission this shop knows, including which ones apply on a till. */
function permissionsListQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["permissions", shop?.id ?? "box"],
    queryFn: () => apiFetch("/permissions", permissionListResponse, { shopId: shop?.id ?? null }),
  });
}
/** What the owner role is called on screen: the stored name is internal. */
var roleLabel = (role) => (role.protectedOwner ? "Owner" : role.name);
/** Creates a role, or saves `editing`. A role change can change what this member may do, so permissions are refetched too. */
function useSaveRole(editing, onSaved) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) =>
      apiFetch(editing ? `/roles/${editing.id}` : "/roles", roleListItem, {
        method: editing ? "PATCH" : "POST",
        body: values,
      }),
    onSuccess: async () => {
      toast.success(editing ? "Role saved" : "Role created");
      onSaved();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
    },
  });
}
/** What the roles screen needs before it can draw: its own list, what a till allows and what this member holds. */
var rolesScreenQueries = () => [rolesQuery(), permissionsListQuery(), permissionsQuery()];
//#endregion
//#region ../../packages/backoffice/src/schemas/stores.ts
var storeList = array(storeView);
var deletedStore = null_();
//#endregion
//#region ../../packages/backoffice/src/queries/stores.ts
function storesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["stores", shop?.id ?? "box"],
    queryFn: () => apiFetch("/stores", storeList, { shopId: shop?.id ?? null }),
  });
}
/** Creates a store, or updates `editing` when given. The list is refetched so it shows the change. */
function useSaveStore(editing, onSaved) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) =>
      apiFetch(editing ? `/stores/${editing.id}` : "/stores", storeView, {
        method: editing ? "PATCH" : "POST",
        body: toStoreBody(values),
      }),
    onSuccess: async () => {
      toast.success(editing ? "Store saved" : "Store added");
      onSaved();
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}
function useDeleteStore(onDeleted) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (store) => apiFetch(`/stores/${store.id}`, deletedStore, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Store deleted");
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });
}
/** What to tell the owner when a delete is refused because other records still point at it. */
function deleteMessage(error, name) {
  return error instanceof ApiError && error.status === 409
    ? `${name} is still used by other records, so it can't be deleted.`
    : error.message;
}
//#endregion
//#region ../../packages/backoffice/src/schemas/users.ts
var invitationRow = object({
  ...omit(invitationListItem, ["setupLink"]).entries,
  deliveryStatus: optional(string()),
});
var issued = object({
  ...invitationListItem.entries,
  setupLink: optional(string()),
});
var invitationList = array(invitationRow);
var cancellationResponse = looseObject({});
var roleResponse = looseObject({});
//#endregion
//#region ../../packages/backoffice/src/queries/users.ts
function usersQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["users", shop?.id ?? "box"],
    queryFn: () => apiFetch("/users", userListResponse, { shopId: shop?.id ?? null }),
  });
}
function invitationsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["invitations", shop?.id ?? "box"],
    queryFn: () => apiFetch("/invitations", invitationList, { shopId: shop?.id ?? null }),
  });
}
/** What the users screen needs before it can draw. Roles load after, because naming them is optional. */
var usersScreenQueries = () => [usersQuery(), invitationsQuery(), permissionsQuery()];
/**
 * A setup link is a secret that opens an account. It goes straight to `reveal` (the dialog's own
 * state) and out of the mutation, so it never sits in the mutation or query cache.
 */
function strip(result, reveal) {
  if (result.setupLink)
    reveal({
      email: result.email,
      link: result.setupLink,
    });
  return {
    email: result.email,
    revealed: !!result.setupLink,
  };
}
async function refreshInvitations(queryClient) {
  await queryClient.invalidateQueries({ queryKey: ["invitations"] });
}
function useInvite(reveal, onDone) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (values) =>
      strip(
        await apiFetch("/invitations", issued, {
          method: "POST",
          body: parse(invitationIssueSchema, {
            ...values,
            email: values.email.trim(),
          }),
        }),
        reveal,
      ),
    onSuccess: async (result) => {
      if (!result.revealed) toast.success(`Invitation created for ${result.email}`);
      onDone();
      await refreshInvitations(queryClient);
    },
  });
}
/** Replaces an invitation's link. The old link stops working, and an email invitation is sent again. */
function useReissue(reveal) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (invitation) =>
      strip(
        await apiFetch(`/invitations/${invitation.id}/reissue`, issued, {
          method: "POST",
          body: {},
        }),
        reveal,
      ),
    onSuccess: async (result) => {
      if (!result.revealed) toast.success(`Invitation renewed for ${result.email}`);
      await refreshInvitations(queryClient);
    },
    onError: (error) => toast.error(error.message),
  });
}
function useCancelInvitation(onCancelled) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitation) =>
      apiFetch(`/invitations/${invitation.id}/cancel`, cancellationResponse, {
        method: "POST",
        body: {},
      }),
    onSuccess: async () => {
      toast.success("Invitation cancelled");
      onCancelled();
      await refreshInvitations(queryClient);
    },
  });
}
/** Moves a member to another role. Their permissions follow at once, so session permissions are refetched too. */
function useAssignRole(member, onSaved) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId) =>
      apiFetch(`/users/${member.id}/role`, roleResponse, {
        method: "PATCH",
        body: { roleId },
      }),
    onSuccess: async () => {
      toast.success("Role updated");
      onSaved();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
    },
  });
}
//#endregion
//#region ../../packages/backoffice/src/routes/administration.tsx
var loadAll = ({ queryClient }, queries) =>
  Promise.all(queries.map((query) => queryClient.ensureQueryData(query)));
/** Stores, branches, people and devices: the screens an owner sets the shop up with. */
function administrationRoutes(shopRoute) {
  return [
    createRoute({
      getParentRoute: () => shopRoute,
      path: "/stores",
      loader: ({ context }) =>
        Promise.all([
          context.queryClient.ensureQueryData(storesQuery()),
          context.queryClient.ensureQueryData(permissionsQuery()),
        ]),
      component: lazyRouteComponent(() => import("./screen-CqpDUw-x.js"), "StoresScreen"),
      ...routeStates,
      pendingComponent: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListSkeleton, { label: "Loading stores" }),
    }),
    createRoute({
      getParentRoute: () => shopRoute,
      path: "/branches",
      loader: async ({ context }) => {
        const held = await context.queryClient.ensureQueryData(permissionsQuery());
        await Promise.all([
          context.queryClient.ensureQueryData(branchesQuery()),
          ...(held.includes("store.read")
            ? [context.queryClient.ensureQueryData(storesQuery())]
            : []),
        ]);
      },
      component: lazyRouteComponent(() => import("./screen-5RvDymEG.js"), "BranchesScreen"),
      ...routeStates,
      pendingComponent: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListSkeleton, { label: "Loading branches" }),
    }),
    createRoute({
      getParentRoute: () => shopRoute,
      path: "/users",
      loader: ({ context }) => loadAll(context, usersScreenQueries()),
      component: lazyRouteComponent(() => import("./screen-BwqZuOkc.js"), "UsersScreen"),
      ...routeStates,
      pendingComponent: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListSkeleton, { label: "Loading users" }),
    }),
    createRoute({
      getParentRoute: () => shopRoute,
      path: "/roles",
      loader: ({ context }) => loadAll(context, rolesScreenQueries()),
      component: lazyRouteComponent(() => import("./screen-BpLRq0Bt.js"), "RolesScreen"),
      ...routeStates,
      pendingComponent: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListSkeleton, { label: "Loading roles" }),
    }),
    createRoute({
      getParentRoute: () => shopRoute,
      path: "/devices",
      loader: ({ context }) => loadAll(context, devicesScreenQueries()),
      component: lazyRouteComponent(() => import("./screen-whF8IWri.js"), "DevicesScreen"),
      ...routeStates,
      pendingComponent: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListSkeleton, { label: "Loading devices" }),
    }),
  ];
}
//#endregion
//#region ../../packages/backoffice/src/schemas/auth/public.ts
var link = object({
  id: optional(string()),
  token: optional(string()),
});
var invitationSearch = object({
  ...link.entries,
  shop: optional(string()),
});
//#endregion
//#region ../../packages/backoffice/src/components/auth/frame.tsx
/** The teal backdrop and white card every signed-out screen sits in, as in the Figma login frame. */
function AuthFrame({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppBackdrop, {
    className: "grid place-items-center bg-transparent p-0 shadow-none",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
      className: "w-full max-w-3xl",
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
        className: "min-h-153 justify-center rounded-3xl border-0",
        children,
      }),
    }),
  });
}
/** Brand, one visible h1 and a short lead, then the screen's own content. */
function AuthPanel({ title, description, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
    className: "flex flex-col gap-9 px-6 sm:px-22",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-5",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            "aria-hidden": true,
            className: "text-4xl font-semibold tracking-tight text-primary",
            children: "Shopper",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
            className: "text-2xl font-semibold tracking-tight",
            children: title,
          }),
          description &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
              className: "text-lg font-medium text-muted-foreground",
              children: description,
            }),
        ],
      }),
      children,
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/auth/link/problem.tsx
/** `subject` names the link in the heading and the fix for a broken one ("verification", "invitation"). */
function linkProblemScreen(subject) {
  const broken = {
    verification: {
      title: "This verification link doesn't work",
      description:
        "It may have expired, or it isn't the link we emailed you. Start again to get a new one.",
      action: {
        label: "Start again",
        to: "/signup",
      },
    },
    invitation: {
      title: "This invitation link doesn't work",
      description:
        "It may have expired, been used, cancelled or replaced. Ask the shop owner to send a new invitation.",
      action: {
        label: "Log in",
        to: "/login",
      },
    },
  };
  const others = {
    unreachable: {
      title: "Can't reach the server",
      description: "Check your connection and try again. Nothing you entered here has been lost.",
    },
    closed: {
      title: "Shops can't be created here",
      description:
        "This till server belongs to one shop. Log in, or ask the shop owner for access.",
    },
    busy: {
      title: "Too many attempts",
      description: "Wait about ten seconds, then try again.",
    },
    unavailable: {
      title: "Something went wrong",
      description: "We couldn't load this page. Try again in a moment.",
    },
  };
  return function LinkProblemScreen({ error, reset }) {
    const router = useRouter();
    const kind = linkProblem(error);
    const copy = kind === "broken" ? broken[subject] : others[kind];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
        className: "flex flex-col items-start gap-9 px-6 sm:px-22",
        children: [
          kind === "unreachable"
            ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, {
                "aria-hidden": true,
                className: "size-10 text-muted-foreground",
              })
            : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                "aria-hidden": true,
                className: "size-10 text-muted-foreground",
              }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-col gap-5",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
                className: "text-4xl font-semibold tracking-tight",
                children: copy.title,
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "text-lg font-medium text-muted-foreground",
                children: copy.description,
              }),
            ],
          }),
          kind === "broken"
            ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                asChild: true,
                size: "lg",
                className: "rounded-full",
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link$1, {
                  to: broken[subject].action.to,
                  children: broken[subject].action.label,
                }),
              })
            : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                size: "lg",
                className: "rounded-full",
                onClick: () => {
                  reset();
                  router.invalidate();
                },
                children: "Try again",
              }),
        ],
      }),
    });
  };
}
//#endregion
//#region ../../packages/backoffice/src/components/auth/skeleton.tsx
function AuthSkeleton() {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
      className: "flex flex-col gap-9 px-6 sm:px-22",
      role: "status",
      "aria-busy": "true",
      "aria-label": "Loading",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-40" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-14 w-full" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-10 w-full" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, {
          className: "h-10 w-full rounded-full",
        }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/queries/auth/accept/invitation.ts
/** Previewing never consumes the invitation: only Join does. */
function invitationQuery({ id, token }) {
  return queryOptions({
    queryKey: ["invitation", id],
    queryFn: () =>
      publicFetch(
        `/invitations/${encodeURIComponent(id)}/preview?token=${encodeURIComponent(token)}`,
        invitationPreviewResponse,
      ),
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
var JoinedError = class extends Error {
  joined = true;
};
/**
 * A new person is created by accepting, then signed in. An existing account signs in with its own
 * password first, because the server only attaches the role to the account that is signed in.
 */
function useJoin(link, preview, onJoined) {
  const signIn = useSignIn(null, () => {});
  const accept = (body) =>
    publicFetch(`/invitations/${link.id}/accept`, invitationAcceptResponse, {
      method: "POST",
      body: {
        token: link.token,
        ...body,
      },
    });
  return useMutation({
    gcTime: 0,
    onSettled: (_data, _error, values) => {
      values.password = "";
    },
    mutationFn: async ({ name, password }) => {
      const credentials = {
        shopCode: preview.shopCode,
        email: preview.email,
        password,
      };
      if (preview.existingAccount) {
        await signIn.mutateAsync(credentials);
        await accept({});
        return;
      }
      await accept({
        name,
        password,
      });
      await signIn.mutateAsync(credentials).catch((error) => {
        throw new JoinedError(error.message, { cause: error });
      });
    },
    onSuccess: onJoined,
  });
}
/** True when the account exists but signing in failed, so the person only needs to log in. */
var joinedButNotSignedIn = (error) => error instanceof JoinedError;
//#endregion
//#region ../../packages/backoffice/src/queries/auth/verify/registration.ts
/** Previewing never consumes the link: only the Verify email button does. */
function registrationQuery({ id, token }) {
  return queryOptions({
    queryKey: ["registration", id],
    queryFn: () =>
      publicFetch(
        `/onboarding/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
        registrationViewResponse,
      ),
    retry: false,
  });
}
function useVerify(link) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: () =>
      publicFetch("/onboarding/verify", registrationViewResponse, {
        method: "POST",
        body: link,
      }),
    onSuccess: (view) => queryClient.setQueryData(registrationQuery(link).queryKey, view),
  });
}
function useComplete(link, onCompleted) {
  return useMutation({
    gcTime: 0,
    onSettled: (_data, _error, values) => {
      values.password = "";
    },
    mutationFn: (values) =>
      publicFetch("/onboarding/complete", registrationCompleteResponse, {
        method: "POST",
        body: {
          ...link,
          ...values,
        },
      }),
    onSuccess: (result, values) =>
      onCompleted({
        shopCode: result.shopCode,
        email: result.email,
        password: values.password,
      }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/routes/auth/public.tsx
var PENDING_MS = 300;
async function closeOnFixedBox({ context }) {
  if (await context.queryClient.ensureQueryData(currentOrgQuery)) throw redirect({ to: "/login" });
}
/** Signed-out onboarding: create a shop, verify its email link, and accept a staff invitation. */
function publicAuthRoutes(rootRoute) {
  return [
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/signup",
      beforeLoad: closeOnFixedBox,
      component: lazyRouteComponent(() => import("./screen-CXX1OuFY.js"), "SignupScreen"),
      ...routeStates,
      pendingComponent: AuthSkeleton,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/verify-registration",
      validateSearch: link,
      beforeLoad: closeOnFixedBox,
      loaderDeps: ({ search }) => ({ id: search.id }),
      shouldReload: true,
      gcTime: 0,
      loader: ({ context, location }) => {
        const { id, token } = parse(link, location.search);
        if (!id || !token) brokenLink();
        const preview = registrationQuery({
          id,
          token,
        });
        context.queryClient.removeQueries({
          queryKey: preview.queryKey,
          exact: true,
        });
        return context.queryClient.ensureQueryData(preview);
      },
      component: lazyRouteComponent(
        () => import("./screen-CsMQvO3x.js"),
        "VerifyRegistrationScreen",
      ),
      errorComponent: linkProblemScreen("verification"),
      pendingComponent: AuthSkeleton,
      pendingMs: PENDING_MS,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: "/accept-invitation",
      validateSearch: invitationSearch,
      loaderDeps: ({ search }) => ({ id: search.id }),
      shouldReload: true,
      gcTime: 0,
      loader: ({ context, location }) => {
        const { id, token } = parse(link, location.search);
        if (!id || !token) brokenLink();
        const preview = invitationQuery({
          id,
          token,
        });
        context.queryClient.removeQueries({
          queryKey: preview.queryKey,
          exact: true,
        });
        return context.queryClient.ensureQueryData(preview);
      },
      component: lazyRouteComponent(() => import("./screen-Cw7aH1Vq.js"), "AcceptInvitationScreen"),
      errorComponent: linkProblemScreen("invitation"),
      pendingComponent: AuthSkeleton,
      pendingMs: PENDING_MS,
    }),
  ];
}
//#endregion
//#region ../../packages/backoffice/src/routes/create.tsx
/** Mounts login and the signed-in shell under the host's root route. */
function createBackofficeRoutes(rootRoute) {
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    beforeLoad: () => {
      throw redirect({ to: "/products" });
    },
  });
  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/login",
    validateSearch: shopSearch,
    loader: ({ context }) => context.queryClient.ensureQueryData(currentOrgQuery),
    component: lazyRouteComponent(() => import("./screen-KFhV198W.js"), "LoginScreen"),
    ...routeStates,
    pendingComponent: LoginSkeleton,
  });
  const shopRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: "_shop",
    beforeLoad: ({ context }) => requireSession(context.queryClient),
    component: lazyRouteComponent(() => import("./screen-BfEuK5es.js"), "ShellScreen"),
    ...routeStates,
    pendingComponent: ShellSkeleton,
  });
  const productsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/products",
    validateSearch: catalogueSearch,
    loaderDeps: ({ search }) => search,
    loader: async ({ context, deps }) => {
      context.queryClient.prefetchInfiniteQuery(productsQuery(deps));
      await context.queryClient.ensureQueryData(categoriesQuery());
    },
    component: lazyRouteComponent(() => import("./screen-OAxaTXWk.js"), "ProductsScreen"),
    ...routeStates,
    pendingComponent: ProductsSkeleton,
  });
  const productRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/products/$productId",
    loader: async ({ context, params }) => {
      context.queryClient.prefetchQuery(branchesQuery());
      await Promise.all([
        context.queryClient.ensureQueryData(productQuery(params.productId)),
        context.queryClient.ensureQueryData(categoriesQuery()),
      ]);
    },
    component: lazyRouteComponent(() => import("./screen-pNIJvjqF.js"), "ProductScreen"),
    ...routeStates,
    pendingComponent: ProductSkeleton,
  });
  const mappingsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/barcodes",
    loader: ({ context }) =>
      Promise.all([
        context.queryClient.ensureQueryData(mappingsQuery()),
        context.queryClient.ensureQueryData(permissionsQuery()),
      ]),
    component: lazyRouteComponent(() => import("./screen-BlaB6o_a.js"), "MappingsScreen"),
    ...routeStates,
    pendingComponent: () =>
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListSkeleton, {
        label: "Loading barcode layouts",
      }),
  });
  const importsRoute = createRoute({
    getParentRoute: () => shopRoute,
    path: "/imports",
    component: lazyRouteComponent(() => import("./screen-DB5EYam1.js"), "ImportsScreen"),
    ...routeStates,
  });
  return rootRoute.addChildren([
    indexRoute,
    loginRoute,
    ...publicAuthRoutes(rootRoute),
    shopRoute.addChildren([
      productsRoute,
      productRoute,
      mappingsRoute,
      importsRoute,
      ...administrationRoutes(shopRoute),
    ]),
  ]);
}
//#endregion
//#region src/routes/__root.tsx
var Route = createRootRouteWithContext()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Shopper" },
    ],
  }),
  component: Portal,
  shellComponent: Document,
});
function Portal() {
  const { queryClient } = useRouter().options.context;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientProvider, {
    client: queryClient,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}),
  });
}
function Document({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
    lang: "en",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", {
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
        children: [children, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})],
      }),
    ],
  });
}
var routeTree = Route._addFileChildren({})._addFileTypes();
//#endregion
//#region src/router.tsx
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { networkMode: "always" },
      mutations: { networkMode: "always" },
    },
  });
  return createRouter({
    routeTree: createBackofficeRoutes(routeTree),
    context: { queryClient },
    defaultSsr: false,
    scrollRestoration: true,
  });
}
//#endregion
export {
  Navigate as $,
  mappingsQuery as A,
  roleOfDigit as B,
  useSaveRole as C,
  useSavePin as D,
  useRevokeDevice as E,
  mappingFormSchema as F,
  categoriesQuery as G,
  valueName as H,
  mappingValues as I,
  useCreateProduct as J,
  productsQuery as K,
  DIGITS as L,
  useSaveMapping as M,
  emptyMapping as N,
  useDeleteBranch as O,
  mappingFailure as P,
  WifiOff as Q,
  digitsText as R,
  rolesQuery as S,
  useIssueEnrolment as T,
  EmptyList as U,
  sentence as V,
  ReadOnlyNote as W,
  NoMatch as X,
  EmptyCatalogue as Y,
  TableSkeleton as Z,
  storesQuery as _,
  invitationQuery as a,
  toObserver as at,
  permissionsListQuery as b,
  AuthFrame as c,
  useAssignRole as d,
  useNavigate as et,
  useCancelInvitation as f,
  deleteMessage as g,
  getRouter,
  usersQuery as h,
  useVerify as i,
  createAtom as it,
  useDeleteMapping as j,
  useSaveBranch as k,
  AuthPanel as l,
  useReissue as m,
  registrationQuery as n,
  useParams as nt,
  joinedButNotSignedIn as o,
  useInvite as p,
  useCreateCategory as q,
  useComplete as r,
  batch as rt,
  useJoin as s,
  router_exports as t,
  useSearch as tt,
  invitationsQuery as u,
  useDeleteStore as v,
  devicesQuery as w,
  roleLabel as x,
  useSaveStore as y,
  rangeOf as z,
};
