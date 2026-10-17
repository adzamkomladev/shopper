import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  F as nullable,
  L as object,
  Q as string,
  Y as safeParse,
  b as flatten,
  i as require_react,
  m as array,
  r as require_jsx_runtime,
  z as optional,
} from "./react-dom-BCYT53bd.js";
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
/**
 * The context that `useQueryClient` reads from. `QueryClientProvider` is the normal way to set it.
 */
var QueryClientContext = import_react.createContext(void 0);
/**
 * The `useQueryClient` hook returns the current `QueryClient` instance.
 *
 * @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
 * be used.
 * @returns The current `QueryClient` instance.
 * @throws If no `queryClient` argument is passed and no `QueryClientProvider` is found in the component tree.
 */
var useQueryClient = (queryClient) => {
  const client = import_react.useContext(QueryClientContext);
  if (queryClient) return queryClient;
  if (!client) throw new Error("No QueryClient set, use QueryClientProvider to set one");
  return client;
};
/**
 * Use the `QueryClientProvider` component to connect and provide a `QueryClient` to your application. Also
 * calls `client.mount()`/`client.unmount()` as this component mounts/unmounts, which subscribes the client to
 * focus/online events (resuming any paused mutations and refetching as needed when the app regains focus or
 * comes back online).
 *
 * @returns The provided `children`, wrapped so they can read the `QueryClient` via `useQueryClient`.
 *
 * @example
 * ```tsx
 * import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
 *
 * const queryClient = new QueryClient()
 *
 * function App() {
 *   return <QueryClientProvider client={queryClient}>...</QueryClientProvider>
 * }
 * ```
 */
var QueryClientProvider = ({ client, children }) => {
  import_react.useEffect(() => {
    client.mount();
    return () => {
      client.unmount();
    };
  }, [client]);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(QueryClientContext.Provider, {
    value: client,
    children,
  });
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/timeoutManager.js
var defaultTimeoutProvider = {
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (timeoutId) => clearTimeout(timeoutId),
  setInterval: (callback, delay) => setInterval(callback, delay),
  clearInterval: (intervalId) => clearInterval(intervalId),
};
/**
 * Allows customization of how timeouts are created.
 *
 * @tanstack/query-core makes liberal use of timeouts to implement `staleTime`
 * and `gcTime`. The default TimeoutManager provider uses the platform's global
 * `setTimeout` implementation, which is known to have scalability issues with
 * thousands of timeouts on the event loop.
 *
 * If you hit this limitation, consider providing a custom TimeoutProvider that
 * coalesces timeouts.
 */
var TimeoutManager = class {
  #provider = defaultTimeoutProvider;
  #providerCalled = false;
  /**
   * `setTimeoutProvider` can be used to set a custom implementation of the
   * `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` functions,
   * called a `TimeoutProvider`.
   *
   * This may be useful if you notice event loop performance issues with
   * thousands of queries. A custom TimeoutProvider could also support timer
   * delays longer than the global `setTimeout` maximum delay value of about
   * 24 days.
   *
   * It is important to call `setTimeoutProvider` before creating a
   * QueryClient or queries, so that the same provider is used consistently
   * for all timers in the application, since different TimeoutProviders
   * cannot cancel each others' timers.
   *
   * @example
   * ```ts
   * import { timeoutManager, QueryClient } from '@tanstack/query-core'
   * import { CustomTimeoutProvider } from './CustomTimeoutProvider'
   *
   * timeoutManager.setTimeoutProvider(new CustomTimeoutProvider())
   *
   * export const queryClient = new QueryClient()
   * ```
   */
  setTimeoutProvider(provider) {
    this.#provider = provider;
  }
  /**
   * `setTimeout` schedules a callback to run after approximately `delay`
   * milliseconds, like the global `setTimeout` function. The callback can be
   * canceled with `clearTimeout`.
   *
   * It returns a timer ID, which may be a number or an object that can be
   * coerced to a number via `Symbol.toPrimitive`.
   *
   * @example
   * ```ts
   * import { timeoutManager } from '@tanstack/query-core'
   *
   * const timeoutId = timeoutManager.setTimeout(
   *   () => console.log('ran at:', new Date()),
   *   1000,
   * )
   *
   * const timeoutIdNumber: number = Number(timeoutId)
   * ```
   */
  setTimeout(callback, delay) {
    return this.#provider.setTimeout(callback, delay);
  }
  /**
   * `clearTimeout` cancels a timeout callback scheduled with `setTimeout`,
   * like the global `clearTimeout` function. It should be called with a
   * timer ID returned by `setTimeout`.
   *
   * @example
   * ```ts
   * import { timeoutManager } from '@tanstack/query-core'
   *
   * const timeoutId = timeoutManager.setTimeout(
   *   () => console.log('ran at:', new Date()),
   *   1000,
   * )
   *
   * timeoutManager.clearTimeout(timeoutId)
   * ```
   */
  clearTimeout(timeoutId) {
    this.#provider.clearTimeout(timeoutId);
  }
  /**
   * `setInterval` schedules a callback to be called approximately every
   * `delay` milliseconds, like the global `setInterval` function.
   *
   * Like `setTimeout`, it returns a timer ID, which may be a number or an
   * object that can be coerced to a number via `Symbol.toPrimitive`.
   *
   * @example
   * ```ts
   * import { timeoutManager } from '@tanstack/query-core'
   *
   * const intervalId = timeoutManager.setInterval(
   *   () => console.log('ran at:', new Date()),
   *   1000,
   * )
   * ```
   */
  setInterval(callback, delay) {
    return this.#provider.setInterval(callback, delay);
  }
  /**
   * `clearInterval` can be used to cancel an interval, like the global
   * `clearInterval` function. It should be called with an interval ID
   * returned by `setInterval`.
   *
   * @example
   * ```ts
   * import { timeoutManager } from '@tanstack/query-core'
   *
   * const intervalId = timeoutManager.setInterval(
   *   () => console.log('ran at:', new Date()),
   *   1000,
   * )
   *
   * timeoutManager.clearInterval(intervalId)
   * ```
   */
  clearInterval(intervalId) {
    this.#provider.clearInterval(intervalId);
  }
};
/**
 * Singleton instance of {@link TimeoutManager}, used throughout TanStack Query to schedule and cancel timers.
 */
var timeoutManager = new TimeoutManager();
/**
 * In many cases code wants to delay to the next event loop tick; this is not
 * mediated by {@link timeoutManager}.
 *
 * This function is provided to make auditing the `tanstack/query-core` for
 * incorrect use of system `setTimeout` easier.
 */
function systemSetTimeoutZero(callback) {
  setTimeout(callback, 0);
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/utils.js
/** @deprecated
 * use `environmentManager.isServer()` instead.
 */
var isServer$1 = typeof window === "undefined" || "Deno" in globalThis;
function noop() {}
function functionalUpdate(updater, input) {
  return typeof updater === "function" ? updater(input) : updater;
}
function isValidTimeout(value) {
  return typeof value === "number" && value >= 0 && value !== Infinity;
}
function timeUntilStale(updatedAt, staleTime) {
  return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
}
function resolveQueryValue(value, query) {
  return typeof value === "function" ? value(query) : value;
}
/**
 * Checks whether a query matches the given {@link QueryFilters}.
 * Every filter that is specified must match; filters that are left unspecified are ignored.
 *
 * @example
 * ```ts
 * const queryCache = queryClient.getQueryCache()
 *
 * const matchingQueries = queryCache
 *   .getAll()
 *   .filter((query) => matchQuery({ queryKey: ['posts'] }, query))
 * ```
 */
function matchQuery(filters, query) {
  const { type = "all", exact, fetchStatus, predicate, queryKey, stale } = filters;
  if (queryKey) {
    if (exact) {
      if (query.queryHash !== hashQueryKeyByOptions(queryKey, query.options)) return false;
    } else if (!partialMatchKey(query.queryKey, queryKey)) return false;
  }
  if (type !== "all") {
    const isActive = query.isActive();
    if (type === "active" && !isActive) return false;
    if (type === "inactive" && isActive) return false;
  }
  if (typeof stale === "boolean" && query.isStale() !== stale) return false;
  if (fetchStatus && fetchStatus !== query.state.fetchStatus) return false;
  if (predicate && !predicate(query)) return false;
  return true;
}
/**
 * Checks whether a mutation matches the given {@link MutationFilters}.
 * Every filter that is specified must match; filters that are left unspecified are ignored.
 * If a `mutationKey` filter is provided but the mutation has no `mutationKey` of its own, it does not match.
 *
 * @example
 * ```ts
 * const mutationCache = queryClient.getMutationCache()
 *
 * const matchingMutations = mutationCache
 *   .getAll()
 *   .filter((mutation) => matchMutation({ mutationKey: ['addPost'] }, mutation))
 * ```
 */
function matchMutation(filters, mutation) {
  const { exact, status, predicate, mutationKey } = filters;
  if (mutationKey) {
    if (!mutation.options.mutationKey) return false;
    if (exact) {
      if (hashKey(mutation.options.mutationKey) !== hashKey(mutationKey)) return false;
    } else if (!partialMatchKey(mutation.options.mutationKey, mutationKey)) return false;
  }
  if (status && mutation.state.status !== status) return false;
  if (predicate && !predicate(mutation)) return false;
  return true;
}
function hashQueryKeyByOptions(queryKey, options) {
  return (options?.queryKeyHashFn || hashKey)(queryKey);
}
/**
 * Default query & mutation keys hash function.
 * Hashes the value into a stable hash.
 *
 * @example
 * ```ts
 * // Object keys are sorted, so key order doesn't affect the hash:
 * hashKey(['todos', { page: 1, filter: 'done' }]) // === '["todos",{"filter":"done","page":1}]'
 * ```
 */
function hashKey(queryKey) {
  return JSON.stringify(queryKey, (_, val) =>
    isPlainObject(val)
      ? Object.keys(val)
          .sort()
          .reduce((result, key) => {
            result[key] = val[key];
            return result;
          }, {})
      : val,
  );
}
function partialMatchKey(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (b.length > a.length) return false;
      for (let i = 0; i < b.length; i++) if (!partialMatchKey(a[i], b[i])) return false;
      return true;
    }
    const bKeys = Object.keys(b);
    for (const key of bKeys) if (!partialMatchKey(a[key], b[key])) return false;
    return true;
  }
  return false;
}
var hasOwn = Object.prototype.hasOwnProperty;
function replaceEqualDeep(a, b, depth = 0) {
  if (a === b) return a;
  if (depth > 500) return b;
  const array = isPlainArray(a) && isPlainArray(b);
  if (!array && !(isPlainObject(a) && isPlainObject(b))) return b;
  const aSize = (array ? a : Object.keys(a)).length;
  const bItems = array ? b : Object.keys(b);
  const bSize = bItems.length;
  const copy = array ? new Array(bSize) : {};
  let equalItems = 0;
  for (let i = 0; i < bSize; i++) {
    const key = array ? i : bItems[i];
    const aItem = a[key];
    const bItem = b[key];
    if (aItem === bItem) {
      copy[key] = aItem;
      if (array ? i < aSize : hasOwn.call(a, key)) equalItems++;
      continue;
    }
    if (
      aItem === null ||
      bItem === null ||
      typeof aItem !== "object" ||
      typeof bItem !== "object"
    ) {
      copy[key] = bItem;
      continue;
    }
    const v = replaceEqualDeep(aItem, bItem, depth + 1);
    copy[key] = v;
    if (v === aItem) equalItems++;
  }
  return aSize === bSize && equalItems === aSize ? a : copy;
}
/**
 * Shallow compare objects.
 */
function shallowEqualObjects(a, b) {
  if (!b || Object.keys(a).length !== Object.keys(b).length) return false;
  for (const key in a) if (a[key] !== b[key]) return false;
  return true;
}
function isPlainArray(value) {
  return Array.isArray(value) && value.length === Object.keys(value).length;
}
function isPlainObject(o) {
  if (!hasObjectPrototype(o)) return false;
  const objectPrototype = Object.getPrototypeOf(o);
  const ctor = objectPrototype?.constructor;
  if (ctor === void 0) return true;
  if (typeof ctor !== "function") return false;
  const prot = ctor.prototype;
  if (!hasObjectPrototype(prot)) return false;
  if (!prot.hasOwnProperty("isPrototypeOf")) return false;
  if (objectPrototype !== Object.prototype) return false;
  return true;
}
function hasObjectPrototype(o) {
  return Object.prototype.toString.call(o) === "[object Object]";
}
function sleep(timeout) {
  return new Promise((resolve) => {
    timeoutManager.setTimeout(resolve, timeout);
  });
}
function replaceData(prevData, data, options) {
  if (typeof options.structuralSharing === "function")
    return options.structuralSharing(prevData, data);
  else if (options.structuralSharing !== false) return replaceEqualDeep(prevData, data);
  return data;
}
/**
 * Intended to be passed as a query's `placeholderData` option, for example
 * `placeholderData: keepPreviousData`. Instead of resetting the query's data to `undefined` while a new
 * query key is fetching, it keeps displaying the previously fetched data until the new data arrives.
 *
 * @example
 * ```ts
 * new QueryObserver(queryClient, {
 *   queryKey: ['posts', page],
 *   queryFn: () => fetchPosts(page),
 *   placeholderData: keepPreviousData,
 * })
 * ```
 */
function keepPreviousData(previousData) {
  return previousData;
}
function addToEnd(items, item, max = 0) {
  const newItems = [...items, item];
  return max && newItems.length > max ? newItems.slice(1) : newItems;
}
function addToStart(items, item, max = 0) {
  const newItems = [item, ...items];
  return max && newItems.length > max ? newItems.slice(0, -1) : newItems;
}
/**
 * Sentinel value that can be passed as a query's `queryFn` to conditionally disable the query (equivalent
 * to `enabled: false`) while preserving full type inference for the query's data. Unlike `enabled: false`,
 * a query disabled via `skipToken` cannot be triggered with `refetch`.
 *
 * @example
 * ```ts
 * new QueryObserver(queryClient, {
 *   queryKey: ['post', postId],
 *   queryFn: postId != null ? () => fetchPost(postId) : skipToken,
 * })
 * ```
 */
var skipToken = Symbol();
function ensureQueryFn(options, fetchOptions) {
  if (!options.queryFn && fetchOptions?.initialPromise) return () => fetchOptions.initialPromise;
  if (!options.queryFn || options.queryFn === skipToken)
    return () =>
      Promise.reject(/* @__PURE__ */ new Error(`Missing queryFn: '${options.queryHash}'`));
  return options.queryFn;
}
/**
 * Resolves a `throwOnError` option to a boolean.
 * If `throwOnError` is a function, it is called with `params` (e.g. the error and, depending on the caller,
 * additional context such as the query or mutation) and its result is returned, allowing the throwing
 * behavior to be decided per error. Otherwise, `throwOnError` itself is coerced to a boolean (`undefined`
 * resolves to `false`).
 *
 * @example
 * ```ts
 * const throwOnError =
 *   query.state.error && typeof options.throwOnError === 'function'
 *     ? shouldThrowError(options.throwOnError, [query.state.error, query])
 *     : options.throwOnError
 * ```
 */
function shouldThrowError(throwOnError, params) {
  if (typeof throwOnError === "function") return throwOnError(...params);
  return !!throwOnError;
}
function addConsumeAwareSignal(object, getSignal, onCancelled) {
  let consumed = false;
  let signal;
  Object.defineProperty(object, "signal", {
    enumerable: true,
    get: () => {
      signal ??= getSignal();
      if (consumed) return signal;
      consumed = true;
      if (signal.aborted) onCancelled();
      else signal.addEventListener("abort", onCancelled, { once: true });
      return signal;
    },
  });
  return object;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/environmentManager.js
var isServerFn = () => isServer$1;
/**
 * Returns whether the current runtime should be treated as a server environment.
 */
var isServer = () => isServerFn();
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/subscribable.js
/**
 * The base class behind everything in Query that you can subscribe to: `QueryCache`, `MutationCache`,
 * the observers, and the `FocusManager`/`OnlineManager` behind `focusManager` and `onlineManager`.
 * Subclasses decide what a listener receives and when it is called.
 */
var Subscribable = class {
  constructor() {
    this.listeners = /* @__PURE__ */ new Set();
    this.subscribe = this.subscribe.bind(this);
  }
  /**
   * Registers a listener to be called on every update this object notifies about. Returns a function
   * that removes the listener again — call it to stop listening. The base class never drops a listener
   * on its own, though some subclasses clear all of theirs in `destroy()`.
   * @param listener - Called on each update, with whatever the subclass passes to its subscribers.
   * @example
   * ```ts
   * const unsubscribe = subscribable.subscribe(() => {
   *   // react to the update
   * })
   *
   * unsubscribe()
   * ```
   */
  subscribe(listener) {
    this.listeners.add(listener);
    this.onSubscribe();
    return () => {
      this.listeners.delete(listener);
      this.onUnsubscribe();
    };
  }
  /**
   * Returns `true` while at least one listener is registered, `false` once they have all unsubscribed.
   */
  hasListeners() {
    return this.listeners.size > 0;
  }
  onSubscribe() {}
  onUnsubscribe() {}
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/focusManager.js
/**
 * The `FocusManager` manages the focus state within TanStack Query.
 *
 * It can be used to change the default event listeners or to manually change the focus state.
 */
var FocusManager = class extends Subscribable {
  #focused;
  #cleanup;
  #setup;
  constructor() {
    super();
    this.#setup = (onFocus) => {
      if (typeof window !== "undefined" && window.addEventListener) {
        const listener = () => onFocus();
        window.addEventListener("visibilitychange", listener, false);
        return () => {
          window.removeEventListener("visibilitychange", listener);
        };
      }
    };
  }
  onSubscribe() {
    if (!this.#cleanup) this.setEventListener(this.#setup);
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.#cleanup?.();
      this.#cleanup = void 0;
    }
  }
  /**
   * `setEventListener` can be used to set a custom event listener that will
   * be used to determine the focus state. The provided `setup` function
   * receives a `setFocused` callback: call it with a `boolean` to manually
   * set the focus state, or with no arguments to re-evaluate the current
   * focus state and notify subscribers.
   *
   * @example
   * ```ts
   * import { focusManager } from '@tanstack/query-core'
   *
   * focusManager.setEventListener((handleFocus) => {
   *   const listener = () => handleFocus()
   *   // Listen to visibilitychange
   *   if (typeof window !== 'undefined' && window.addEventListener) {
   *     window.addEventListener('visibilitychange', listener, false)
   *   }
   *
   *   return () => {
   *     // Be sure to unsubscribe if a new handler is set
   *     window.removeEventListener('visibilitychange', listener)
   *   }
   * })
   * ```
   */
  setEventListener(setup) {
    this.#setup = setup;
    this.#cleanup?.();
    this.#cleanup = setup((focused) => {
      if (typeof focused === "boolean") this.setFocused(focused);
      else this.onFocus();
    });
  }
  /**
   * `setFocused` can be used to manually set the focus state. Set `undefined`
   * to fall back to the default focus check.
   *
   * @example
   * ```ts
   * import { focusManager } from '@tanstack/query-core'
   *
   * // Set focused
   * focusManager.setFocused(true)
   *
   * // Set unfocused
   * focusManager.setFocused(false)
   *
   * // Fallback to the default focus check
   * focusManager.setFocused(undefined)
   * ```
   */
  setFocused(focused) {
    if (this.#focused !== focused) {
      this.#focused = focused;
      this.onFocus();
    }
  }
  /**
   * `onFocus` notifies all subscribed listeners with the current focus state.
   */
  onFocus() {
    const isFocused = this.isFocused();
    this.listeners.forEach((listener) => {
      listener(isFocused);
    });
  }
  /**
   * `isFocused` can be used to get the current focus state.
   */
  isFocused() {
    if (typeof this.#focused === "boolean") return this.#focused;
    return globalThis.document?.visibilityState !== "hidden";
  }
};
/**
 * Singleton instance of {@link FocusManager}, used to manage and observe the focus state within TanStack Query.
 */
var focusManager = new FocusManager();
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/notifyManager.js
/**
 * Default scheduling function used by the notify manager.
 * Schedules the callback with the system's `setTimeout(callback, 0)`.
 */
var defaultScheduler = systemSetTimeoutZero;
function createNotifyManager() {
  let queue = [];
  let transactions = 0;
  let notifyFn = (callback) => {
    callback();
  };
  let batchNotifyFn = (callback) => {
    callback();
  };
  let scheduleFn = defaultScheduler;
  const schedule = (callback) => {
    if (transactions) queue.push(callback);
    else
      scheduleFn(() => {
        notifyFn(callback);
      });
  };
  const flush = () => {
    const originalQueue = queue;
    queue = [];
    if (originalQueue.length)
      scheduleFn(() => {
        batchNotifyFn(() => {
          originalQueue.forEach((callback) => {
            notifyFn(callback);
          });
        });
      });
  };
  return {
    /**
     * Batches all updates scheduled inside the passed callback.
     * This is mainly used internally to optimize query client updating.
     * Batches can be nested; the queue is only flushed once the outermost `batch` call finishes.
     * The return value of `callback` is passed through.
     */
    batch: (callback) => {
      let result;
      transactions++;
      try {
        result = callback();
      } finally {
        transactions--;
        if (!transactions) flush();
      }
      return result;
    },
    /**
     * All calls to the wrapped function will be batched.
     */
    batchCalls: (callback) => {
      return (...args) => {
        schedule(() => {
          callback(...args);
        });
      };
    },
    /**
     * Schedules a function to be run on the next batch.
     * By default, the batch is run with a `setTimeout`, but this can be configured via `setScheduler`.
     */
    schedule,
    /**
     * Use this method to set a custom notify function.
     * This can be used to for example wrap notifications with `React.act` while running tests.
     */
    setNotifyFunction: (fn) => {
      notifyFn = fn;
    },
    /**
     * Use this method to set a custom function to batch notifications together into a single tick.
     * Framework adapters use this to plug in their own batching primitive, so that a single query
     * update only triggers one re-render instead of one per subscriber.
     *
     * @example
     * ```ts
     * import { notifyManager } from '@tanstack/query-core'
     * import { batch } from 'solid-js'
     *
     * notifyManager.setBatchNotifyFunction(batch)
     * ```
     */
    setBatchNotifyFunction: (fn) => {
      batchNotifyFn = fn;
    },
    /**
     * Configures a custom callback that schedules when the next batch runs.
     * The default behavior is `setTimeout(callback, 0)`.
     *
     * @example
     * ```ts
     * import { notifyManager } from '@tanstack/query-core'
     *
     * // Schedule batches in the next microtask
     * notifyManager.setScheduler(queueMicrotask)
     *
     * // Schedule batches before the next frame is rendered
     * notifyManager.setScheduler(requestAnimationFrame)
     *
     * // Schedule batches some time in the future
     * notifyManager.setScheduler((cb) => setTimeout(cb, 10))
     * ```
     */
    setScheduler: (fn) => {
      scheduleFn = fn;
    },
  };
}
/**
 * Handles scheduling and batching callbacks in TanStack Query.
 */
var notifyManager = createNotifyManager();
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/onlineManager.js
/**
 * The `OnlineManager` manages the online state within TanStack Query. It can
 * be used to change the default event listeners or to manually change the
 * online state.
 *
 * By default, the `onlineManager` assumes an active network connection, and
 * listens to the `online` and `offline` events on the `window` object to
 * detect changes.
 */
var OnlineManager = class extends Subscribable {
  #online = true;
  #cleanup;
  #setup;
  constructor() {
    super();
    this.#setup = (onOnline) => {
      if (typeof window !== "undefined" && window.addEventListener) {
        const onlineListener = () => onOnline(true);
        const offlineListener = () => onOnline(false);
        window.addEventListener("online", onlineListener, false);
        window.addEventListener("offline", offlineListener, false);
        return () => {
          window.removeEventListener("online", onlineListener);
          window.removeEventListener("offline", offlineListener);
        };
      }
    };
  }
  onSubscribe() {
    if (!this.#cleanup) this.setEventListener(this.#setup);
  }
  onUnsubscribe() {
    if (!this.hasListeners()) {
      this.#cleanup?.();
      this.#cleanup = void 0;
    }
  }
  /**
   * `setEventListener` can be used to set a custom event listener that will
   * be used to determine the online state. The provided `setup` function
   * receives a `setOnline` callback that should be called with a `boolean`
   * whenever the online state changes.
   *
   * @example
   * ```ts
   * import NetInfo from '@react-native-community/netinfo'
   * import { onlineManager } from '@tanstack/query-core'
   *
   * onlineManager.setEventListener((setOnline) => {
   *   return NetInfo.addEventListener((state) => {
   *     setOnline(!!state.isConnected)
   *   })
   * })
   * ```
   */
  setEventListener(setup) {
    this.#setup = setup;
    this.#cleanup?.();
    this.#cleanup = setup(this.setOnline.bind(this));
  }
  /**
   * `setOnline` can be used to manually set the online state.
   *
   * @example
   * ```ts
   * import { onlineManager } from '@tanstack/query-core'
   *
   * // Set to online
   * onlineManager.setOnline(true)
   *
   * // Set to offline
   * onlineManager.setOnline(false)
   * ```
   */
  setOnline(online) {
    if (this.#online !== online) {
      this.#online = online;
      this.listeners.forEach((listener) => {
        listener(online);
      });
    }
  }
  /**
   * `isOnline` can be used to get the current online state.
   */
  isOnline() {
    return this.#online;
  }
};
/**
 * Singleton instance of {@link OnlineManager}, used to manage and observe the online state within TanStack Query.
 */
var onlineManager = new OnlineManager();
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/retryer.js
function defaultRetryDelay(failureCount) {
  return Math.min(1e3 * 2 ** failureCount, 3e4);
}
function canFetch(networkMode) {
  return (networkMode ?? "online") === "online" ? onlineManager.isOnline() : true;
}
/**
 * The error thrown by a `Retryer` (and surfaced to `query.promise`/`mutation`) when a fetch is cancelled, e.g. via
 * `query.cancel()`. `revert`, if `true`, tells the caller to restore the state the query was in before the fetch
 * started instead of surfacing the error. `silent`, if `true`, tells the caller to suppress this error and instead
 * resolve with the promise of the fetch that triggered the cancellation.
 * @example
 * ```ts
 * query.cancel()
 *
 * try {
 *   await query.promise
 * } catch (error) {
 *   if (error instanceof CancelledError) {
 *     // the fetch was cancelled, e.g. via `query.cancel()`
 *   }
 * }
 * ```
 */
var CancelledError = class extends Error {
  constructor(options) {
    super("CancelledError");
    this.revert = options?.revert;
    this.silent = options?.silent;
  }
};
function createRetryer(config) {
  let isRetryCancelled = false;
  let failureCount = 0;
  let continueFn;
  let status = "pending";
  let promiseResolve;
  let promiseReject;
  const promise = new Promise((resolve, reject) => {
    promiseResolve = resolve;
    promiseReject = reject;
  });
  promise.catch(noop);
  const isResolved = () => status !== "pending";
  const cancel = (cancelOptions) => {
    if (!isResolved()) {
      const error = new CancelledError(cancelOptions);
      reject(error);
      config.onCancel?.(error);
    }
  };
  const cancelRetry = () => {
    isRetryCancelled = true;
  };
  const continueRetry = () => {
    isRetryCancelled = false;
  };
  const canContinue = () =>
    focusManager.isFocused() &&
    (config.networkMode === "always" || onlineManager.isOnline()) &&
    config.canRun();
  const canStart = () => canFetch(config.networkMode) && config.canRun();
  const resolve = (value) => {
    if (!isResolved()) {
      continueFn?.();
      status = "resolved";
      promiseResolve(value);
    }
  };
  const reject = (value) => {
    if (!isResolved()) {
      continueFn?.();
      status = "rejected";
      promiseReject(value);
    }
  };
  const pause = () => {
    return new Promise((continueResolve) => {
      continueFn = (value) => {
        if (isResolved() || canContinue()) continueResolve(value);
      };
      config.onPause?.();
    }).then(() => {
      continueFn = void 0;
      if (!isResolved()) config.onContinue?.();
    });
  };
  const run = () => {
    if (isResolved()) return;
    let promiseOrValue;
    const initialPromise = failureCount === 0 ? config.initialPromise : void 0;
    try {
      promiseOrValue = initialPromise ?? config.fn();
    } catch (error) {
      promiseOrValue = Promise.reject(error);
    }
    Promise.resolve(promiseOrValue)
      .then(resolve)
      .catch((error) => {
        if (isResolved()) return;
        const retry = config.retry ?? (isServer() ? 0 : 3);
        const retryDelay = config.retryDelay ?? defaultRetryDelay;
        const delay =
          typeof retryDelay === "function" ? retryDelay(failureCount, error) : retryDelay;
        const shouldRetry =
          retry === true ||
          (typeof retry === "number" && failureCount < retry) ||
          (typeof retry === "function" && retry(failureCount, error));
        if (isRetryCancelled || !shouldRetry) {
          reject(error);
          return;
        }
        failureCount++;
        config.onFail?.(failureCount, error);
        sleep(delay)
          .then(() => {
            return canContinue() ? void 0 : pause();
          })
          .then(() => {
            if (isRetryCancelled) reject(error);
            else run();
          });
      });
  };
  return {
    promise,
    status: () => status,
    cancel,
    continue: () => {
      continueFn?.();
      return promise;
    },
    cancelRetry,
    continueRetry,
    canStart,
    start: () => {
      if (canStart()) run();
      else pause().then(run);
      return promise;
    },
  };
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/removable.js
/**
 * The base class for cache entries that are garbage collected once nothing is using them —
 * `Query` and `Mutation` both extend it. `gcTime` controls how long an unused entry is kept.
 */
var Removable = class {
  #gcTimeout;
  /**
   * Clears the pending garbage collection timeout, so the entry is no longer scheduled for removal.
   * A subclass may override this to release what it holds on to as well — `Query` also cancels any
   * in-flight fetch.
   */
  destroy() {
    this.clearGcTimeout();
  }
  scheduleGc() {
    this.clearGcTimeout();
    if (isValidTimeout(this.gcTime))
      this.#gcTimeout = timeoutManager.setTimeout(() => {
        this.optionalRemove();
      }, this.gcTime);
  }
  updateGcTime(newGcTime) {
    this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? (isServer() ? Infinity : 3e5));
  }
  clearGcTimeout() {
    if (this.#gcTimeout !== void 0) {
      timeoutManager.clearTimeout(this.#gcTimeout);
      this.#gcTimeout = void 0;
    }
  }
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/mutation.js
/**
 * Represents a single mutation attempt. A `Mutation` holds the mutation's
 * options, state (data/error/status), and the `MutationObserver`s currently
 * subscribed to it.
 *
 * Instances are created and managed internally by `MutationCache`; application
 * code typically interacts with mutations indirectly through `QueryClient` or
 * a framework hook like `useMutation`. Direct access to a `Mutation` instance
 * is possible via `mutationCache.find()`/`getAll()` for inspecting cache state.
 *
 * @example
 * ```ts
 * const mutationCache = queryClient.getMutationCache()
 *
 * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
 * ```
 */
var Mutation = class extends Removable {
  #client;
  #observers;
  #mutationCache;
  #retryer;
  constructor(config) {
    super();
    this.#client = config.client;
    this.mutationId = config.mutationId;
    this.#mutationCache = config.mutationCache;
    this.#observers = [];
    this.state = config.state || getDefaultState();
    this.setOptions(config.options);
    this.scheduleGc();
  }
  /** @internal */
  setOptions(options) {
    this.options = options;
    this.updateGcTime(this.options.gcTime);
  }
  /**
   * The `meta` object passed in the mutation's options, if any.
   */
  get meta() {
    return this.options.meta;
  }
  /** @internal */
  addObserver(observer) {
    if (!this.#observers.includes(observer)) {
      this.#observers.push(observer);
      this.clearGcTimeout();
      this.#mutationCache.notify({
        type: "observerAdded",
        mutation: this,
        observer,
      });
    }
  }
  /** @internal */
  removeObserver(observer) {
    this.#observers = this.#observers.filter((x) => x !== observer);
    this.scheduleGc();
    this.#mutationCache.notify({
      type: "observerRemoved",
      mutation: this,
      observer,
    });
  }
  optionalRemove() {
    if (!this.#observers.length) {
      if (this.state.status === "pending") this.scheduleGc();
      else this.#mutationCache.remove(this);
    }
  }
  /**
   * Resumes a mutation that is currently paused or was restored from a
   * dehydrated, still-`pending` state.
   *
   * - If this mutation has an active retryer (it paused mid-attempt, e.g. due
   *   to the network mode or scope-based queuing), its retryer is resumed.
   * - Otherwise, if the mutation's status is still `pending` (e.g. it was
   *   dehydrated while an attempt was in flight and never got a retryer in
   *   this instance), `execute` is called again with the last known variables.
   * - Otherwise the mutation has already settled and this resolves immediately
   *   without running anything again.
   *
   * @example
   * ```ts
   * // typically driven by reconnect handling, e.g. queryClient.resumePausedMutations()
   * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
   * await mutation?.continue()
   * ```
   *
   * @see {@link Mutation#execute}
   */
  continue() {
    return (
      this.#retryer?.continue() ??
      (this.state.status === "pending" ? this.execute(this.state.variables) : Promise.resolve())
    );
  }
  /**
   * Runs the mutation function for the given variables through a retryer, and
   * drives the mutation's state and lifecycle callbacks through to settlement.
   *
   * If this mutation's state is already `pending` when `execute` is called
   * (i.e. it was restored, still in-flight, from a dehydrated state), the
   * `onMutate` step is skipped and a `continue` action is dispatched to
   * unpause it; otherwise a `pending` action is dispatched first, then the
   * mutation cache's `onMutate` and the mutation's own `onMutate` option are
   * awaited in that order, and the resulting context is stored.
   *
   * The mutation function is then run (subject to `retry`/`retryDelay`/
   * `networkMode`, and to the mutation cache's scope-based serialization).
   * On success, the cache's `onSuccess`/`onSettled` callbacks run before the
   * mutation's own `onSuccess`/`onSettled` options, a `success` action is
   * dispatched, and the resolved data is returned. On failure, the same
   * cache-then-option ordering is used for `onError`/`onSettled`, but each of
   * those four callbacks is individually caught so that a throwing callback
   * cannot mask the original error; an `error` action is then dispatched and
   * the original error is re-thrown.
   *
   * @example
   * ```ts
   * // Called internally by `MutationObserver.mutate` and `Mutation.continue` —
   * // applications normally trigger mutations through those, not this method.
   * const data = await mutation.execute(variables)
   * ```
   *
   * @see {@link Mutation#continue}
   */
  async execute(variables) {
    const onContinue = () => {
      this.#dispatch({ type: "continue" });
    };
    const mutationFnContext = {
      client: this.#client,
      meta: this.options.meta,
      mutationKey: this.options.mutationKey,
    };
    const retryer = (this.#retryer = createRetryer({
      fn: () => {
        if (!this.options.mutationFn)
          return Promise.reject(/* @__PURE__ */ new Error("No mutationFn found"));
        return this.options.mutationFn(variables, mutationFnContext);
      },
      onFail: (failureCount, error) => {
        this.#dispatch({
          type: "failed",
          failureCount,
          error,
        });
      },
      onPause: () => {
        this.#dispatch({ type: "pause" });
      },
      onContinue,
      retry: this.options.retry ?? 0,
      retryDelay: this.options.retryDelay,
      networkMode: this.options.networkMode,
      canRun: () => this.#mutationCache.canRun(this),
    }));
    const restored = this.state.status === "pending";
    const isPaused = !retryer.canStart();
    try {
      if (restored) onContinue();
      else {
        this.#dispatch({
          type: "pending",
          variables,
          isPaused,
        });
        if (this.#mutationCache.config.onMutate)
          await this.#mutationCache.config.onMutate(variables, this, mutationFnContext);
        const context = await this.options.onMutate?.(variables, mutationFnContext);
        if (context !== this.state.context)
          this.#dispatch({
            type: "pending",
            context,
            variables,
            isPaused,
          });
      }
      const data = await retryer.start();
      await this.#mutationCache.config.onSuccess?.(
        data,
        variables,
        this.state.context,
        this,
        mutationFnContext,
      );
      await this.options.onSuccess?.(data, variables, this.state.context, mutationFnContext);
      await this.#mutationCache.config.onSettled?.(
        data,
        null,
        this.state.variables,
        this.state.context,
        this,
        mutationFnContext,
      );
      await this.options.onSettled?.(data, null, variables, this.state.context, mutationFnContext);
      this.#dispatch({
        type: "success",
        data,
      });
      return data;
    } catch (error) {
      try {
        await this.#mutationCache.config.onError?.(
          error,
          variables,
          this.state.context,
          this,
          mutationFnContext,
        );
      } catch (e) {
        Promise.reject(e);
      }
      try {
        await this.options.onError?.(error, variables, this.state.context, mutationFnContext);
      } catch (e) {
        Promise.reject(e);
      }
      try {
        await this.#mutationCache.config.onSettled?.(
          void 0,
          error,
          this.state.variables,
          this.state.context,
          this,
          mutationFnContext,
        );
      } catch (e) {
        Promise.reject(e);
      }
      try {
        await this.options.onSettled?.(
          void 0,
          error,
          variables,
          this.state.context,
          mutationFnContext,
        );
      } catch (e) {
        Promise.reject(e);
      }
      this.#dispatch({
        type: "error",
        error,
      });
      throw error;
    } finally {
      if (this.#retryer === retryer) this.#retryer = void 0;
      this.#mutationCache.runNext(this);
    }
  }
  #dispatch(action) {
    const reducer = (state) => {
      switch (action.type) {
        case "failed":
          return {
            ...state,
            failureCount: action.failureCount,
            failureReason: action.error,
          };
        case "pause":
          return {
            ...state,
            isPaused: true,
          };
        case "continue":
          return {
            ...state,
            isPaused: false,
          };
        case "pending":
          return {
            ...state,
            context: action.context,
            data: void 0,
            failureCount: 0,
            failureReason: null,
            error: null,
            isPaused: action.isPaused,
            status: "pending",
            variables: action.variables,
            submittedAt: Date.now(),
          };
        case "success":
          return {
            ...state,
            data: action.data,
            failureCount: 0,
            failureReason: null,
            error: null,
            status: "success",
            isPaused: false,
          };
        case "error":
          return {
            ...state,
            data: void 0,
            error: action.error,
            failureCount: state.failureCount + 1,
            failureReason: action.error,
            isPaused: false,
            status: "error",
          };
      }
    };
    this.state = reducer(this.state);
    notifyManager.batch(() => {
      this.#observers.forEach((observer) => {
        observer.onMutationUpdate(action);
      });
      this.#mutationCache.notify({
        mutation: this,
        type: "updated",
        action,
      });
    });
  }
};
function getDefaultState() {
  return {
    context: void 0,
    data: void 0,
    error: null,
    failureCount: 0,
    failureReason: null,
    isPaused: false,
    status: "idle",
    variables: void 0,
    submittedAt: 0,
  };
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/mutationObserver.js
/**
 * Observes a single mutation and derives a `MutationObserverResult` from it.
 * A framework hook like `useMutation` creates one `MutationObserver` per hook
 * call, keeps it stable across re-renders, calls `setOptions` when the options
 * passed to the hook change, subscribes to it to re-render on updates, and
 * reads `getCurrentResult()` for the value to return. Calling `mutate()`
 * builds a new underlying `Mutation` in the `MutationCache` and executes it.
 *
 * @example
 * ```ts
 * const observer = new MutationObserver(queryClient, {
 *   mutationFn: (variables: { title: string }) => addPost(variables),
 * })
 * ```
 */
var MutationObserver = class extends Subscribable {
  #client;
  #currentResult = void 0;
  #currentMutation;
  #mutateOptions;
  constructor(client, options) {
    super();
    this.#client = client;
    this.setOptions(options);
    this.bindMethods();
    this.#updateResult();
  }
  bindMethods() {
    this.mutate = this.mutate.bind(this);
    this.reset = this.reset.bind(this);
  }
  /**
   * Updates the observer's options.
   *
   * If the new `mutationKey` differs from the previous one (and both were
   * defined), the observer is reset, detaching it from the mutation it was
   * observing. Otherwise, if the currently observed mutation is still
   * `pending`, its options are updated in place as well.
   *
   * @example
   * ```ts
   * observer.setOptions({
   *   mutationFn: (variables: { title: string }) => addPost(variables),
   *   onSuccess: (data) => console.log(data),
   * })
   * ```
   */
  setOptions(options) {
    const prevOptions = this.options;
    this.options = this.#client.defaultMutationOptions(options);
    if (!shallowEqualObjects(this.options, prevOptions))
      this.#client.getMutationCache().notify({
        type: "observerOptionsUpdated",
        mutation: this.#currentMutation,
        observer: this,
      });
    if (
      prevOptions?.mutationKey &&
      this.options.mutationKey &&
      hashKey(prevOptions.mutationKey) !== hashKey(this.options.mutationKey)
    )
      this.reset();
    else if (this.#currentMutation?.state.status === "pending")
      this.#currentMutation.setOptions(this.options);
  }
  onSubscribe() {
    if (this.listeners.size === 1 && this.#currentMutation) {
      this.#currentMutation.addObserver(this);
      this.#updateResult();
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) this.#currentMutation?.removeObserver(this);
  }
  /** @internal */
  onMutationUpdate(action) {
    this.#updateResult();
    this.#notify(action);
  }
  /**
   * Returns the observer's current result, derived from the observed
   * mutation's state (or the default, `idle` state if no mutation has been
   * built yet, e.g. before the first `mutate()` call or after `reset()`).
   */
  getCurrentResult() {
    return this.#currentResult;
  }
  /**
   * Detaches the observer from the mutation it is currently observing (if
   * any) and resets the observed result back to its default, `idle` state.
   *
   * This does not cancel an in-flight mutation; the mutation itself keeps
   * running to completion and its own callbacks still fire, but this
   * observer stops reflecting its state and a subsequent `mutate()` call
   * will build a brand new mutation.
   *
   * @example
   * ```ts
   * observer.reset()
   * ```
   *
   * @see {@link MutationObserver#mutate}
   */
  reset() {
    this.#currentMutation?.removeObserver(this);
    this.#currentMutation = void 0;
    this.#updateResult();
    this.#notify();
  }
  /**
   * Builds a new `Mutation` in the `MutationCache` using the observer's
   * current options, detaches this observer from any previously observed
   * mutation, attaches it to the new one, and executes it with the given
   * variables.
   *
   * The optional per-call `options` (`onSuccess`/`onError`/`onSettled`) are
   * invoked once the mutation settles, in addition to any callbacks defined
   * on the observer's own options.
   *
   * @example
   * ```ts
   * await observer.mutate(
   *   { title: 'New post' },
   *   { onSuccess: (data) => console.log(data) },
   * )
   * ```
   */
  mutate(variables, options) {
    this.#mutateOptions = options;
    this.#currentMutation?.removeObserver(this);
    this.#currentMutation = this.#client.getMutationCache().build(this.#client, this.options);
    this.#currentMutation.addObserver(this);
    return this.#currentMutation.execute(variables);
  }
  #updateResult() {
    const state = this.#currentMutation?.state ?? getDefaultState();
    this.#currentResult = {
      ...state,
      isPending: state.status === "pending",
      isSuccess: state.status === "success",
      isError: state.status === "error",
      isIdle: state.status === "idle",
      mutate: this.mutate,
      reset: this.reset,
    };
  }
  #notify(action) {
    notifyManager.batch(() => {
      if (this.#mutateOptions && this.hasListeners()) {
        const variables = this.#currentResult.variables;
        const onMutateResult = this.#currentResult.context;
        const context = {
          client: this.#client,
          meta: this.options.meta,
          mutationKey: this.options.mutationKey,
        };
        if (action?.type === "success") {
          try {
            this.#mutateOptions.onSuccess?.(action.data, variables, onMutateResult, context);
          } catch (e) {
            Promise.reject(e);
          }
          try {
            this.#mutateOptions.onSettled?.(action.data, null, variables, onMutateResult, context);
          } catch (e) {
            Promise.reject(e);
          }
        } else if (action?.type === "error") {
          try {
            this.#mutateOptions.onError?.(action.error, variables, onMutateResult, context);
          } catch (e) {
            Promise.reject(e);
          }
          try {
            this.#mutateOptions.onSettled?.(
              void 0,
              action.error,
              variables,
              onMutateResult,
              context,
            );
          } catch (e) {
            Promise.reject(e);
          }
        }
      }
      this.listeners.forEach((listener) => {
        listener(this.#currentResult);
      });
    });
  }
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/useMutation.js
/**
 * Unlike queries, mutations are typically used to create/update/delete data or perform server side-effects.
 * `useMutation` is the hook for that.
 *
 * @see {@link mutationOptions} to share these options across multiple `useMutation` call sites, or to look
 * the mutation up elsewhere via its `mutationKey` (e.g. with `useMutationState`).
 * @param options - The {@link UseMutationOptions} to use — everything you can pass to `useMutation`.
 * @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
 * be used.
 * @returns `mutate`/`mutateAsync` also accept per-call `onSuccess`/`onError`/`onSettled` callbacks as a second
 * argument, useful for triggering call-site side effects (e.g. navigation) without coupling them to the shared
 * mutation definition. Hook-level callbacks (passed to `options`) fire for every mutation; per-call callbacks
 * fire only for the latest call you've made, and only while the component is still mounted — unmounting before
 * the mutation settles removes the subscription and prevents them from firing.
 *
 * @example
 * ```tsx
 * import { useMutation, useQueryClient } from '@tanstack/react-query'
 *
 * function AddTodo() {
 *   const queryClient = useQueryClient()
 *
 *   const addMutation = useMutation({
 *     mutationFn: addTodo,
 *     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
 *   })
 *
 *   return (
 *     <button
 *       onClick={() =>
 *         addMutation.mutate('Item', {
 *           onError: (error) => console.error('Failed to add item:', error),
 *         })
 *       }
 *     >
 *       Add
 *     </button>
 *   )
 * }
 * ```
 *
 * @example
 * Rendering the mutation's own state, rather than just firing it off:
 * ```tsx
 * import { useMutation, useQueryClient } from '@tanstack/react-query'
 *
 * function AddTodo() {
 *   const queryClient = useQueryClient()
 *
 *   const addMutation = useMutation({
 *     mutationFn: addTodo,
 *     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
 *   })
 *
 *   return (
 *     <div>
 *       {addMutation.isPending ? (
 *         'Adding todo...'
 *       ) : (
 *         <>
 *           {addMutation.isError ? (
 *             <div>An error occurred: {addMutation.error.message}</div>
 *           ) : null}
 *           <button onClick={() => addMutation.mutate('Item')}>Add</button>
 *         </>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 *
 * @example
 * Optimistic update via `onMutate`, rolling back on `onError`:
 * ```tsx
 * import { useMutation, useQueryClient } from '@tanstack/react-query'
 *
 * function AddTodo() {
 *   const queryClient = useQueryClient()
 *
 *   const addMutation = useMutation({
 *     mutationFn: addTodo,
 *     onMutate: async (newTodo) => {
 *       await queryClient.cancelQueries({ queryKey: ['todos'] })
 *       const previousTodos = queryClient.getQueryData<Array<string>>(['todos'])
 *
 *       queryClient.setQueryData<Array<string>>(['todos'], (old) => [
 *         ...(old ?? []),
 *         newTodo,
 *       ])
 *
 *       // Passed to `onError` as `onMutateResult` if the mutation fails.
 *       return { previousTodos }
 *     },
 *     onError: (_err, _newTodo, onMutateResult) => {
 *       queryClient.setQueryData(['todos'], onMutateResult?.previousTodos)
 *     },
 *     onSettled: () => {
 *       queryClient.invalidateQueries({ queryKey: ['todos'] })
 *     },
 *   })
 *
 *   return (
 *     <button onClick={() => addMutation.mutate('Item')}>Add</button>
 *   )
 * }
 * ```
 *
 * @example
 * Callbacks passed per call to `mutate` only fire for the last call — `mutateAsync` gives you a
 * promise per call instead, so you can wait for all of them when they succeed:
 * ```tsx
 * import { useMutation, useQueryClient } from '@tanstack/react-query'
 *
 * function AddTodos() {
 *   const queryClient = useQueryClient()
 *
 *   const addMutation = useMutation({
 *     mutationFn: addTodo,
 *     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
 *   })
 *
 *   async function handleAddAll(todos: Array<string>) {
 *     try {
 *       await Promise.all(todos.map((todo) => addMutation.mutateAsync(todo)))
 *     } catch (error) {
 *       console.error('Failed to add todos:', error)
 *     }
 *   }
 *
 *   return (
 *     <button onClick={() => handleAddAll(['Todo 1', 'Todo 2', 'Todo 3'])}>
 *       Add all
 *     </button>
 *   )
 * }
 * ```
 *
 * @example
 * If some of the mutations above can fail independently of the others, and you want to know which ones
 * did — rather than losing that information the moment the first one rejects — swap `Promise.all` for
 * `Promise.allSettled`:
 * ```tsx
 * import { useMutation, useQueryClient } from '@tanstack/react-query'
 *
 * function AddTodos() {
 *   const queryClient = useQueryClient()
 *
 *   const addMutation = useMutation({
 *     mutationFn: addTodo,
 *     onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
 *   })
 *
 *   async function handleAddAll(todos: Array<string>) {
 *     const addResults = await Promise.allSettled(
 *       todos.map((todo) => addMutation.mutateAsync(todo)),
 *     )
 *
 *     addResults.forEach((addResult, index) => {
 *       if (addResult.status === 'rejected') {
 *         console.error(`Failed to add "${todos[index]}":`, addResult.reason)
 *       }
 *     })
 *   }
 *
 *   return (
 *     <button onClick={() => handleAddAll(['Todo 1', 'Todo 2', 'Todo 3'])}>
 *       Add all
 *     </button>
 *   )
 * }
 * ```
 */
function useMutation(options, queryClient) {
  const client = useQueryClient(queryClient);
  const [observer] = import_react.useState(() => new MutationObserver(client, options));
  import_react.useEffect(() => {
    observer.setOptions(options);
  }, [observer, options]);
  const result = import_react.useSyncExternalStore(
    import_react.useCallback(
      (onStoreChange) => observer.subscribe(notifyManager.batchCalls(onStoreChange)),
      [observer],
    ),
    () => observer.getCurrentResult(),
    () => observer.getCurrentResult(),
  );
  const mutate = import_react.useCallback(
    (...args) => {
      observer.mutate(args[0], args[1]).catch(noop);
    },
    [observer],
  );
  if (result.error && shouldThrowError(observer.options.throwOnError, [result.error]))
    throw result.error;
  return {
    ...result,
    mutate,
    mutateAsync: result.mutate,
  };
}
//#endregion
//#region ../../node_modules/.pnpm/cn@0.4.0/node_modules/cn/dist/tables.js
var P = 48;
var U = (s, o = 0) => {
  const out = new Int32Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) - P - o;
  return out;
};
var PS = (counts) => {
  const out = new Int32Array(counts.length + 1);
  for (let i = 0; i < counts.length; i++) out[i + 1] = out[i] + counts[i];
  return out;
};
var DZ = (s) => {
  const out = new Int32Array(s.length);
  let a = 0;
  for (let i = 0; i < s.length; i++) {
    const z = s.charCodeAt(i) - P;
    a += (z >>> 1) ^ -(z & 1);
    out[i] = a;
  }
  return out;
};
var GROUP_COUNT = 384;
var customValidatorNames = [];
var edgeStart = PS(
  U(
    "E0500002005282000000002000150000020021820000011200000003022202000300004200120000200420001200021200301200010400162000010000220021010:2192001200220012000220012000200200200400010200040000000000400200108200110100000022010313000162002000020020012020080213000228200000000082000000000120002000120020020040101020300130001001010",
  ),
);
var labelStart = PS(
  U(
    ":11111111211111119311546544411119731869:671397415686432441111111111161114151214313433415:78311132233313187211117221449443411141111151152226611131111112212518142224214215421421542142424242516171151615616347111111111197911327451111111111111111111113134714133513411111311111111111111111111112444411111342312715245411117:3",
  ),
);
var labelText =
  "@containerabcdefghinlmoprstunderlineviawzccentlignnimatespectuto-colsrowsaglorightnessckdrop-sisbcontrastfiltergrayscalehue-rotateinvertopacityslurrightnessaturateepia-coniclinearpositionradialsizeockurrderttom-belrstxyespacing-xyaretoursorlnt-umnsendspantartainentrasteividerop-shadowurationcorationlay-xyasendillexontromlter-featuresstretchapr-xyayscaleidow-colsrowsue-rotatedentlinesetvert-beringsxyeshadoweiadingftnest-clamp-imageabein-lrstxyskx--b-coniclpositionrsizet-x-y-fromto-fromto-inearfromto-fromto-adialfromto-fromtofromtofromtofromtoblockhinlinew-screenesblockhinlinewbjectpacityrutlinederigin-offsetbelrstxyesrspective-originaceholderioghtng-offsettateundedw-xyz-belrstlreseslr-endspantartaturatecepiahizekewpace-taleroll-xyz-barmpbelrstxyesbelrstxyes-thumbrackadowrink-xyxyartrokeabextora-shadowpckingnsformitionlate-xyz-offsetill-changeoom";
var edgeTarget = (() => {
  const N = edgeStart.length - 1;
  const sizes = new Int32Array(N);
  for (let i = N - 1; i >= 0; i--) {
    let s = 1;
    let c = i + 1;
    for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) {
      s += sizes[c];
      c += sizes[c];
    }
    sizes[i] = s;
  }
  const out = new Int32Array(edgeStart[N]);
  let e = 0;
  for (let i = 0; i < N; i++) {
    let c = i + 1;
    for (let k = edgeStart[i]; k < edgeStart[i + 1]; k++) {
      out[e++] = c;
      c += sizes[c];
    }
  }
  return out;
})();
var nodeGroup = U(
  "02000000000000900<=0?000B000F00F00ŏI0J0LNPRTVX0000]_a00000000000000000000000rst0000000zŏ00000000000ŏ0000000ŏ00000000000000000000000000000000000000000000000000000000000000Ë000000000000000000000Þ000000000000000000ð0000000ø0ùúûüýþÿĀāĂăĄąĆ000000000000000000000000000000000000000000ħ0ĨĪ00000000000000000000ļĽ00000Ŭ000000",
  1,
);
var vlistPat = PS(U("123333359346463635126536711576"));
var vlistOps = U(
  "93203242332583253248325D>E?F@03263243255B:032523853:0325B:8GA032542H<C=12727B:0328432553;D>E?3257D>032585:0325B:;0328B:032",
);
var vlistRef = U(
  "012113445661666666789111:5;;;;;;;;444;;;:62999<1161=62>>?61:21@ABCD4446996:64E:::;:?::64:F114GHHIHHHHIHH1HH1HH1HHHHHH::EEJ4444::EE4444441691;644444114244444:;K6666555555555555555999666664444444444444444444444226?6:66644L9M?D:111::::6DE199",
);
var vlistGroup = DZ(
  "020200202020020020020020020020200200200200200200200002020202001003040106000200200200200200200200200200200200200200200200200200200200200200200200200200200200020020020020020020002020200202002002002002002002002002002020002002020020200220200200200200200200200200200200020020020000200020002000200200200020020020002000200200200020020202002020202000200200020022000200200020020002002000200220002002000200W0Z00020020002002020002002000200g0j0002002000200200020020002002000200200020020002000200002000002002002002002000200020000200002002002002002002002020020020200200200200200200200200202020020020020020020020020002002002020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020020002002002002002002000200200200200200200200200200020202020002000200020002002002002000020200200",
);
var nodeVlist = (() => {
  const out = /* @__PURE__ */ new Int32Array(319).fill(-1);
  const A = DZ(
    "02422242:222222242224222242442222222422222244442242226224222426222422442462222422622222222626222462242622422622422424242422222222422222222242422222222222222222622442224222222222222224424442262222222222222222222226224222424242422224422422422222",
  );
  const V = DZ(
    "02222222222222222222202222222222222222222222221422222222222222222222222222222222222Y\\222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222222221422222222222222222222222222222222222222Ŀł222222222222222222",
  );
  for (let i = 0; i < A.length; i++) out[A[i]] = V[i];
  return out;
})();
var SETS =
  "container |break-after- all auto avoid avoid-page column left page right|break-before- all auto avoid avoid-page column left page right|break-inside-a uto void void-column void-page|box-decoration- clone slice|box- border content| contents flow-root hidden table table-caption table-cell table-column table-column-group table-footer-group table-header-group table-row table-row-group| not-sr-only sr-only|float- end left none right start|clear- both end left none right start|isolat e ion-auto|overflow- auto clip hidden scroll visible|overflow-x- auto clip hidden scroll visible|overflow-y- auto clip hidden scroll visible|overscroll- auto contain none|overscroll-x- auto contain none|overscroll-y- auto contain none| absolute fixed relative static sticky| collapse invisible visible|justify- around baseline between center center-safe end end-safe evenly normal start stretch|justify-items- center center-safe end end-safe normal start stretch|justify-self- auto center center-safe end end-safe start stretch|items- baseline baseline-last center center-safe end end-safe start stretch|self- auto baseline baseline-last center center-safe end end-safe start stretch|place-content- around baseline between center center-safe end end-safe evenly start stretch|place-items- baseline center center-safe end end-safe start stretch|place-self- auto center center-safe end end-safe start stretch| antialiased subpixel-antialiased| italic not-italic|normal-nums |ordinal |slashed-zero | lining-nums oldstyle-nums| proportional-nums tabular-nums| diagonal-fractions stacked-fractions| no-underline overline| capitalize lowercase normal-case uppercase|truncate |whitespace- break-spaces normal nowrap pre pre-line pre-wrap|break- all keep normal words|wrap- anywhere break-word normal|hyphens- auto manual none|mix-blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay plus-darker plus-lighter saturation screen soft-light|table- auto fixed|caption- bottom top|backface- hidden visible|appearance- auto none|scheme- dark light light-dark normal only-dark only-light|field-sizing- content fixed|pointer-events- auto none|resize  -none -x -y|snap- align-none center end start|snap- always normal|snap- both none x y|snap- mandatory proximity|touch- auto manipulation none|touch-pan- left right x|touch-pan- down up y|touch-pinch-zoom |select- all auto none text|forced-color-adjust- auto none| normal size| baseline bottom middle sub super text-bottom text-top top| bounce none ping pulse spin| auto square video| auto fr max min px|none | auto full px| fixed local scroll|clip- border content padding text|origin- border content padding| bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| no-repeat repeat repeat-round repeat-space repeat-x repeat-y| auto contain cover| gradient-to-b gradient-to-bl gradient-to-br gradient-to-l gradient-to-r gradient-to-t gradient-to-tl gradient-to-tr none|blend- color color-burn color-dodge darken difference exclusion hard-light hue lighten luminosity multiply normal overlay saturation screen soft-light|to- b bl br l r t tl tr| auto dvh fit full lh lvh max min px screen svh| dashed dotted double hidden none solid| collapse separate|px |auto |full | content none strict| inline-size size|layout |paint |style | around baseline between center center-safe end end-safe evenly normal start stretch| alias all-scroll auto cell col-resize context-menu copy crosshair default e-resize ew-resize grab grabbing help move n-resize ne-resize nesw-resize no-drop none not-allowed ns-resize nw-resize nwse-resize pointer progress row-resize s-resize se-resize sw-resize text vertical-text w-resize wait zoom-in zoom-out| dashed dotted double solid wavy| auto from-font|reverse |initial | in in-out initial linear out| col col-reverse row row-reverse| nowrap wrap wrap-reverse| auto initial none| black bold extrabold extralight light medium normal semibold thin| condensed expanded extra-condensed extra-expanded normal semi-condensed semi-expanded ultra-condensed ultra-expanded|flow- col col-dense dense row row-dense| none subgrid| auto dvh dvw fit full lh lvh lvw max min px screen svh svw| block flex grid table| auto dvw fit full lvw max min px screen svw| loose none normal px relaxed snug tight|through |item | inside outside| decimal disc none| auto px| clip-border clip-content clip-fill clip-padding clip-stroke clip-view no-clip| add exclude intersect subtract| alpha luminance match|origin- border content fill padding stroke view|type- alpha luminance| circle ellipse| closest-corner closest-side farthest-corner farthest-side|at- bottom bottom-left bottom-right center left left-bottom left-top right right-bottom right-top top top-left top-right| dvh fit full lh lvh max min none px screen svh| auto dvh dvw fit full lh lvh lvw max min none px screen svh svw| dvw fit full lvw max min none px screen svw| auto dvh dvw fit full lvh lvw max min none prose px svh svw| auto dvh dvw fit full lvh lvw max min none px screen svh svw| contain cover fill none scale-down| first last none| distant dramatic midrange near none normal|inset | full none|3d | auto smooth|gutter- auto both stable| auto none thin| inner none| auto dvh dvw fit full lvh lvw max min px svh svw|base | center end justify left right start| clip ellipsis| balance nowrap pretty wrap| normal tight tighter wide wider widest| cpu gpu none| 3d flat| all colors none opacity shadow transform| discrete normal| full px| auto dvh dvw fit full lvh lvw max min px screen svh svw| auto contents scroll transform"
    .split("|")
    .map((s) => {
      const tails = s.split(" ");
      const prefix = tails.shift();
      for (let i = 0; i < tails.length; i++) tails[i] = prefix + tails[i];
      return tails;
    });
var AA = DZ(
  "0000000000000000000000000000000000000000000000000000000000000262242:6@200000006:240B428:4422400002046044222426220026642642462026224222824220022400000000\\00N222422242222222224062242222222422226264222422222222222222442804222422222222222222222222220<4<0204260002444020204224422",
);
var AG = DZ(
  "ɠ222222222222222222222222222222222222222222222222222222222222˕4222226>ʶ22ʷʺʷ2ʸʷ42ʴ2ʓ22>621422ɶ222ɹɼɷɺɷɺ22ɱ42222ɨ2ɧ26622ɘɓ244ƸƵ222]d24242ǖǓƚÄȫ2263ȨȥȨ2222222ǣ222222222222222222ǂƽ2ƾƵ2222222422222ƜƑ22222222222222222222144Ŧţ22Ţş222222222222222222222ĸ2ı68ĦģĦɡŰ4Ġ«®ĝ822ĔđĔ2ē2222622",
);
var AS = DZ(
  "02222222222222222222222222222222222222222222222222222222222222222202022222222222EH2200IL021042222Y\\222IL0cf2e10j2222U00X202[^2y0000120|{~22:22|22222222222G000qOVI00000}2>40000B00000I¨©000¬00000000000000021M®­00°000000000000000000000222HGHa1º222¿2À2222ÉÌ000­°2±",
);
var litAnchor = /* @__PURE__ */ new Int32Array(995);
var litGroup = /* @__PURE__ */ new Int32Array(995);
var litPool = /* @__PURE__ */ new Int32Array(995);
var poolText = "";
var poolOffsets = /* @__PURE__ */ new Int32Array(1038);
{
  const tailRef = /* @__PURE__ */ new Map();
  let nextRef = 0;
  let e = 0;
  for (let i = 0; i < AA.length; i++)
    for (const tail of SETS[AS[i]]) {
      let r = tailRef.get(tail);
      if (r === void 0) {
        r = nextRef++;
        tailRef.set(tail, r);
        poolOffsets[r * 2] = poolText.length;
        poolOffsets[r * 2 + 1] = tail.length;
        poolText += tail;
      }
      litAnchor[e] = AA[i];
      litGroup[e] = AG[i];
      litPool[e] = r;
      e++;
    }
}
var adjGid = DZ("0b2N:222@R>F@286¦2@H2D266226FB22B2>BD\\6N22222Z222D222p");
var adjStart = PS(U("1::24444432:442:44:44>222222:44:4421322511111311111114"));
var adjTgt = DZ(
  "24A;33N=C@H4A;33N=C@<27;83:;8393NQ:3NQʰ222ˉºŴŽ2R2=18cƴÅŇ=cĞÛC1ƈǝȈ:ħ25=11D3A@4=<1;1DEr25;11B3?<6;:371BCn9@7=<8192>2E121@9@EHE@9>2T25511<398454131<=V25511<398454131<=ƧNž2Đå242L222290000f22500ɛ000ǘ222",
);
var patGid = U("ĳ");
var patTgt = U("");
var postfixLookupGroups = U("1");
var tables_generated_default = {
  GROUP_COUNT,
  customValidatorNames,
  edgeStart,
  labelStart,
  labelText,
  edgeTarget,
  nodeGroup,
  nodeVlist,
  vlistPat,
  vlistOps,
  vlistRef,
  vlistGroup,
  litAnchor,
  litGroup,
  litPool,
  poolOffsets,
  poolText,
  adjGid,
  adjStart,
  adjTgt,
  patGid,
  patTgt,
  postfixLookupGroups,
  orderSensitiveModifiers:
    "* ** after backdrop before details-content file first-letter first-line marker placeholder selection",
};
//#endregion
//#region ../../node_modules/.pnpm/cn@0.4.0/node_modules/cn/dist/engine.js
var IS_JSC = "line" in /* @__PURE__ */ new Error();
var EXTERNAL = -1;
var DEAD = -1;
var fnv = (str, s, e) => {
  let h = 2166136261;
  for (let p = s; p < e; p++) h = Math.imul(h ^ str.charCodeAt(p), 16777619);
  return h;
};
var spanHash = (str, s, e) => {
  const len = e - s;
  let h = Math.imul(len, 2654435761) ^ str.charCodeAt(s);
  if (len > 3) {
    const q = len >> 2;
    const m = len >> 1;
    h = Math.imul(
      h ^ (str.charCodeAt(s + 1) << 8) ^ (str.charCodeAt(s + 2) << 16) ^ str.charCodeAt(s + q),
      2246822507,
    );
    h = Math.imul(
      h ^ (str.charCodeAt(s + m) << 8) ^ (str.charCodeAt(s + m + q) << 16) ^ str.charCodeAt(e - 3),
      3266489909,
    );
    h ^= (str.charCodeAt(e - 2) << 8) ^ (str.charCodeAt(e - 1) << 16);
    for (let p = s + 3, q = e - 4; p < s + 8 && p < q; p++, q--)
      h = Math.imul(h ^ str.charCodeAt(p) ^ (str.charCodeAt(q) << 8), 16777619);
  }
  return (h ^ (h >>> 15)) | 0;
};
var createEngine = (T, validatorImpls, options = {}) => {
  const {
    GROUP_COUNT,
    edgeStart,
    labelStart,
    labelText,
    edgeTarget,
    nodeGroup,
    nodeVlist,
    vlistPat,
    vlistOps,
    vlistRef,
    vlistGroup,
    litAnchor,
    litGroup,
    litPool,
    poolOffsets,
    poolText,
    adjGid,
    adjStart,
    adjTgt,
    patGid,
    patTgt,
    postfixLookupGroups,
    customValidatorNames,
    orderSensitiveModifiers,
  } = T;
  const adjRow = new Int32Array(GROUP_COUNT).fill(-1);
  for (let i = 0; i < adjGid.length; i++) adjRow[adjGid[i]] = i;
  let maxAdj = 0;
  for (let r = 0; r + 1 < adjStart.length; r++) {
    const n = adjStart[r + 1] - adjStart[r];
    if (n > maxAdj) maxAdj = n;
  }
  let CLAIM_PER_TOKEN = 32;
  while (CLAIM_PER_TOKEN < 2 * (1 + maxAdj + patGid.length)) CLAIM_PER_TOKEN <<= 1;
  const vgStart = new Int32Array(vlistRef.length + 1);
  for (let l = 0; l < vlistRef.length; l++)
    vgStart[l + 1] = vgStart[l] + vlistPat[vlistRef[l] + 1] - vlistPat[vlistRef[l]];
  const postfixLookupSet = new Uint8Array(GROUP_COUNT);
  for (let i = 0; i < postfixLookupGroups.length; i++) postfixLookupSet[postfixLookupGroups[i]] = 1;
  const nodeCount = edgeStart.length - 1;
  const nodeHasLit = new Uint8Array(nodeCount);
  let litMaxLen = 0;
  let litNoArb = true;
  for (let i = 0; i < litAnchor.length; i++) {
    nodeHasLit[litAnchor[i]] = 1;
    const len = poolOffsets[litPool[i] * 2 + 1];
    if (len > litMaxLen) litMaxLen = len;
    const c0 = poolText.charCodeAt(poolOffsets[litPool[i] * 2]);
    if (c0 === 91 || c0 === 40) litNoArb = false;
  }
  let LIT_SIZE = 1;
  while (LIT_SIZE < litAnchor.length * 2) LIT_SIZE <<= 1;
  const litTable = new Int32Array(LIT_SIZE).fill(-1);
  for (let i = 0; i < litAnchor.length; i++) {
    const off = poolOffsets[litPool[i] * 2];
    let idx =
      ((fnv(poolText, off, off + poolOffsets[litPool[i] * 2 + 1]) ^
        Math.imul(litAnchor[i], 2654435761)) |
        0) &
      (LIT_SIZE - 1);
    while (litTable[idx] !== -1) idx = (idx + 1) & (LIT_SIZE - 1);
    litTable[idx] = i;
  }
  const litProbe = (anchor, input, s, e) => {
    let idx = ((fnv(input, s, e) ^ Math.imul(anchor, 2654435761)) | 0) & (LIT_SIZE - 1);
    const len = e - s;
    for (;;) {
      const entry = litTable[idx];
      if (entry === -1) return -1;
      if (litAnchor[entry] === anchor && poolOffsets[litPool[entry] * 2 + 1] === len) {
        const off = poolOffsets[litPool[entry] * 2];
        let ok = true;
        for (let k = 0; k < len; k++)
          if (poolText.charCodeAt(off + k) !== input.charCodeAt(s + k)) {
            ok = false;
            break;
          }
        if (ok) return litGroup[entry];
      }
      idx = (idx + 1) & (LIT_SIZE - 1);
    }
  };
  const cacheSize = options.cacheSize ?? 8192;
  const RAW_PREFIX = options.prefix ?? T.prefix ?? "";
  const FULL_PREFIX = RAW_PREFIX === "" ? "" : RAW_PREFIX + ":";
  const FPL = FULL_PREFIX.length;
  const vCustom = (customValidatorNames ?? []).map((name) => {
    const fn = validatorImpls && validatorImpls[name];
    if (!fn) throw new Error("cn: missing validator " + name);
    return fn;
  });
  const lengthUnitRegex =
    /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
  const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/;
  const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
  const imageRegex =
    /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;
  let aKind = 0;
  let aLabelS = -1;
  let aLabelE = -1;
  let aValS = -1;
  let aValE = -1;
  const isWordCode = (c) =>
    (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57) || c === 95;
  const isUniWS = (c) => /\s/.test(String.fromCharCode(c));
  const analyzeArb = (input, s, e) => {
    aKind = 0;
    aLabelS = -1;
    if (e - s < 3) return;
    const c0 = input.charCodeAt(s);
    const cl = input.charCodeAt(e - 1);
    if (c0 === 91 && cl === 93) aKind = 1;
    else if (c0 === 40 && cl === 41) aKind = 2;
    else return;
    aValS = s + 1;
    aValE = e - 1;
    let p = s + 1;
    if (isWordCode(input.charCodeAt(p))) {
      p++;
      while (p < e - 1) {
        const c = input.charCodeAt(p);
        if (!isWordCode(c) && c !== 45) break;
        p++;
      }
      if (p < e - 2 && input.charCodeAt(p) === 58) {
        aLabelS = s + 1;
        aLabelE = p;
        aValS = p + 1;
      }
    }
  };
  const spanEq = (input, s, e, str) => {
    if (e - s !== str.length) return false;
    for (let i = 0; i < str.length; i++)
      if (input.charCodeAt(s + i) !== str.charCodeAt(i)) return false;
    return true;
  };
  const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
  const tshirtRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
  const isNumStr = (v) => !!v && !Number.isNaN(Number(v));
  const spanIsNamedContainerQuery = (input, s, e) => {
    if (e - s < 11 || !spanEq(input, s, s + 10, "@container")) return false;
    if (input.charCodeAt(s + 10) === 47) return e - s >= 12;
    const c11 = input.charCodeAt(s + 11);
    return (
      (c11 === 115 && e - s >= 17 && spanEq(input, s + 10, s + 16, "-size/")) ||
      (c11 === 110 && e - s >= 19 && spanEq(input, s + 10, s + 18, "-normal/"))
    );
  };
  const VKIND = [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2];
  const VLABELS =
    "length|number|number weight|family-name|position percentage|length size bg-size|image url|shadow|length|family-name|position percentage|length size bg-size|image url|shadow|number weight"
      .split("|")
      .map((s) => s.split(" "));
  const VFALL = [2, 3, 1, 0, 0, 0, 4, 5, 0, 0, 0, 0, 0, 1, 1];
  const runValidator = (op, input, s, e) => {
    if (op >= 10) {
      if (op >= 25) return vCustom[op - 25](input.slice(s, e));
      const i = op - 10;
      if (aKind !== VKIND[i]) return false;
      if (aLabelS >= 0) {
        for (const L of VLABELS[i]) if (spanEq(input, aLabelS, aLabelE, L)) return true;
        return false;
      }
      switch (VFALL[i]) {
        case 0:
          return false;
        case 1:
          return true;
        case 2: {
          const v = input.slice(aValS, aValE);
          return lengthUnitRegex.test(v) && !colorFunctionRegex.test(v);
        }
        case 3:
          return isNumStr(input.slice(aValS, aValE));
        case 4:
          return imageRegex.test(input.slice(aValS, aValE));
        default:
          return shadowRegex.test(input.slice(aValS, aValE));
      }
    }
    switch (op) {
      case 0:
        return true;
      case 1:
        return aKind === 0;
      case 2:
        return aKind === 1;
      case 3:
        return aKind === 2;
      case 4:
        return fractionRegex.test(input.slice(s, e));
      case 5:
        return isNumStr(input.slice(s, e));
      case 6: {
        const v = input.slice(s, e);
        return !!v && Number.isInteger(Number(v));
      }
      case 7:
        return e > s && input.charCodeAt(e - 1) === 37 && isNumStr(input.slice(s, e - 1));
      case 8:
        return tshirtRegex.test(input.slice(s, e));
      default:
        return spanIsNamedContainerQuery(input, s, e);
    }
  };
  const orderSensitive = new Set(
    typeof orderSensitiveModifiers === "string"
      ? orderSensitiveModifiers.split(" ")
      : orderSensitiveModifiers,
  );
  const internSpan = (map, input, s, e, imp, make) => {
    const h = (fnv(input, s, e) ^ (imp ? 2654435769 : 0)) | 0;
    let bucket = map.get(h);
    if (bucket !== void 0)
      outer: for (let b = 0; b < bucket.length; b++) {
        const en = bucket[b];
        if (en.imp !== imp || en.k.length !== e - s) continue;
        for (let i = 0; i < en.k.length; i++)
          if (en.k.charCodeAt(i) !== input.charCodeAt(s + i)) continue outer;
        return en.id;
      }
    else map.set(h, (bucket = []));
    const k = input.slice(s, e);
    const id = make(k);
    bucket.push({
      k,
      imp,
      id,
    });
    return id;
  };
  let ctxByHash = /* @__PURE__ */ new Map();
  let ctxByCanon = /* @__PURE__ */ new Map();
  let nextCtxId = 2;
  const MAX_CTX = 4096;
  const canonicalizeContext = (raw, important) => {
    const mods = [];
    let dB = 0,
      dP = 0,
      start = 0;
    for (let i = 0; i < raw.length; i++) {
      const c = raw.charCodeAt(i);
      if (dB === 0 && dP === 0 && c === 58) {
        mods.push(raw.slice(start, i));
        start = i + 1;
      } else if (c === 91) dB++;
      else if (c === 93) dB--;
      else if (c === 40) dP++;
      else if (c === 41) dP--;
    }
    mods.push(raw.slice(start));
    let canonical = mods[0];
    if (mods.length > 1) {
      const result = [];
      let segment = [];
      for (const mod of mods)
        if (mod.charCodeAt(0) === 91 || orderSensitive.has(mod)) {
          if (segment.length) {
            result.push(...segment.sort());
            segment = [];
          }
          result.push(mod);
        } else segment.push(mod);
      if (segment.length) result.push(...segment.sort());
      canonical = result.join(":");
    }
    const key = important ? canonical + " !" : canonical;
    let id = ctxByCanon.get(key);
    if (id === void 0) ctxByCanon.set(key, (id = nextCtxId++));
    return id;
  };
  let dynByHash = /* @__PURE__ */ new Map();
  let nextDynId = GROUP_COUNT;
  const MAX_DYN = GROUP_COUNT + 4096;
  const newDynId = () => nextDynId++;
  const ID_LIMIT = 2097152;
  const TOKEN_TABLE = 8192;
  const memoHash = new Int32Array(TOKEN_TABLE);
  const memoStr = new Array(TOKEN_TABLE).fill(null);
  const memoGid = new Int32Array(TOKEN_TABLE);
  const memoCtx = new Int32Array(TOKEN_TABLE);
  const memoFlags = new Uint8Array(TOKEN_TABLE);
  let memoTick = 0;
  const memoPut = (way0, input, ts, te, h, gid, ctxId, flags) => {
    let slot = way0;
    if (memoStr[way0] !== null) {
      if (memoStr[way0 | 1] === null) slot = way0 | 1;
      else if ((memoTick++ & 3) === 0) slot = way0 | ((memoTick >> 2) & 1);
      else return;
    }
    memoStr[slot] = input.slice(ts, te);
    memoHash[slot] = h;
    memoGid[slot] = gid;
    memoCtx[slot] = ctxId;
    memoFlags[slot] = flags;
  };
  const memoReset = () => memoStr.fill(null);
  let cap = 256;
  let tokI32 = [new Int32Array(cap), new Int32Array(cap), new Int32Array(cap), new Int32Array(cap)];
  let [tokStart, tokEnd, tokGid, tokCtx] = tokI32;
  let tokFlags = new Uint8Array(cap);
  let keep = new Uint8Array(cap);
  const growTokens = () => {
    cap *= 2;
    tokI32 = tokI32.map((a) => {
      const n = new Int32Array(cap);
      n.set(a);
      return n;
    });
    [tokStart, tokEnd, tokGid, tokCtx] = tokI32;
    const nf = new Uint8Array(cap);
    nf.set(tokFlags);
    tokFlags = nf;
    keep = new Uint8Array(cap);
  };
  let ckptCap = 64;
  let ckptNode = new Int32Array(ckptCap);
  let ckptTail = new Int32Array(ckptCap);
  const claim0 = new Int32Array(GROUP_COUNT);
  let CLAIM_TABLE = 2048;
  let claimShift = 21;
  let claimKeys = new Float64Array(CLAIM_TABLE);
  let claimEpochs = new Int32Array(CLAIM_TABLE);
  let epoch = 0;
  const claimTest = (ctx, gid) => {
    if (ctx === 0 && gid < GROUP_COUNT) {
      if (claim0[gid] === epoch) return 1;
      claim0[gid] = epoch;
      return 0;
    }
    const key = ctx * 2097152 + gid + 1;
    let idx = Math.imul(key, 2654435761) >>> claimShift;
    for (;;) {
      if (claimEpochs[idx] !== epoch) break;
      if (claimKeys[idx] === key) return 1;
      idx = (idx + 1) & (CLAIM_TABLE - 1);
    }
    claimKeys[idx] = key;
    claimEpochs[idx] = epoch;
    return 0;
  };
  const resolveAt = (input, bs, endPos, nodeAt, ckptAt) => {
    if (endPos - bs >= 2 && input.charCodeAt(bs) === 91 && input.charCodeAt(endPos - 1) === 93) {
      let colon = -1;
      for (let p = bs + 1; p < endPos - 1; p++)
        if (input.charCodeAt(p) === 58) {
          colon = p;
          break;
        }
      if (colon === -1 || colon === bs + 1) return EXTERNAL;
      return internSpan(dynByHash, input, bs + 1, colon, 0, newDynId);
    }
    if (nodeAt >= 0 && nodeGroup[nodeAt] >= 0) return nodeGroup[nodeAt];
    for (let k = ckptAt - 1; k >= 0; k--) {
      const tailStart = ckptTail[k];
      if (tailStart > endPos) continue;
      const nodeId = ckptNode[k];
      const tlen = endPos - tailStart;
      if (nodeHasLit[nodeId] === 1 && tlen > 0 && tlen <= litMaxLen) {
        const c0 = input.charCodeAt(tailStart);
        if (litNoArb === false || (c0 !== 91 && c0 !== 40)) {
          const g = litProbe(nodeId, input, tailStart, endPos);
          if (g >= 0) return g;
        }
      }
      const vl = nodeVlist[nodeId];
      if (vl < 0) continue;
      const pat = vlistRef[vl];
      const vs = vlistPat[pat];
      const ve = vlistPat[pat + 1];
      if (vs === ve) continue;
      analyzeArb(input, tailStart, endPos);
      const g0 = vgStart[vl] - vs;
      for (let v = vs; v < ve; v++)
        if (runValidator(vlistOps[v], input, tailStart, endPos)) return vlistGroup[g0 + v];
    }
    return EXTERNAL;
  };
  const mergeClassList = (input) => {
    const n = input.length;
    let tokenCount = 0;
    let totalTokenChars = 0;
    let sawNonSpaceWS = false;
    if (nextCtxId > MAX_CTX || ctxByHash.size > MAX_CTX) {
      ctxByHash = /* @__PURE__ */ new Map();
      ctxByCanon = /* @__PURE__ */ new Map();
      nextCtxId = 2;
      memoReset();
    }
    if (nextDynId > MAX_DYN) {
      dynByHash = /* @__PURE__ */ new Map();
      nextDynId = GROUP_COUNT;
      memoReset();
    }
    let i = 0;
    while (i < n) {
      let c = input.charCodeAt(i);
      if (c === 32 || (c >= 9 && c <= 13) || (c >= 160 && isUniWS(c))) {
        if (c !== 32) sawNonSpaceWS = true;
        i++;
        continue;
      }
      const ts = i;
      let th = 0;
      while (i < n) {
        c = input.charCodeAt(i);
        if (c <= 32) {
          if (c === 32) break;
          if (c >= 9 && c <= 13) {
            sawNonSpaceWS = true;
            break;
          }
        } else if (c >= 160 && isUniWS(c)) {
          sawNonSpaceWS = true;
          break;
        }
        th = Math.imul(th ^ c, 16777619);
        i++;
      }
      const te = i;
      const len = te - ts;
      if (tokenCount === cap) growTokens();
      const t = tokenCount++;
      tokStart[t] = ts;
      tokEnd[t] = te;
      totalTokenChars += len;
      th ^= Math.imul(len, 2654435761);
      const h = (th ^ (th >>> 15)) | 0;
      const way0 = h & 8190;
      {
        let hitAt = -1;
        if (memoHash[way0] === h && memoStr[way0] !== null && memoStr[way0].length === len)
          hitAt = way0;
        else if (
          memoHash[way0 | 1] === h &&
          memoStr[way0 | 1] !== null &&
          memoStr[way0 | 1].length === len
        )
          hitAt = way0 | 1;
        if (hitAt >= 0) {
          const s = memoStr[hitAt];
          let ok = true;
          for (let k = 0; k < len; k++)
            if (s.charCodeAt(k) !== input.charCodeAt(ts + k)) {
              ok = false;
              break;
            }
          if (ok) {
            tokGid[t] = memoGid[hitAt];
            tokCtx[t] = memoCtx[hitAt];
            tokFlags[t] = memoFlags[hitAt];
            continue;
          }
        }
      }
      let pts = ts;
      if (FPL !== 0) {
        if (te - ts <= FPL || !input.startsWith(FULL_PREFIX, ts)) {
          tokGid[t] = EXTERNAL;
          memoPut(way0, input, ts, te, h, EXTERNAL, 0, 0);
          continue;
        }
        pts = ts + FPL;
      }
      let depthB = 0,
        depthP = 0;
      let lastColon = -1,
        lastSlash = -1;
      for (let p = pts; p < te; p++) {
        const pc = input.charCodeAt(p);
        if (depthB === 0 && depthP === 0) {
          if (pc === 58) {
            lastColon = p;
            continue;
          }
          if (pc === 47) {
            lastSlash = p;
            continue;
          }
        }
        if (pc === 91) depthB++;
        else if (pc === 93) depthB--;
        else if (pc === 40) depthP++;
        else if (pc === 41) depthP--;
      }
      const modStart = lastColon >= pts ? lastColon + 1 : pts;
      let bs = modStart;
      let be = te;
      let important = false;
      let prefixShift = 0;
      if (be > bs && input.charCodeAt(be - 1) === 33) {
        important = true;
        be--;
      } else if (be > bs && input.charCodeAt(bs) === 33) {
        important = true;
        bs++;
        prefixShift = 1;
      }
      let postfixEnd = -1;
      if (lastSlash > modStart) {
        postfixEnd = lastSlash + prefixShift;
        if (postfixEnd >= be) postfixEnd = -1;
      }
      let feedStart = bs;
      if (be - bs > 1 && input.charCodeAt(bs) === 45) feedStart = bs + 1;
      let node = 0;
      let lp = 0;
      let le = 0;
      let pending = -1;
      let ckptTop = 0;
      if (nodeVlist[0] >= 0 || nodeHasLit[0] === 1) {
        ckptNode[0] = 0;
        ckptTail[0] = feedStart;
        ckptTop = 1;
      }
      let slashNode = DEAD;
      let slashCkpt = 0;
      for (let p = feedStart; p < be; p++) {
        if (p === postfixEnd) {
          slashNode = lp < le ? DEAD : node;
          slashCkpt = ckptTop;
        }
        if (node !== DEAD) {
          const cc = input.charCodeAt(p);
          let arrived = -1;
          if (lp < le) {
            if (labelText.charCodeAt(lp) === cc) {
              lp++;
              if (lp === le) arrived = node = pending;
            } else node = DEAD;
          } else {
            const es = edgeStart[node];
            const ee = edgeStart[node + 1];
            let next = DEAD;
            for (let e = es; e < ee; e++) {
              const ls = labelStart[e];
              if (labelText.charCodeAt(ls) === cc) {
                if (labelStart[e + 1] - ls === 1) arrived = next = edgeTarget[e];
                else {
                  lp = ls + 1;
                  le = labelStart[e + 1];
                  pending = edgeTarget[e];
                  next = node;
                }
                break;
              }
            }
            node = next;
          }
          if (
            arrived >= 0 &&
            (nodeVlist[arrived] >= 0 || nodeHasLit[arrived] === 1) &&
            p + 1 < be &&
            input.charCodeAt(p + 1) === 45
          ) {
            if (ckptTop === ckptCap) {
              ckptCap *= 2;
              const nv = new Int32Array(ckptCap);
              nv.set(ckptNode);
              ckptNode = nv;
              const nt = new Int32Array(ckptCap);
              nt.set(ckptTail);
              ckptTail = nt;
            }
            ckptNode[ckptTop] = arrived;
            ckptTail[ckptTop] = p + 2;
            ckptTop++;
          }
        }
      }
      if (postfixEnd === be) {
        slashNode = lp < le ? DEAD : node;
        slashCkpt = ckptTop;
      }
      const endNode = lp < le ? DEAD : node;
      let gid;
      let hasPostfix = false;
      if (postfixEnd >= 0) {
        hasPostfix = true;
        gid = resolveAt(input, bs, postfixEnd, slashNode, slashCkpt);
        if (gid !== EXTERNAL && gid < GROUP_COUNT && postfixLookupSet[gid]) {
          const gidFull = resolveAt(input, bs, be, endNode, ckptTop);
          if (gidFull !== EXTERNAL && gidFull !== gid) {
            gid = gidFull;
            hasPostfix = false;
          }
        } else if (gid === EXTERNAL) {
          gid = resolveAt(input, bs, be, endNode, ckptTop);
          hasPostfix = false;
        }
      } else gid = resolveAt(input, bs, be, endNode, ckptTop);
      let ctxId = 0;
      let flags = 0;
      if (gid === EXTERNAL) tokGid[t] = EXTERNAL;
      else {
        flags = hasPostfix ? 1 : 0;
        ctxId =
          pts >= lastColon
            ? important
              ? 1
              : 0
            : internSpan(ctxByHash, input, pts, lastColon, important ? 1 : 0, (k) =>
                canonicalizeContext(k, important),
              );
        tokGid[t] = gid;
        tokFlags[t] = flags;
        tokCtx[t] = ctxId;
      }
      memoPut(way0, input, ts, te, h, gid, ctxId, flags);
    }
    if (tokenCount === 0) return "";
    if (tokenCount === 1)
      return tokStart[0] === 0 && tokEnd[0] === n ? input : input.slice(tokStart[0], tokEnd[0]);
    if (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
      while (tokenCount * CLAIM_PER_TOKEN > CLAIM_TABLE) {
        CLAIM_TABLE <<= 1;
        claimShift--;
      }
      claimKeys = new Float64Array(CLAIM_TABLE);
      claimEpochs = new Int32Array(CLAIM_TABLE);
    }
    if (nextCtxId >= ID_LIMIT || nextDynId >= ID_LIMIT)
      throw new Error("cn: too many distinct classes in one merge");
    epoch = (epoch + 1) | 0;
    if (epoch === 0) {
      claim0.fill(0);
      claimEpochs.fill(0);
      epoch = 1;
    }
    let didDrop = false;
    for (let t = tokenCount - 1; t >= 0; t--) {
      const gid = tokGid[t];
      if (gid === EXTERNAL) {
        keep[t] = 1;
        continue;
      }
      const ctxId = tokCtx[t];
      if (claimTest(ctxId, gid) === 1) {
        keep[t] = 0;
        didDrop = true;
        continue;
      }
      keep[t] = 1;
      if (gid < GROUP_COUNT) {
        const r = adjRow[gid];
        if (r >= 0) for (let k = adjStart[r]; k < adjStart[r + 1]; k++) claimTest(ctxId, adjTgt[k]);
        if (tokFlags[t] & 1) {
          for (let k = 0; k < patGid.length; k++)
            if (patGid[k] === gid) claimTest(ctxId, patTgt[k]);
        }
      }
    }
    if (!didDrop && !sawNonSpaceWS && n === totalTokenChars + tokenCount - 1) return input;
    let out = "";
    let t = 0;
    while (t < tokenCount) {
      if (!keep[t]) {
        t++;
        continue;
      }
      const runStart = tokStart[t];
      let runEnd = tokEnd[t];
      let u = t + 1;
      while (
        u < tokenCount &&
        keep[u] &&
        tokStart[u] === runEnd + 1 &&
        input.charCodeAt(runEnd) === 32
      ) {
        runEnd = tokEnd[u];
        u++;
      }
      if (out.length > 0) out += " ";
      out += input.slice(runStart, runEnd);
      t = u;
    }
    return out;
  };
  const DOOR_SIZE = 16384;
  const door = new Int32Array(DOOR_SIZE * 2);
  let doorBase = 0;
  let doorEpoch = 1;
  let cache = Object.create(null);
  let prevCache = Object.create(null);
  let cacheMap = /* @__PURE__ */ new Map();
  let prevCacheMap = /* @__PURE__ */ new Map();
  let cacheCount = 0;
  let doorMarks = 0;
  const rotateDoor = () => {
    doorBase ^= DOOR_SIZE;
    doorEpoch = (doorEpoch + 1) | 0;
    doorMarks = 0;
  };
  const mergeCached = (input) => {
    let merged = cache[input];
    if (merged !== void 0) return merged;
    const hash = spanHash(input, 0, input.length);
    const slot = (hash & 16383) + doorBase;
    const wasSeen =
      door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ (doorEpoch - 1));
    if (wasSeen) {
      merged = prevCache[input];
      if (merged !== void 0) {
        cache[input] = merged;
        return merged;
      }
    }
    merged = mergeClassList(input);
    if (wasSeen) {
      cache[input] = merged;
      if (++cacheCount > cacheSize) {
        cacheCount = 0;
        prevCache = cache;
        cache = Object.create(null);
        rotateDoor();
      }
    } else {
      door[slot] = hash ^ doorEpoch;
      if (++doorMarks > DOOR_SIZE) rotateDoor();
    }
    return merged;
  };
  const mergeCachedMap = (input) => {
    let merged = cacheMap.get(input);
    if (merged !== void 0) return merged;
    const hash = spanHash(input, 0, input.length);
    const slot = (hash & 16383) + doorBase;
    const wasSeen =
      door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ (doorEpoch - 1));
    if (wasSeen) {
      merged = prevCacheMap.get(input);
      if (merged !== void 0) {
        cacheMap.set(input, merged);
        return merged;
      }
    }
    merged = mergeClassList(input);
    if (wasSeen) {
      cacheMap.set(input, merged);
      if (++cacheCount > cacheSize) {
        cacheCount = 0;
        prevCacheMap = cacheMap;
        cacheMap = /* @__PURE__ */ new Map();
        rotateDoor();
      }
    } else {
      door[slot] = hash ^ doorEpoch;
      if (++doorMarks > DOOR_SIZE) rotateDoor();
    }
    return merged;
  };
  const seenBefore = (input) => {
    const hash = spanHash(input, 0, input.length);
    const slot = (hash & 16383) + doorBase;
    if (door[slot] === (hash ^ doorEpoch) || door[slot ^ DOOR_SIZE] === (hash ^ (doorEpoch - 1)))
      return true;
    door[slot] = hash ^ doorEpoch;
    if (++doorMarks > DOOR_SIZE) rotateDoor();
    return false;
  };
  const mergeString =
    cacheSize === 0
      ? mergeClassList
      : IS_JSC
        ? (input) => {
            const merged = cacheMap.get(input);
            return merged !== void 0 ? merged : mergeCachedMap(input);
          }
        : mergeCached;
  const merge = function () {
    return arguments.length === 1 && typeof arguments[0] === "string"
      ? mergeString(arguments[0])
      : mergeString(twJoin.apply(null, arguments));
  };
  return {
    merge,
    mergeString,
    seenBefore: cacheSize === 0 ? () => false : seenBefore,
    mergeUncached: mergeClassList,
  };
};
var resolveValue = (v, clsxMode) => {
  if (!v) return "";
  if (typeof v === "string") return v;
  let out = "";
  if (typeof v.length === "number" && (clsxMode ? Array.isArray(v) : true)) {
    const arr = v;
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (!item) continue;
      const r = typeof item === "string" ? item : resolveValue(item, clsxMode);
      if (r) {
        if (out) out += " ";
        out += r;
      }
    }
    return out;
  }
  if (clsxMode) {
    if (typeof v === "number") return "" + v;
    if (typeof v === "object") {
      for (const k in v)
        if (v[k]) {
          if (out) out += " ";
          out += k;
        }
    }
  }
  return out;
};
var joinArgs = (args, clsxMode) => {
  let s = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a) continue;
    const r = typeof a === "string" ? a : resolveValue(a, clsxMode);
    if (r) {
      if (s) s += " ";
      s += r;
    }
  }
  return s;
};
/** join-only, `twJoin`-compatible (strings + nested arrays, falsy skipped) */
var twJoin = function () {
  return joinArgs(arguments, false);
};
var BUCKET_CAP = 256;
var BUCKET_MISS_CAP = 16;
var BUCKET_SKIP = 1024;
var CHURN_SIZE = 4096;
var wrapClsx = (mergeString, fresh) => {
  const seenBefore = fresh === void 0 ? () => true : fresh.seenBefore;
  const mergeUncached = fresh === void 0 ? mergeString : fresh.mergeUncached;
  let argCache = /* @__PURE__ */ new Map();
  let prevArgCache = /* @__PURE__ */ new Map();
  let argCount = 0;
  let lastHit = null;
  let churnKey = null;
  let churnOwn = [];
  let churnVal = [];
  let churnTick = 0;
  const churnLookup = (key, own, join) => {
    if (churnKey === null) {
      churnKey = new Array(CHURN_SIZE).fill("");
      churnOwn = new Array(CHURN_SIZE).fill("");
      churnVal = new Array(CHURN_SIZE).fill("");
    }
    const way0 = spanHash(key, 0, key.length) & 4094;
    if (churnKey[way0] === key && churnOwn[way0] === own) return churnVal[way0];
    if (churnKey[way0 | 1] === key && churnOwn[way0 | 1] === own) return churnVal[way0 | 1];
    const merged = mergeString(join ? own + " " + key : key);
    const slot =
      churnKey[way0] === "" ? way0 : way0 | (churnKey[way0 | 1] === "" ? 1 : churnTick++ & 1);
    churnKey[slot] = key;
    churnOwn[slot] = own;
    churnVal[slot] = merged;
    return merged;
  };
  const match3 = (e, v0, v1, v2) => {
    let k = 0;
    if (v0) {
      if (v0 !== e.a0) return false;
      k = 1;
    }
    if (v1) {
      if (v1 !== (k === 0 ? e.a0 : e.a1)) return false;
      k++;
    }
    if (v2) {
      if (v2 !== (k === 0 ? e.a0 : k === 1 ? e.a1 : e.a2)) return false;
      k++;
    }
    return k === e.t;
  };
  const matchN = (e, vals) => {
    const ea = e.a;
    let k = 0;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (!v) continue;
      if (v !== ea[k]) return false;
      k++;
    }
    return k === e.t;
  };
  const resolveArgs = (vals, probed) => {
    const nArgs = vals.length;
    const pred = lastHit === null ? null : lastHit.n;
    if (!probed) {
      if (pred !== null && matchN(pred, vals)) {
        lastHit = pred;
        return pred.r;
      }
      if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals)) return lastHit.r;
    }
    let first = "";
    let firstIdx = -1;
    let truthy = 0;
    let hasResolvedValue = false;
    for (let i = 0; i < nArgs; i++) {
      let v = vals[i];
      if (!v) continue;
      if (typeof v !== "string") {
        v = vals[i] = resolveValue(v, true);
        if (!v) continue;
        hasResolvedValue = true;
      }
      if (firstIdx < 0) {
        first = v;
        firstIdx = i;
      }
      truthy++;
    }
    if (truthy === 0) return "";
    if (truthy === 1) return mergeString(first);
    if (hasResolvedValue) {
      if (pred !== null && matchN(pred, vals)) {
        lastHit = pred;
        return pred.r;
      }
      if (lastHit !== null && lastHit !== pred && matchN(lastHit, vals)) return lastHit.r;
    }
    let bucket = argCache.get(first);
    if (bucket === void 0) {
      bucket = prevArgCache.get(first);
      if (bucket !== void 0) argCache.set(first, bucket);
    }
    let hit = null;
    if (bucket !== void 0) {
      if (bucket.skip > 0) {
        bucket.skip--;
        lastHit = null;
        let joined = first;
        for (let i = firstIdx + 1; i < nArgs; i++) {
          const v = vals[i];
          if (v) joined += " " + v;
        }
        return churnLookup(joined, "", false);
      }
      const entries = bucket.e;
      outer: for (let b = 0; b < entries.length; b++) {
        const e = entries[b];
        if (e.t !== truthy) continue;
        const ea = e.a;
        let k = 1;
        for (let i = firstIdx + 1; i < nArgs; i++) {
          const v = vals[i];
          if (v && v !== ea[k++]) continue outer;
        }
        hit = e;
        break;
      }
      if (hit !== null) bucket.miss = 0;
    }
    if (hit === null) {
      let joined = first;
      const a = [first];
      for (let i = firstIdx + 1; i < nArgs; i++) {
        const v = vals[i];
        if (!v) continue;
        joined += " " + v;
        a.push(v);
      }
      if (!seenBefore(joined)) return mergeUncached(joined);
      hit = {
        r: mergeString(joined),
        t: a.length,
        a0: a[0],
        a1: a[1],
        a2: a[2] ?? "",
        a,
        n: null,
      };
      if (bucket === void 0)
        argCache.set(
          first,
          (bucket = {
            e: [],
            miss: 0,
            skip: 0,
            at: 0,
          }),
        );
      else if (++bucket.miss > BUCKET_MISS_CAP) {
        bucket.miss = BUCKET_MISS_CAP;
        bucket.skip = BUCKET_SKIP;
        bucket.e.length = 0;
        bucket.at = 0;
      }
      const entries = bucket.e;
      if (entries.length < BUCKET_CAP) entries.push(hit);
      else {
        entries[bucket.at] = hit;
        bucket.at = (bucket.at + 1) & 255;
      }
      if (++argCount > 1e3) {
        argCount = 0;
        prevArgCache = argCache;
        argCache = /* @__PURE__ */ new Map();
      }
    }
    if (lastHit !== null && lastHit !== hit) lastHit.n = hit;
    lastHit = hit;
    return hit.r;
  };
  const mergeSingleValue = (value) =>
    Array.isArray(value)
      ? resolveArgs(value.slice(), false)
      : mergeString(resolveValue(value, true));
  return function (v0, v1, v2) {
    const nArgs = arguments.length;
    if ((nArgs | 1) === 3) {
      const lh = lastHit;
      if (lh !== null) {
        const pred = lh.n;
        if (pred !== null && match3(pred, v0, v1, v2)) {
          lastHit = pred;
          return pred.r;
        }
        if (lh !== pred && match3(lh, v0, v1, v2)) return lh.r;
      }
      if (nArgs === 2 && typeof v1 === "string" && v1 !== "") {
        const bucket = argCache.get(v0);
        if (bucket !== void 0 && bucket.skip > 0) {
          bucket.skip--;
          lastHit = null;
          return churnLookup(v1, v0, true);
        }
      }
      return resolveArgs([v0, v1, v2], true);
    }
    if (nArgs === 1) return typeof v0 === "string" ? mergeString(v0) : mergeSingleValue(v0);
    const lh = lastHit;
    if (lh !== null) {
      const pred = lh.n;
      if (pred !== null) {
        const pa = pred.a;
        let k = 0;
        let ok = true;
        for (let i = 0; i < nArgs; i++) {
          const v = arguments[i];
          if (!v) continue;
          if (v !== pa[k]) {
            ok = false;
            break;
          }
          k++;
        }
        if (ok && k === pred.t) {
          lastHit = pred;
          return pred.r;
        }
      }
      if (lh !== pred) {
        const la = lh.a;
        let k = 0;
        let ok = true;
        for (let i = 0; i < nArgs; i++) {
          const v = arguments[i];
          if (!v) continue;
          if (v !== la[k]) {
            ok = false;
            break;
          }
          k++;
        }
        if (ok && k === lh.t) return lh.r;
      }
    }
    const vals = [];
    for (let i = 0; i < nArgs; i++) vals.push(arguments[i]);
    return resolveArgs(vals, true);
  };
};
//#endregion
//#region ../../node_modules/.pnpm/cn@0.4.0/node_modules/cn/dist/index.js
var instance = /* @__PURE__ */ createEngine(tables_generated_default);
/**
 * Merge Tailwind CSS classes with clsx-style arguments (strings, arrays,
 * objects, conditionals). Drop-in replacement for `twMerge(clsx(...))`.
 */
var cn = /* @__PURE__ */ wrapClsx(instance.mergeString, instance);
instance.merge;
//#endregion
//#region ../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
function r(e) {
  var t,
    f,
    n = "";
  if ("string" == typeof e || "number" == typeof e) n += e;
  else if ("object" == typeof e)
    if (Array.isArray(e)) {
      var o = e.length;
      for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), (n += f));
    } else for (f in e) e[f] && (n && (n += " "), (n += f));
  return n;
}
function clsx() {
  for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++)
    (e = arguments[f]) && (t = r(e)) && (n && (n += " "), (n += t));
  return n;
}
//#endregion
//#region ../../node_modules/.pnpm/class-variance-authority@0.7.1/node_modules/class-variance-authority/dist/index.mjs
/**
 * Copyright 2022 Joe Bell. All rights reserved.
 *
 * This file is licensed to you under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with the
 * License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR REPRESENTATIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */ var falsyToString = (value) =>
  typeof value === "boolean" ? `${value}` : value === 0 ? "0" : value;
var cx = clsx;
var cva = (base, config) => (props) => {
  var _config_compoundVariants;
  if ((config === null || config === void 0 ? void 0 : config.variants) == null)
    return cx(
      base,
      props === null || props === void 0 ? void 0 : props.class,
      props === null || props === void 0 ? void 0 : props.className,
    );
  const { variants, defaultVariants } = config;
  const getVariantClassNames = Object.keys(variants).map((variant) => {
    const variantProp = props === null || props === void 0 ? void 0 : props[variant];
    const defaultVariantProp =
      defaultVariants === null || defaultVariants === void 0 ? void 0 : defaultVariants[variant];
    if (variantProp === null) return null;
    const variantKey = falsyToString(variantProp) || falsyToString(defaultVariantProp);
    return variants[variant][variantKey];
  });
  const propsWithoutUndefined =
    props &&
    Object.entries(props).reduce((acc, param) => {
      let [key, value] = param;
      if (value === void 0) return acc;
      acc[key] = value;
      return acc;
    }, {});
  return cx(
    base,
    getVariantClassNames,
    config === null || config === void 0
      ? void 0
      : (_config_compoundVariants = config.compoundVariants) === null ||
          _config_compoundVariants === void 0
        ? void 0
        : _config_compoundVariants.reduce((acc, param) => {
            let { class: cvClass, className: cvClassName, ...compoundVariantOptions } = param;
            return Object.entries(compoundVariantOptions).every((param) => {
              let [key, value] = param;
              return Array.isArray(value)
                ? value.includes(
                    {
                      ...defaultVariants,
                      ...propsWithoutUndefined,
                    }[key],
                  )
                : {
                    ...defaultVariants,
                    ...propsWithoutUndefined,
                  }[key] === value;
            })
              ? [...acc, cvClass, cvClassName]
              : acc;
          }, []),
    props === null || props === void 0 ? void 0 : props.class,
    props === null || props === void 0 ? void 0 : props.className,
  );
};
//#endregion
//#region ../../node_modules/.pnpm/@radix-ui+react-compose-refs@1.1.5_@types+react@19.3.0_react@19.3.0/node_modules/@radix-ui/react-compose-refs/dist/index.mjs
var __defProp$1 = Object.defineProperty;
var __name$1 = (target, value) =>
  __defProp$1(target, "name", {
    value,
    configurable: true,
  });
function setRef(ref, value) {
  if (typeof ref === "function") return ref(value);
  else if (ref !== null && ref !== void 0) ref.current = value;
}
__name$1(setRef, "setRef");
function composeRefs(...refs) {
  return (node) => {
    let hasCleanup = false;
    const cleanups = refs.map((ref) => {
      const cleanup = setRef(ref, node);
      if (!hasCleanup && typeof cleanup == "function") hasCleanup = true;
      return cleanup;
    });
    if (hasCleanup)
      return () => {
        for (let i = 0; i < cleanups.length; i++) {
          const cleanup = cleanups[i];
          if (typeof cleanup == "function") cleanup();
          else setRef(refs[i], null);
        }
      };
  };
}
__name$1(composeRefs, "composeRefs");
function useComposedRefs(...refs) {
  return import_react.useCallback(composeRefs(...refs), refs);
}
__name$1(useComposedRefs, "useComposedRefs");
//#endregion
//#region ../../node_modules/.pnpm/@radix-ui+react-slot@1.4.0_@types+react@19.3.0_react@19.3.0/node_modules/@radix-ui/react-slot/dist/index.mjs
var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", {
    value,
    configurable: true,
  });
// @__NO_SIDE_EFFECTS__
function createSlot(ownerName) {
  const Slot2 = import_react.forwardRef((props, forwardedRef) => {
    let { children, ...slotProps } = props;
    let slottableElement = null;
    let hasSlottable = false;
    const newChildren = [];
    if (isLazyComponent(children) && typeof use === "function") children = use(children._payload);
    import_react.Children.forEach(children, (maybeSlottable) => {
      if (isSlottable(maybeSlottable)) {
        hasSlottable = true;
        const slottable = maybeSlottable;
        let child = "child" in slottable.props ? slottable.props.child : slottable.props.children;
        if (isLazyComponent(child) && typeof use === "function") child = use(child._payload);
        slottableElement = getSlottableElementFromSlottable(slottable, child);
        newChildren.push(slottableElement?.props?.children);
      } else newChildren.push(maybeSlottable);
    });
    if (slottableElement)
      slottableElement = import_react.cloneElement(slottableElement, void 0, newChildren);
    else if (
      !hasSlottable &&
      import_react.Children.count(children) === 1 &&
      import_react.isValidElement(children)
    )
      slottableElement = children;
    const slottableElementRef = slottableElement ? getElementRef(slottableElement) : void 0;
    const composedRef = useComposedRefs(forwardedRef, slottableElementRef);
    if (!slottableElement) {
      if (children || children === 0)
        throw new Error(
          hasSlottable ? createSlottableError(ownerName) : createSlotError(ownerName),
        );
      return children;
    }
    const mergedProps = mergeProps(slotProps, slottableElement.props ?? {});
    if (slottableElement.type !== import_react.Fragment)
      mergedProps.ref = forwardedRef ? composedRef : slottableElementRef;
    return import_react.cloneElement(slottableElement, mergedProps);
  });
  Slot2.displayName = `${ownerName}.Slot`;
  return Slot2;
}
__name(createSlot, "createSlot");
var Slot = /* @__PURE__ */ createSlot("Slot");
var SLOTTABLE_IDENTIFIER = Symbol.for("radix.slottable");
// @__NO_SIDE_EFFECTS__
function createSlottable(ownerName) {
  const Slottable2 = /* @__PURE__ */ __name(
    (props) => ("child" in props ? props.children(props.child) : props.children),
    "Slottable",
  );
  Slottable2.displayName = `${ownerName}.Slottable`;
  Slottable2.__radixId = SLOTTABLE_IDENTIFIER;
  return Slottable2;
}
__name(createSlottable, "createSlottable");
var getSlottableElementFromSlottable = /* @__PURE__ */ __name((slottable, child) => {
  if ("child" in slottable.props) {
    const child2 = slottable.props.child;
    if (!import_react.isValidElement(child2)) return null;
    return import_react.cloneElement(
      child2,
      void 0,
      slottable.props.children(child2.props.children),
    );
  }
  return import_react.isValidElement(child) ? child : null;
}, "getSlottableElementFromSlottable");
function mergeProps(slotProps, childProps) {
  const overrideProps = { ...childProps };
  for (const propName in childProps) {
    const slotPropValue = slotProps[propName];
    const childPropValue = childProps[propName];
    if (/^on[A-Z]/.test(propName)) {
      if (slotPropValue && childPropValue)
        overrideProps[propName] = (...args) => {
          const result = childPropValue(...args);
          slotPropValue(...args);
          return result;
        };
      else if (slotPropValue) overrideProps[propName] = slotPropValue;
    } else if (propName === "style")
      overrideProps[propName] = {
        ...slotPropValue,
        ...childPropValue,
      };
    else if (propName === "className")
      overrideProps[propName] = [slotPropValue, childPropValue].filter(Boolean).join(" ");
    else if (propName === "aria-describedby")
      overrideProps[propName] = concatAriaDescribedby(childPropValue, slotPropValue);
  }
  return {
    ...slotProps,
    ...overrideProps,
  };
}
__name(mergeProps, "mergeProps");
function getElementRef(element) {
  let getter = Object.getOwnPropertyDescriptor(element.props, "ref")?.get;
  let mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) return element.ref;
  getter = Object.getOwnPropertyDescriptor(element, "ref")?.get;
  mayWarn = getter && "isReactWarning" in getter && getter.isReactWarning;
  if (mayWarn) return element.props.ref;
  return element.props.ref || element.ref;
}
__name(getElementRef, "getElementRef");
function isSlottable(child) {
  return (
    import_react.isValidElement(child) &&
    typeof child.type === "function" &&
    "__radixId" in child.type &&
    child.type.__radixId === SLOTTABLE_IDENTIFIER
  );
}
__name(isSlottable, "isSlottable");
var REACT_LAZY_TYPE = Symbol.for("react.lazy");
function isLazyComponent(element) {
  return (
    element != null &&
    typeof element === "object" &&
    "$$typeof" in element &&
    element.$$typeof === REACT_LAZY_TYPE &&
    "_payload" in element &&
    isPromiseLike(element._payload)
  );
}
__name(isLazyComponent, "isLazyComponent");
function isPromiseLike(value) {
  return typeof value === "object" && value !== null && "then" in value;
}
__name(isPromiseLike, "isPromiseLike");
function concatAriaDescribedby(...values) {
  const ids = /* @__PURE__ */ new Set();
  for (const value of values) {
    if (typeof value !== "string") continue;
    for (const id of String(value).trim().split(/\s+/)) if (id) ids.add(id);
  }
  return ids.size > 0 ? Array.from(ids).join(" ") : void 0;
}
__name(concatAriaDescribedby, "concatAriaDescribedby");
var createSlotError = /* @__PURE__ */ __name((ownerName) => {
  return `${ownerName} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`;
}, "createSlotError");
var createSlottableError = /* @__PURE__ */ __name((ownerName) => {
  return `${ownerName} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`;
}, "createSlottableError");
var use = import_react[" use ".trim().toString()];
//#endregion
//#region ../../packages/ui/src/components/button.tsx
var buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        touch: "h-11 px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        "icon-touch": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
function Button({ className, variant = "default", size = "default", asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Comp, {
    "data-slot": "button",
    "data-variant": variant,
    "data-size": size,
    className: cn(
      buttonVariants({
        variant,
        size,
        className,
      }),
    ),
    ...props,
  });
}
//#endregion
//#region ../../packages/backoffice/src/schemas/api/client.ts
var problem = object({
  error: optional(string()),
  message: optional(string()),
  field: optional(string()),
});
//#endregion
//#region ../../packages/backoffice/src/schemas/shops.ts
var shop = object({
  id: string(),
  slug: string(),
  name: string(),
});
var stored = object({
  shops: array(shop),
  currentId: nullable(string()),
});
//#endregion
//#region ../../packages/backoffice/src/stores/shops.ts
var STORAGE_KEY = "shopper.shops";
var listeners = /* @__PURE__ */ new Set();
var state = load();
/** The shops this device has signed in to, and the one the API calls are made for. */
function useShops() {
  return (0, import_react.useSyncExternalStore)(
    subscribe,
    () => state,
    () => state,
  );
}
function currentShop() {
  return state.shops.find((candidate) => candidate.id === state.currentId);
}
/** Adds the shop (or updates its name and code) and makes it the current one. */
function rememberShop(next) {
  save({
    shops: [...state.shops.filter((item) => item.id !== next.id), next],
    currentId: next.id,
  });
}
function selectShop(id) {
  save({
    ...state,
    currentId: id,
  });
}
function save(next) {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  for (const notify of listeners) notify();
}
function load() {
  try {
    const parsed = safeParse(stored, JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
    if (parsed.success) return parsed.output;
  } catch {}
  return {
    shops: [],
    currentId: null,
  };
}
function subscribe(notify) {
  const onStorage = (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = load();
    notify();
  };
  listeners.add(notify);
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    removeEventListener("storage", onStorage);
  };
}
//#endregion
//#region ../../packages/backoffice/src/api/client.ts
var API_BASE = "/api";
var ApiError = class extends Error {
  status;
  field;
  constructor(status, message, field, options) {
    super(message, options);
    this.status = status;
    this.field = field;
  }
};
var OFFLINE_MESSAGE = "Can't reach the server. Check your connection and try again.";
var UNREADABLE_WRITE_MESSAGE =
  "The server's reply couldn't be read. Refresh to see whether your change was saved.";
var UNREADABLE_READ_MESSAGE = "The server's reply couldn't be read. Refresh and try again.";
var LOGGED_BODY_CHARS = 200;
var CREDENTIAL_KEYS = ["token", "resendToken", "password", "pin"];
/** The path for the console: secret query values are replaced, everything else stays for diagnosis. */
function loggablePath(path) {
  const url = new URL(path, "http://shopper.invalid");
  for (const name of CREDENTIAL_KEYS)
    if (url.searchParams.has(name)) url.searchParams.set(name, "redacted");
  return `${url.pathname}${url.search}`;
}
/** Same-origin call to the API with the session cookie and the selected shop, parsed with `schema`. */
async function apiFetch(path, schema, { method = "GET", body, shopId = currentShop()?.id } = {}) {
  const params = new URL(path, "http://shopper.invalid").searchParams;
  const sensitive =
    /^\/(onboarding|invitations|auth)(?:\/|$)/.test(path) ||
    path.split("?")[0] === "/catalogue/imports/uploads" ||
    CREDENTIAL_KEYS.some(
      (name) => params.has(name) || (body !== null && typeof body === "object" && name in body),
    );
  const headers = new Headers();
  if (body !== void 0) headers.set("Content-Type", "application/json");
  if (shopId) headers.set("X-Shopper-Org", shopId);
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === void 0 ? void 0 : JSON.stringify(body),
  }).catch((cause) => {
    console.error(
      `[api] ${method} ${loggablePath(path)} was not sent`,
      sensitive ? "Request details withheld" : cause,
    );
    throw new ApiError(0, OFFLINE_MESSAGE, void 0, sensitive ? void 0 : { cause });
  });
  const copy = response.clone();
  const payload = await response.json().catch(async () => {
    if (!response.ok)
      console.error(
        `[api] ${method} ${loggablePath(path)} failed with ${response.status} and a body that is not JSON`,
        sensitive
          ? "Response details withheld"
          : (await copy.text().catch(() => "")).slice(0, LOGGED_BODY_CHARS),
      );
    return null;
  });
  if (!response.ok) {
    const failure = safeParse(problem, payload);
    const details = failure.success ? failure.output : {};
    throw new ApiError(
      response.status,
      safeMessage(
        details.message ?? details.error ?? `Request failed (${response.status})`,
        path,
        body,
      ),
      details.field,
    );
  }
  const parsed = safeParse(schema, payload);
  if (!parsed.success) {
    console.error(
      `[api] ${method} ${loggablePath(path)} replied ${response.status} with an unexpected shape`,
      sensitive ? "Response details withheld" : flatten(parsed.issues),
    );
    throw new ApiError(
      response.status,
      method === "GET" ? UNREADABLE_READ_MESSAGE : UNREADABLE_WRITE_MESSAGE,
    );
  }
  return parsed.output;
}
function safeMessage(message, path, body) {
  const url = new URL(path, "http://shopper.invalid");
  for (const name of CREDENTIAL_KEYS) {
    const queryValue = url.searchParams.get(name);
    if (queryValue) message = message.replaceAll(queryValue, "[redacted]");
    if (body && typeof body === "object" && name in body) {
      const value = body[name];
      if (typeof value === "string" && value) message = message.replaceAll(value, "[redacted]");
    }
  }
  return message;
}
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var toKebabCase = (string) => string?.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/utils/toLucideIconData.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
function toLucideIconData(iconName, iconNode, aliases = []) {
  if (iconNode == null) throw new Error("[lucide]: iconNode is required when icon name is used");
  return {
    name: toKebabCase(iconName),
    size: 24,
    node: iconNode,
    ...(aliases.length > 0 ? { aliases } : {}),
  };
}
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var toCamelCase = (string) => {
  let out = "";
  let upperNext = false;
  for (const ch of string) {
    if (ch === "-" || ch === "_" || ch <= " ") {
      upperNext = out.length > 0;
      continue;
    }
    if (out.length === 0) out += ch.toLowerCase();
    else out += upperNext ? ch.toUpperCase() : ch;
    upperNext = false;
  }
  return out;
};
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var mergeClasses = (...classes) =>
  classes
    .filter((className, index, array) => {
      return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
    })
    .join(" ")
    .trim();
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/build/defaultAttributes.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 2,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconNode.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
function isDefined(value) {
  return value !== null && value !== void 0;
}
function buildLucideIconNode(icon, params = {}) {
  const attributeNames = params.attributeNames ?? {};
  const getAttributeName = (attributeName) => attributeNames[attributeName] ?? attributeName;
  const viewBoxWidth = icon.size ?? icon.width ?? defaultAttributes["width"];
  const viewBoxHeight = icon.size ?? icon.height ?? defaultAttributes["height"];
  const aliasClassNames =
    icon.aliases
      ?.filter((alias) => typeof alias === "string" && alias.trim() !== "")
      .map((alias) => `lucide-${alias}`) ?? [];
  const iconClassNames = [...(icon.name ? [`lucide-${icon.name}`] : []), ...aliasClassNames];
  const classNamesFromClassName = params.className?.split(" ").filter(Boolean) ?? [];
  const className =
    params.includeDefaultClasses === false
      ? mergeClasses(...classNamesFromClassName)
      : mergeClasses("lucide", ...iconClassNames, ...classNamesFromClassName);
  const calculatedStrokeWidth = params.absoluteStrokeWidth
    ? (Number(params.strokeWidth ?? defaultAttributes["stroke-width"]) *
        Number(icon.size ?? icon.width ?? defaultAttributes["width"])) /
      Number(params.size ?? params.width ?? defaultAttributes["width"])
    : (params.strokeWidth ?? defaultAttributes["stroke-width"]);
  return [
    "svg",
    {
      ...Object.entries(defaultAttributes).reduce((attrs, [attrName, value]) => {
        attrs[getAttributeName(attrName)] = value;
        return attrs;
      }, {}),
      ...("color" in params && params.color && { [getAttributeName("stroke")]: params.color }),
      ...("size" in params &&
        isDefined(params.size) && {
          [getAttributeName("width")]: params.size,
          [getAttributeName("height")]: params.size,
        }),
      ...("width" in params &&
        isDefined(params.width) && { [getAttributeName("width")]: params.width }),
      ...("height" in params &&
        isDefined(params.height) && { [getAttributeName("height")]: params.height }),
      [getAttributeName("stroke-width")]: calculatedStrokeWidth,
      ...(className && { [getAttributeName("class")]: className }),
      [getAttributeName("viewBox")]: `0 0 ${viewBoxWidth} ${viewBoxHeight}`,
      ...(params.hasA11yProp === false ? { [getAttributeName("aria-hidden")]: "true" } : {}),
      ...("attributes" in params && params.attributes),
    },
    icon.node.map((child) => {
      const [name, attrs, children] = child;
      const nextAttrs = params.nonScalingStroke
        ? {
            [getAttributeName("vector-effect")]: "non-scaling-stroke",
            ...attrs,
          }
        : attrs;
      return children ? [name, nextAttrs, children] : [name, nextAttrs];
    }),
  ];
}
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/build/buildLucideIconForReact.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
function buildLucideIconForReact(icon, params = {}) {
  return buildLucideIconNode(icon, {
    ...params,
    attributeNames: {
      ...params.attributeNames,
      class: "className",
      "stroke-width": "strokeWidth",
      "stroke-linecap": "strokeLinecap",
      "stroke-linejoin": "strokeLinejoin",
      "vector-effect": "vectorEffect",
    },
  });
}
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var hasA11yProp = (props) => {
  for (const prop in props)
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") return true;
  return false;
};
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/context.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var LucideContext = (0, import_react.createContext)({});
var useLucideContext = () => (0, import_react.useContext)(LucideContext);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/Icon.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var Icon = (0, import_react.forwardRef)(
  (
    {
      color,
      size,
      width,
      height,
      strokeWidth,
      absoluteStrokeWidth,
      nonScalingStroke,
      className = "",
      children,
      iconNode = [],
      icon = {
        node: iconNode,
        aliases: [],
        size: 24,
      },
      ...rest
    },
    ref,
  ) => {
    const {
      size: contextSize = 24,
      strokeWidth: contextStrokeWidth = 2,
      absoluteStrokeWidth: contextAbsoluteStrokeWidth = false,
      nonScalingStroke: contextNonScalingStroke = false,
      color: contextColor = "currentColor",
      className: contextClass = "",
    } = useLucideContext() ?? {};
    const hasAccessibleProp = Boolean(children) || hasA11yProp(rest);
    const [name, svgAttributes, builtIconNode = []] = buildLucideIconForReact(icon, {
      color: color ?? contextColor,
      width: width ?? size ?? contextSize,
      height: height ?? size ?? contextSize,
      strokeWidth: strokeWidth ?? contextStrokeWidth,
      absoluteStrokeWidth: absoluteStrokeWidth ?? contextAbsoluteStrokeWidth,
      nonScalingStroke: nonScalingStroke ?? contextNonScalingStroke,
      className: mergeClasses(contextClass, className),
      hasA11yProp: hasAccessibleProp,
      attributes: rest,
    });
    return (0, import_react.createElement)(
      name,
      {
        ref,
        ...svgAttributes,
      },
      [
        ...builtIconNode.map(([tag, attrs]) => (0, import_react.createElement)(tag, attrs)),
        ...(Array.isArray(children) ? children : [children]),
      ],
    );
  },
);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/createLucideIcon.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
function createLucideIcon(iconDataOrName, iconNode = [], aliases = []) {
  const iconData =
    typeof iconDataOrName === "string"
      ? toLucideIconData(iconDataOrName, iconNode, aliases)
      : iconDataOrName;
  const Component = (0, import_react.forwardRef)(({ className, ...props }, ref) =>
    (0, import_react.createElement)(Icon, {
      ref,
      icon: iconData,
      className,
      ...props,
    }),
  );
  if (iconData.name) Component.displayName = toPascalCase(iconData.name);
  return Component;
}
//#endregion
export {
  functionalUpdate as A,
  resolveQueryValue as B,
  focusManager as C,
  addToEnd as D,
  addConsumeAwareSignal as E,
  matchMutation as F,
  timeoutManager as G,
  shouldThrowError as H,
  matchQuery as I,
  QueryClientProvider as K,
  noop as L,
  hashQueryKeyByOptions as M,
  isValidTimeout as N,
  addToStart as O,
  keepPreviousData as P,
  partialMatchKey as R,
  notifyManager as S,
  isServer as T,
  skipToken as U,
  shallowEqualObjects as V,
  timeUntilStale as W,
  Removable as _,
  rememberShop as a,
  createRetryer as b,
  Button as c,
  composeRefs as d,
  useComposedRefs as f,
  Mutation as g,
  useMutation as h,
  currentShop as i,
  hashKey as j,
  ensureQueryFn as k,
  Slot as l,
  cn as m,
  ApiError as n,
  selectShop as o,
  cva as p,
  useQueryClient as q,
  apiFetch as r,
  useShops as s,
  createLucideIcon as t,
  createSlot as u,
  CancelledError as v,
  Subscribable as w,
  onlineManager as x,
  canFetch as y,
  replaceData as z,
};
