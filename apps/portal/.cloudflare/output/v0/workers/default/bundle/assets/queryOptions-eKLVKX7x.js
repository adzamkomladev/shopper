import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import {
  B as resolveQueryValue,
  C as focusManager,
  D as addToEnd,
  E as addConsumeAwareSignal,
  G as timeoutManager,
  H as shouldThrowError,
  L as noop,
  N as isValidTimeout,
  O as addToStart,
  S as notifyManager,
  T as isServer,
  U as skipToken,
  V as shallowEqualObjects,
  W as timeUntilStale,
  _ as Removable,
  b as createRetryer,
  k as ensureQueryFn,
  q as useQueryClient,
  v as CancelledError,
  w as Subscribable,
  y as canFetch,
  z as replaceData,
} from "./createLucideIcon-DmKyVZgg.js";
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/infiniteQueryBehavior.js
function infiniteQueryBehavior(pages) {
  return {
    onFetch: (context, query) => {
      const options = context.options;
      const direction = context.fetchOptions?.meta?.fetchMore?.direction;
      const oldPages = context.state.data?.pages || [];
      const oldPageParams = context.state.data?.pageParams || [];
      let result = {
        pages: [],
        pageParams: [],
      };
      let currentPage = 0;
      const fetchFn = async () => {
        let cancelled = false;
        const addSignalProperty = (object) => {
          addConsumeAwareSignal(
            object,
            () => context.signal,
            () => (cancelled = true),
          );
        };
        const queryFn = ensureQueryFn(context.options, context.fetchOptions);
        const fetchPage = async (data, param, previous) => {
          if (cancelled) return Promise.reject(context.signal.reason);
          if (param == null && data.pages.length) return Promise.resolve(data);
          const createQueryFnContext = () => {
            const queryFnContext = {
              client: context.client,
              queryKey: context.queryKey,
              pageParam: param,
              direction: previous ? "backward" : "forward",
              meta: context.options.meta,
            };
            addSignalProperty(queryFnContext);
            return queryFnContext;
          };
          const queryFnContext = createQueryFnContext();
          const page = await queryFn(queryFnContext);
          const { maxPages } = context.options;
          const addTo = previous ? addToStart : addToEnd;
          return {
            pages: addTo(data.pages, page, maxPages),
            pageParams: addTo(data.pageParams, param, maxPages),
          };
        };
        if (direction && oldPages.length) {
          const previous = direction === "backward";
          const pageParamFn = previous ? getPreviousPageParam : getNextPageParam;
          const oldData = {
            pages: oldPages,
            pageParams: oldPageParams,
          };
          result = await fetchPage(oldData, pageParamFn(options, oldData), previous);
        } else {
          const remainingPages = pages ?? oldPages.length;
          do {
            const param =
              currentPage === 0
                ? (oldPageParams[0] ?? options.initialPageParam)
                : getNextPageParam(options, result);
            if (currentPage > 0 && param == null) break;
            result = await fetchPage(result, param);
            currentPage++;
          } while (currentPage < remainingPages);
        }
        return result;
      };
      if (context.options.persister)
        context.fetchFn = () => {
          return context.options.persister?.(
            fetchFn,
            {
              client: context.client,
              queryKey: context.queryKey,
              meta: context.options.meta,
              signal: context.signal,
            },
            query,
          );
        };
      else context.fetchFn = fetchFn;
    },
  };
}
function getNextPageParam(options, { pages, pageParams }) {
  const lastIndex = pages.length - 1;
  return pages.length > 0
    ? options.getNextPageParam(pages[lastIndex], pages, pageParams[lastIndex], pageParams)
    : void 0;
}
function getPreviousPageParam(options, { pages, pageParams }) {
  return pages.length > 0
    ? options.getPreviousPageParam?.(pages[0], pages, pageParams[0], pageParams)
    : void 0;
}
/**
 * Checks if there is a next page.
 */
function hasNextPage(options, data) {
  if (!data) return false;
  return getNextPageParam(options, data) != null;
}
/**
 * Checks if there is a previous page.
 */
function hasPreviousPage(options, data) {
  if (!data || !options.getPreviousPageParam) return false;
  return getPreviousPageParam(options, data) != null;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/query.js
/**
 * Represents a single cached query. A `Query` holds the query's key, options,
 * state (data/error/status), and the observers currently subscribed to it.
 *
 * Instances are created and managed internally by `QueryCache`; application
 * code typically interacts with queries indirectly through `QueryClient` or
 * a framework hook like `useQuery`. Direct access to a `Query` instance is
 * possible via `queryCache.find()`/`findAll()` for inspecting cache state.
 *
 * @example
 * ```ts
 * const queryCache = queryClient.getQueryCache()
 * const query = queryCache.find({ queryKey: ['posts'] })
 *
 * if (query) {
 *   console.log(query.state.dataUpdatedAt)
 * }
 * ```
 */
var Query = class extends Removable {
  #queryType;
  #initialState;
  #revertState;
  #cache;
  #client;
  #retryer;
  #defaultOptions;
  #abortSignalConsumed;
  constructor(config) {
    super();
    this.#abortSignalConsumed = false;
    this.#defaultOptions = config.defaultOptions;
    this.setOptions(config.options);
    this.observers = [];
    this.#client = config.client;
    this.#cache = this.#client.getQueryCache();
    this.queryKey = config.queryKey;
    this.queryHash = config.queryHash;
    this.#initialState = getDefaultState(this.options);
    this.state = config.state ?? this.#initialState;
    this.scheduleGc();
  }
  /**
   * The `meta` object passed in the query's options, if any.
   */
  get meta() {
    return this.options.meta;
  }
  /** @internal */
  get queryType() {
    return this.#queryType;
  }
  /**
   * The promise for the currently in-flight fetch, if the query is fetching.
   * `undefined` when the query is not fetching.
   */
  get promise() {
    return this.#retryer?.promise;
  }
  /** @internal */
  setOptions(options) {
    this.options = {
      ...this.#defaultOptions,
      ...options,
    };
    if (options?._type) this.#queryType = options._type;
    this.updateGcTime(this.options.gcTime);
    if (this.state && this.state.data === void 0) {
      const defaultState = getDefaultState(this.options);
      if (defaultState.data !== void 0) {
        this.setState(successState(defaultState.data, defaultState.dataUpdatedAt));
        this.#initialState = defaultState;
      }
    }
  }
  optionalRemove() {
    if (!this.observers.length && this.state.fetchStatus === "idle") this.#cache.remove(this);
  }
  /** @internal */
  setData(newData, options) {
    const data = replaceData(this.state.data, newData, this.options);
    this.#dispatch({
      data,
      type: "success",
      dataUpdatedAt: options?.updatedAt,
      manual: options?.manual,
    });
    return data;
  }
  /**
   * Merges the given partial state directly into this query's state, notifying observers. Used
   * by persistence and broadcast plugins to restore a state snapshot, and by devtools to let a
   * user manually trigger a loading/error state or edit the cached data.
   */
  setState(state) {
    this.#dispatch({
      type: "setState",
      state,
    });
  }
  /**
   * Cancels the query's currently in-flight fetch, if any.
   * - Returns a promise that resolves once the cancellation has settled.
   * - If no fetch is in progress, resolves immediately.
   *
   * @example
   * ```ts
   * await query.cancel()
   * ```
   */
  cancel(options) {
    const promise = this.#retryer?.promise;
    this.#retryer?.cancel(options);
    return promise ? promise.then(noop).catch(noop) : Promise.resolve();
  }
  /**
   * Clears the query's garbage collection timeout and silently cancels any
   * in-flight fetch. Called by `QueryCache` when the query is removed from
   * the cache.
   *
   * @see {@link Query#cancel}
   */
  destroy() {
    super.destroy();
    this.cancel({ silent: true });
  }
  /** @internal */
  get resetState() {
    return this.#initialState;
  }
  /**
   * Resets the query back to its initial state (the state it had when it was
   * first created, e.g. any `initialData`), destroying it first to cancel any
   * in-flight fetch.
   */
  reset() {
    this.destroy();
    this.setState(this.resetState);
  }
  /**
   * Returns `true` if the query has at least one observer for which `enabled`
   * does not resolve to `false`.
   */
  isActive() {
    return this.observers.some(
      (observer) => resolveQueryValue(observer.options.enabled, this) !== false,
    );
  }
  /**
   * Returns `true` if the query is disabled, meaning it will not fetch
   * automatically.
   * - If the query has observers, it is disabled when none of them are active
   *   (see `isActive`).
   * - If the query has no observers, it is disabled when its `queryFn` is
   *   `skipToken` or it has never been fetched.
   */
  isDisabled() {
    if (this.getObserversCount() > 0) return !this.isActive();
    return this.options.queryFn === skipToken || !this.isFetched();
  }
  /**
   * Returns `true` if the query has been fetched, i.e. it has resolved with
   * either data or an error at least once.
   */
  isFetched() {
    return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
  }
  /**
   * Returns `true` if the query has at least one observer configured with
   * `staleTime: 'static'`, meaning it is treated as never stale.
   */
  isStatic() {
    if (this.getObserversCount() > 0)
      return this.observers.some(
        (observer) => resolveQueryValue(observer.options.staleTime, this) === "static",
      );
    return false;
  }
  /**
   * Returns `true` if the query is stale.
   * - If the query has observers, defers to whether any observer's current
   *   result reports `isStale` (which accounts for each observer's own
   *   `staleTime` and `enabled` state).
   * - If the query has no observers, it is considered stale when it has no
   *   data or has been invalidated.
   *
   * @see {@link Query#isStaleByTime}
   * @example
   * ```ts
   * if (query.isStale()) {
   *   // refetch or otherwise treat the cached data as outdated
   * }
   * ```
   */
  isStale() {
    if (this.getObserversCount() > 0)
      return this.observers.some((observer) => observer.getCurrentResult().isStale);
    return this.state.data === void 0 || this.state.isInvalidated;
  }
  /**
   * Returns `true` if the query's data is stale relative to the given
   * `staleTime` (defaults to `0`).
   * - A query with no data is always stale.
   * - `staleTime: 'static'` is never stale.
   * - An invalidated query is always stale.
   * - Otherwise, staleness is based on elapsed time since `dataUpdatedAt`.
   *
   * @see {@link Query#isStale}
   * @example
   * ```ts
   * const isStale = query.isStaleByTime(1000 * 60)
   * ```
   */
  isStaleByTime(staleTime = 0) {
    if (this.state.data === void 0) return true;
    if (staleTime === "static") return false;
    if (this.state.isInvalidated) return true;
    return !timeUntilStale(this.state.dataUpdatedAt, staleTime);
  }
  /** @internal */
  onFocus() {
    this.observers.find((x) => x.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: false });
    this.#retryer?.continue();
  }
  /** @internal */
  onOnline() {
    this.observers.find((x) => x.shouldFetchOnReconnect())?.refetch({ cancelRefetch: false });
    this.#retryer?.continue();
  }
  /** @internal */
  addObserver(observer) {
    if (!this.observers.includes(observer)) {
      this.observers.push(observer);
      this.clearGcTimeout();
      this.#cache.notify({
        type: "observerAdded",
        query: this,
        observer,
      });
    }
  }
  /** @internal */
  removeObserver(observer) {
    const index = this.observers.indexOf(observer);
    if (index !== -1) {
      this.observers.splice(index, 1);
      if (!this.observers.length) {
        if (this.#retryer) {
          if (
            this.#abortSignalConsumed ||
            (this.state.fetchStatus === "paused" && this.state.status === "pending")
          )
            this.#retryer.cancel({ revert: true });
          else this.#retryer.cancelRetry();
        }
        this.scheduleGc();
      }
      this.#cache.notify({
        type: "observerRemoved",
        query: this,
        observer,
      });
    }
  }
  /**
   * Returns the number of observers currently subscribed to this query.
   *
   * @example
   * ```ts
   * if (query.getObserversCount() === 0) {
   *   // no component is currently watching this query
   * }
   * ```
   */
  getObserversCount() {
    return this.observers.length;
  }
  /**
   * Marks the query as invalidated, unless it is already invalidated. This
   * updates `state.isInvalidated` and notifies observers, but does not by
   * itself trigger a refetch.
   *
   * @example
   * ```ts
   * query.invalidate()
   * ```
   */
  invalidate() {
    if (!this.state.isInvalidated) this.#dispatch({ type: "invalidate" });
  }
  /**
   * Fetches the query, i.e. runs its `queryFn` (through any configured
   * retryer/behavior) and updates the query's state with the result.
   * - If a fetch is already in flight, returns its promise instead of
   *   starting a new one, unless `fetchOptions.cancelRefetch` is set and the
   *   query already has data, in which case the current fetch is silently
   *   cancelled first.
   * - If `options` is passed, it replaces the query's current options
   *   before fetching.
   */
  async fetch(options, fetchOptions) {
    if (this.state.fetchStatus !== "idle" && this.#retryer?.status() !== "rejected") {
      if (this.state.data !== void 0 && fetchOptions?.cancelRefetch) this.cancel({ silent: true });
      else if (this.#retryer) {
        this.#retryer.continueRetry();
        return this.#retryer.promise;
      }
    }
    if (options) this.setOptions(options);
    if (!this.options.queryFn) {
      const observer = this.observers.find((x) => x.options.queryFn);
      if (observer) this.setOptions(observer.options);
    }
    const abortController = new AbortController();
    const addSignalProperty = (object) => {
      Object.defineProperty(object, "signal", {
        enumerable: true,
        get: () => {
          this.#abortSignalConsumed = true;
          return abortController.signal;
        },
      });
    };
    const fetchFn = () => {
      const queryFn = ensureQueryFn(this.options, fetchOptions);
      const createQueryFnContext = () => {
        const queryFnContext = {
          client: this.#client,
          queryKey: this.queryKey,
          meta: this.meta,
        };
        addSignalProperty(queryFnContext);
        return queryFnContext;
      };
      const queryFnContext = createQueryFnContext();
      this.#abortSignalConsumed = false;
      if (this.options.persister) return this.options.persister(queryFn, queryFnContext, this);
      return queryFn(queryFnContext);
    };
    const createFetchContext = () => {
      const context = {
        fetchOptions,
        options: this.options,
        queryKey: this.queryKey,
        client: this.#client,
        state: this.state,
        fetchFn,
      };
      addSignalProperty(context);
      return context;
    };
    const context = createFetchContext();
    (this.#queryType === "infinite"
      ? infiniteQueryBehavior(this.options.pages)
      : this.options.behavior
    )?.onFetch(context, this);
    this.#revertState = this.state;
    if (this.state.fetchStatus === "idle" || this.state.fetchMeta !== context.fetchOptions?.meta)
      this.#dispatch({
        type: "fetch",
        meta: context.fetchOptions?.meta,
      });
    const retryer = (this.#retryer = createRetryer({
      initialPromise: fetchOptions?.initialPromise,
      fn: context.fetchFn,
      onCancel: (error) => {
        if (error instanceof CancelledError && error.revert)
          this.setState({
            ...this.#revertState,
            fetchStatus: "idle",
          });
        abortController.abort();
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
      onContinue: () => {
        this.#dispatch({ type: "continue" });
      },
      retry: context.options.retry,
      retryDelay: context.options.retryDelay,
      networkMode: context.options.networkMode,
      canRun: () => true,
    }));
    try {
      const data = await retryer.start();
      if (data === void 0) throw new Error(`${this.queryHash} data is undefined`);
      this.setData(data);
      this.#cache.config.onSuccess?.(data, this);
      this.#cache.config.onSettled?.(data, this.state.error, this);
      return data;
    } catch (error) {
      if (error instanceof CancelledError) {
        if (error.silent) return this.#retryer.promise;
        else if (error.revert) {
          if (this.state.data === void 0) throw error;
          return this.state.data;
        }
      }
      this.#dispatch({
        type: "error",
        error,
      });
      this.#cache.config.onError?.(error, this);
      this.#cache.config.onSettled?.(this.state.data, error, this);
      throw error;
    } finally {
      if (this.#retryer === retryer) this.#retryer = void 0;
      this.scheduleGc();
    }
  }
  #dispatch(action) {
    const reducer = (state) => {
      switch (action.type) {
        case "failed":
          return {
            ...state,
            fetchFailureCount: action.failureCount,
            fetchFailureReason: action.error,
          };
        case "pause":
          return {
            ...state,
            fetchStatus: "paused",
          };
        case "continue":
          return {
            ...state,
            fetchStatus: "fetching",
          };
        case "fetch":
          return {
            ...state,
            ...fetchState(state.data, this.options),
            fetchMeta: action.meta ?? null,
          };
        case "success":
          const newState = {
            ...state,
            ...successState(action.data, action.dataUpdatedAt),
            dataUpdateCount: state.dataUpdateCount + 1,
            ...(!action.manual && {
              fetchStatus: "idle",
              fetchFailureCount: 0,
              fetchFailureReason: null,
            }),
          };
          this.#revertState = action.manual ? newState : void 0;
          return newState;
        case "error":
          const error = action.error;
          return {
            ...state,
            error,
            errorUpdateCount: state.errorUpdateCount + 1,
            errorUpdatedAt: Date.now(),
            fetchFailureCount: state.fetchFailureCount + 1,
            fetchFailureReason: error,
            fetchStatus: "idle",
            status: "error",
            isInvalidated: true,
          };
        case "invalidate":
          return {
            ...state,
            isInvalidated: true,
          };
        case "setState":
          return {
            ...state,
            ...action.state,
          };
      }
    };
    this.state = reducer(this.state);
    notifyManager.batch(() => {
      this.observers.slice().forEach((observer) => {
        observer.onQueryUpdate();
      });
      this.#cache.notify({
        query: this,
        type: "updated",
        action,
      });
    });
  }
};
function fetchState(data, options) {
  return {
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchStatus: canFetch(options.networkMode) ? "fetching" : "paused",
    ...(data === void 0 && {
      error: null,
      status: "pending",
    }),
  };
}
function successState(data, dataUpdatedAt) {
  return {
    data,
    dataUpdatedAt: dataUpdatedAt ?? Date.now(),
    error: null,
    isInvalidated: false,
    status: "success",
  };
}
function getDefaultState(options) {
  const data =
    typeof options.initialData === "function" ? options.initialData() : options.initialData;
  const hasData = data !== void 0;
  const initialDataUpdatedAt = hasData
    ? typeof options.initialDataUpdatedAt === "function"
      ? options.initialDataUpdatedAt()
      : options.initialDataUpdatedAt
    : 0;
  return {
    data,
    dataUpdateCount: 0,
    dataUpdatedAt: hasData ? (initialDataUpdatedAt ?? Date.now()) : 0,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    isInvalidated: false,
    status: hasData ? "success" : "pending",
    fetchStatus: "idle",
  };
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/queryObserver.js
/**
 * A `QueryObserver` watches a single query in the `QueryCache` and computes a
 * `QueryObserverResult` from its state, recomputing and notifying subscribers
 * whenever the underlying query (or the observer's options) changes. It is
 * the primitive that framework adapters (e.g. `useQuery`) build their hooks
 * on top of, but it can also be used directly to observe and switch between
 * queries outside of any framework.
 *
 * @example
 * ```ts
 * const observer = new QueryObserver(queryClient, {
 *   queryKey: ['posts'],
 *   queryFn: fetchPosts,
 * })
 *
 * const unsubscribe = observer.subscribe((result) => {
 *   console.log(result.data)
 * })
 * ```
 */
var QueryObserver = class extends Subscribable {
  #client;
  #currentQuery = void 0;
  #currentQueryInitialState = void 0;
  #currentResult = void 0;
  #currentResultState;
  #currentResultOptions;
  #selectError;
  #selectFn;
  #selectResult;
  #lastQueryWithDefinedData;
  #staleTimeoutId;
  #refetchIntervalId;
  #currentRefetchInterval;
  #trackedProps = /* @__PURE__ */ new Set();
  constructor(client, options) {
    super();
    this.options = options;
    this.#client = client;
    this.#selectError = null;
    this.bindMethods();
    this.setOptions(options);
  }
  bindMethods() {
    this.refetch = this.refetch.bind(this);
  }
  onSubscribe() {
    if (this.listeners.size === 1) {
      this.#currentQuery.addObserver(this);
      if (shouldFetchOnMount(this.#currentQuery, this.options)) this.#executeFetch();
      else this.updateResult();
      this.#updateTimers();
    }
  }
  onUnsubscribe() {
    if (!this.hasListeners()) this.destroy();
  }
  /**
   * Returns whether the observed query is currently stale and configured
   * (via the `refetchOnReconnect` option) to refetch when the network
   * reconnects.
   */
  shouldFetchOnReconnect() {
    return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnReconnect);
  }
  /**
   * Returns whether the observed query is currently stale and configured
   * (via the `refetchOnWindowFocus` option) to refetch when the window
   * regains focus.
   */
  shouldFetchOnWindowFocus() {
    return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnWindowFocus);
  }
  /**
   * Stops observing the current query: clears all listeners, cancels the
   * stale and refetch-interval timers, and removes this observer from the
   * query it was observing.
   */
  destroy() {
    this.listeners = /* @__PURE__ */ new Set();
    this.#clearStaleTimeout();
    this.#clearRefetchInterval();
    this.#currentQuery.removeObserver(this);
  }
  /**
   * Updates the observer's options. This will re-resolve the query being
   * observed (switching to a different query if the `queryKey` changed),
   * trigger a fetch if the new options require one and the observer has
   * subscribers, recompute the current result, and reschedule the stale and
   * refetch-interval timers as needed.
   *
   * @example
   * ```ts
   * observer.setOptions({ queryKey: ['posts', 1], queryFn: () => fetchPost(1) })
   * // later: switch to a different query, reusing the same observer
   * observer.setOptions({ queryKey: ['posts', 2], queryFn: () => fetchPost(2) })
   * ```
   */
  setOptions(options) {
    const prevOptions = this.options;
    const prevQuery = this.#currentQuery;
    this.options = this.#client.defaultQueryOptions(options);
    if (
      this.options.enabled !== void 0 &&
      typeof this.options.enabled !== "boolean" &&
      typeof this.options.enabled !== "function" &&
      typeof resolveQueryValue(this.options.enabled, this.#currentQuery) !== "boolean"
    )
      throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");
    this.#updateQuery();
    this.#currentQuery.setOptions(this.options);
    if (prevOptions._defaulted && !shallowEqualObjects(this.options, prevOptions))
      this.#client.getQueryCache().notify({
        type: "observerOptionsUpdated",
        query: this.#currentQuery,
        observer: this,
      });
    const mounted = this.hasListeners();
    if (mounted && shouldFetchOptionally(this.#currentQuery, prevQuery, this.options, prevOptions))
      this.#executeFetch();
    this.updateResult();
    if (
      mounted &&
      (this.#currentQuery !== prevQuery ||
        resolveQueryValue(this.options.enabled, this.#currentQuery) !==
          resolveQueryValue(prevOptions.enabled, this.#currentQuery) ||
        resolveQueryValue(this.options.staleTime, this.#currentQuery) !==
          resolveQueryValue(prevOptions.staleTime, this.#currentQuery))
    )
      this.#updateStaleTimeout();
    const nextRefetchInterval = this.#computeRefetchInterval();
    if (
      mounted &&
      (this.#currentQuery !== prevQuery ||
        resolveQueryValue(this.options.enabled, this.#currentQuery) !==
          resolveQueryValue(prevOptions.enabled, this.#currentQuery) ||
        nextRefetchInterval !== this.#currentRefetchInterval)
    )
      this.#updateRefetchInterval(nextRefetchInterval);
  }
  /**
   * Computes the result the observer would produce for the given (already-defaulted) options
   * right now, building the underlying `Query` if it doesn't exist yet, without waiting for a
   * subscription callback. Called by framework adapters on every render (e.g. `useQuery`) so the
   * returned value is available synchronously, ahead of `setOptions` triggering an actual fetch.
   */
  getOptimisticResult(options) {
    const query = this.#client.getQueryCache().build(this.#client, options);
    const result = this.createResult(query, options);
    if (!shallowEqualObjects(this.getCurrentResult(), result)) {
      this.#currentResult = result;
      this.#currentResultOptions = this.options;
      this.#currentResultState = this.#currentQuery.state;
    }
    return result;
  }
  /**
   * Returns the most recently computed `QueryObserverResult` for the
   * observed query. This is a point-in-time read; to be notified of updates
   * as they happen, subscribe to the observer instead (its inherited
   * `subscribe` method).
   *
   * @example
   * ```ts
   * const result = observer.getCurrentResult()
   * console.log(result.status, result.data)
   * ```
   */
  getCurrentResult() {
    return this.#currentResult;
  }
  /**
   * Wraps a `QueryObserverResult` in a `Proxy` that records which properties are read, via
   * {@link QueryObserver#trackProp} (and an optional `onPropTracked` callback). Used by framework
   * adapters when `notifyOnChangeProps` is not set, to implement its default "only re-render on
   * properties you actually read" behavior.
   */
  trackResult(result, onPropTracked) {
    return new Proxy(result, {
      get: (target, key) => {
        this.trackProp(key);
        onPropTracked?.(key);
        return Reflect.get(target, key);
      },
    });
  }
  /**
   * Records that the given `QueryObserverResult` property was read, so a subsequent update only
   * notifies this observer if a tracked property actually changed. Normally called indirectly via
   * {@link QueryObserver#trackResult}'s proxy; exposed directly for adapters that track property
   * access themselves (e.g. through their own reactivity system) instead of via the proxy.
   */
  trackProp(key) {
    this.#trackedProps.add(key);
  }
  /**
   * Returns the `Query` instance this observer is currently observing.
   */
  getCurrentQuery() {
    return this.#currentQuery;
  }
  /**
   * Refetches the observed query and returns a promise that resolves with
   * the resulting `QueryObserverResult`.
   *
   * @example
   * ```ts
   * const result = await observer.refetch({ cancelRefetch: false })
   * console.log(result.data)
   * ```
   */
  refetch({ ...options } = {}) {
    return this.fetch({ ...options });
  }
  /**
   * Fetches a query defined by the given options without affecting this
   * observer's own tracked query or result, and returns a promise that
   * resolves with the `QueryObserverResult` for that fetch. This is useful
   * for prefetching data that another observer (e.g. a query about to be
   * navigated to) will need, ahead of time.
   *
   * @example
   * ```ts
   * const result = await observer.fetchOptimistic({
   *   queryKey: ['posts', 2],
   *   queryFn: () => fetchPost(2),
   * })
   * console.log(result.data)
   * ```
   */
  fetchOptimistic(options) {
    const defaultedOptions = this.#client.defaultQueryOptions(options);
    const query = this.#client.getQueryCache().build(this.#client, defaultedOptions);
    let unsubscribe = () => {};
    let resolveEarly;
    const cachePromise = new Promise((resolve) => {
      resolveEarly = resolve;
      unsubscribe = this.#client.getQueryCache().subscribe((event) => {
        if (
          event.type === "updated" &&
          event.query.queryHash === query.queryHash &&
          query.state.data !== void 0
        ) {
          unsubscribe();
          resolve(this.createResult(query, defaultedOptions));
        }
      });
    });
    return Promise.race([
      query
        .fetch()
        .then(() => {
          const result = this.createResult(query, defaultedOptions);
          resolveEarly?.(result);
          return result;
        })
        .finally(() => {
          unsubscribe();
        }),
      cachePromise,
    ]);
  }
  fetch(fetchOptions) {
    return this.#executeFetch({
      ...fetchOptions,
      cancelRefetch: fetchOptions.cancelRefetch ?? true,
    }).then(() => {
      this.updateResult();
      return this.#currentResult;
    });
  }
  #executeFetch(fetchOptions) {
    this.#updateQuery();
    let promise = this.#currentQuery.fetch(this.options, fetchOptions);
    if (!fetchOptions?.throwOnError) promise = promise.catch(noop);
    return promise;
  }
  #shouldScheduleTimer(timeout) {
    return (
      !isServer() &&
      resolveQueryValue(this.options.enabled, this.#currentQuery) !== false &&
      isValidTimeout(timeout)
    );
  }
  #updateStaleTimeout() {
    this.#clearStaleTimeout();
    const staleTime = resolveQueryValue(this.options.staleTime, this.#currentQuery);
    if (this.#currentResult.isStale || !this.#shouldScheduleTimer(staleTime)) return;
    const timeout = timeUntilStale(this.#currentResult.dataUpdatedAt, staleTime) + 1;
    this.#staleTimeoutId = timeoutManager.setTimeout(() => {
      if (!this.#currentResult.isStale) this.updateResult();
    }, timeout);
  }
  #computeRefetchInterval() {
    return resolveQueryValue(this.options.refetchInterval, this.#currentQuery) ?? false;
  }
  #updateRefetchInterval(nextInterval) {
    this.#clearRefetchInterval();
    this.#currentRefetchInterval = nextInterval;
    if (
      this.#currentRefetchInterval === 0 ||
      !this.#shouldScheduleTimer(this.#currentRefetchInterval)
    )
      return;
    this.#refetchIntervalId = timeoutManager.setInterval(() => {
      if (this.options.refetchIntervalInBackground || focusManager.isFocused())
        this.#executeFetch();
    }, this.#currentRefetchInterval);
  }
  #updateTimers() {
    this.#updateStaleTimeout();
    this.#updateRefetchInterval(this.#computeRefetchInterval());
  }
  #clearStaleTimeout() {
    if (this.#staleTimeoutId !== void 0) {
      timeoutManager.clearTimeout(this.#staleTimeoutId);
      this.#staleTimeoutId = void 0;
    }
  }
  #clearRefetchInterval() {
    if (this.#refetchIntervalId !== void 0) {
      timeoutManager.clearInterval(this.#refetchIntervalId);
      this.#refetchIntervalId = void 0;
    }
  }
  createResult(query, options) {
    const prevQuery = this.#currentQuery;
    const prevOptions = this.options;
    const prevResult = this.#currentResult;
    const prevResultState = this.#currentResultState;
    const prevResultOptions = this.#currentResultOptions;
    const queryInitialState = query !== prevQuery ? query.state : this.#currentQueryInitialState;
    const { state } = query;
    let newState = { ...state };
    let isPlaceholderData = false;
    let data;
    if (options._optimisticResults) {
      const mounted = this.hasListeners();
      const fetchOnMount = !mounted && shouldFetchOnMount(query, options);
      const fetchOptionally =
        mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions);
      if (fetchOnMount || fetchOptionally)
        newState = {
          ...newState,
          ...fetchState(state.data, query.options),
        };
      if (options._optimisticResults === "isRestoring") newState.fetchStatus = "idle";
    }
    let { error, errorUpdatedAt, status } = newState;
    data = newState.data;
    let skipSelect = false;
    if (options.placeholderData !== void 0 && data === void 0 && status === "pending") {
      let placeholderData;
      if (
        prevResult?.isPlaceholderData &&
        options.placeholderData === prevResultOptions?.placeholderData
      ) {
        placeholderData = prevResult.data;
        skipSelect = true;
      } else
        placeholderData =
          typeof options.placeholderData === "function"
            ? options.placeholderData(
                this.#lastQueryWithDefinedData?.state.data,
                this.#lastQueryWithDefinedData,
              )
            : options.placeholderData;
      if (placeholderData !== void 0) {
        status = "success";
        data = replaceData(prevResult?.data, placeholderData, options);
        isPlaceholderData = true;
      }
    }
    if (options.select && data !== void 0 && !skipSelect) {
      if (prevResult && data === prevResultState?.data && options.select === this.#selectFn)
        data = this.#selectResult;
      else
        try {
          this.#selectFn = options.select;
          data = options.select(data);
          data = replaceData(prevResult?.data, data, options);
          this.#selectResult = data;
          this.#selectError = null;
        } catch (selectError) {
          this.#selectError = selectError;
        }
    } else if (data === void 0) this.#selectError = null;
    if (this.#selectError) {
      error = this.#selectError;
      data = this.#selectResult;
      errorUpdatedAt = Date.now();
      status = "error";
      isPlaceholderData = false;
    }
    const isFetching = newState.fetchStatus === "fetching";
    const isPending = status === "pending";
    const isError = status === "error";
    const isLoading = isPending && isFetching;
    const hasData = data !== void 0;
    return {
      status,
      fetchStatus: newState.fetchStatus,
      isPending,
      isSuccess: status === "success",
      isError,
      isInitialLoading: isLoading,
      isLoading,
      data,
      dataUpdatedAt: newState.dataUpdatedAt,
      error,
      errorUpdatedAt,
      failureCount: newState.fetchFailureCount,
      failureReason: newState.fetchFailureReason,
      errorUpdateCount: newState.errorUpdateCount,
      isFetched: query.isFetched(),
      isFetchedAfterMount:
        newState.dataUpdateCount > queryInitialState.dataUpdateCount ||
        newState.errorUpdateCount > queryInitialState.errorUpdateCount,
      isFetching,
      isRefetching: isFetching && !isPending,
      isLoadingError: isError && !hasData,
      isPaused: newState.fetchStatus === "paused",
      isPlaceholderData,
      isRefetchError: isError && hasData,
      isStale: isStale(query, options),
      refetch: this.refetch,
      isEnabled: resolveQueryValue(options.enabled, query) !== false,
    };
  }
  /**
   * Recomputes and stores the current result from the current query/options, notifying listeners
   * if it changed. Framework adapters call this right after subscribing to make sure no query
   * update was missed in the gap between creating the observer and subscribing to it.
   */
  updateResult() {
    const prevResult = this.#currentResult;
    const nextResult = this.createResult(this.#currentQuery, this.options);
    this.#currentResultState = this.#currentQuery.state;
    this.#currentResultOptions = this.options;
    if (this.#currentResultState.data !== void 0)
      this.#lastQueryWithDefinedData = this.#currentQuery;
    if (shallowEqualObjects(nextResult, prevResult)) return;
    this.#currentResult = nextResult;
    const shouldNotifyListeners = () => {
      if (!prevResult) return true;
      const { notifyOnChangeProps } = this.options;
      const notifyOnChangePropsValue =
        typeof notifyOnChangeProps === "function" ? notifyOnChangeProps() : notifyOnChangeProps;
      if (
        notifyOnChangePropsValue === "all" ||
        (!notifyOnChangePropsValue && !this.#trackedProps.size)
      )
        return true;
      const includedProps = new Set(notifyOnChangePropsValue ?? this.#trackedProps);
      if (this.options.throwOnError) includedProps.add("error");
      return Object.keys(this.#currentResult).some((key) => {
        const typedKey = key;
        return (
          this.#currentResult[typedKey] !== prevResult[typedKey] && includedProps.has(typedKey)
        );
      });
    };
    const notifyListeners = shouldNotifyListeners();
    notifyManager.batch(() => {
      if (notifyListeners)
        this.listeners.forEach((listener) => {
          listener(this.#currentResult);
        });
      this.#client.getQueryCache().notify({
        query: this.#currentQuery,
        type: "observerResultsUpdated",
      });
    });
  }
  #updateQuery() {
    const query = this.#client.getQueryCache().build(this.#client, this.options);
    if (query === this.#currentQuery) return;
    const prevQuery = this.#currentQuery;
    this.#currentQuery = query;
    this.#currentQueryInitialState = query.state;
    if (this.hasListeners()) {
      prevQuery?.removeObserver(this);
      query.addObserver(this);
    }
  }
  /** @internal */
  onQueryUpdate() {
    this.updateResult();
    if (this.hasListeners()) this.#updateTimers();
  }
};
function shouldLoadOnMount(query, options) {
  return (
    resolveQueryValue(options.enabled, query) !== false &&
    query.state.data === void 0 &&
    !(query.state.status === "error" && resolveQueryValue(options.retryOnMount, query) === false)
  );
}
function shouldFetchOnMount(query, options) {
  return (
    shouldLoadOnMount(query, options) ||
    (query.state.data !== void 0 && shouldFetchOn(query, options, options.refetchOnMount))
  );
}
function shouldFetchOn(query, options, field) {
  if (
    resolveQueryValue(options.enabled, query) !== false &&
    resolveQueryValue(options.staleTime, query) !== "static"
  ) {
    const value = resolveQueryValue(field, query);
    return value === "always" || (value !== false && isStale(query, options));
  }
  return false;
}
function shouldFetchOptionally(query, prevQuery, options, prevOptions) {
  return (
    (query !== prevQuery || resolveQueryValue(prevOptions.enabled, query) === false) &&
    (!options.suspense || query.state.status !== "error") &&
    isStale(query, options)
  );
}
function isStale(query, options) {
  return (
    resolveQueryValue(options.enabled, query) !== false &&
    query.isStaleByTime(resolveQueryValue(options.staleTime, query))
  );
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/IsRestoringProvider.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var IsRestoringContext = import_react.createContext(false);
/**
 * If you are using `PersistQueryClientProvider`, you can also use the `useIsRestoring` hook alongside it to
 * check if a restore is currently in progress. `useQuery` and friends also check this internally to avoid
 * race conditions between the restore and mounting queries.
 *
 * @returns `true` while a persisted client is being restored, `false` otherwise.
 */
var useIsRestoring = () => import_react.useContext(IsRestoringContext);
IsRestoringContext.Provider;
require_jsx_runtime();
/**
 * Resets any query errors within the boundary, so queries know they can try again.
 */
function createValue() {
  let isReset = false;
  return {
    /**
     * Clears the reset state, so queries know not to try again until the boundary is reset again.
     */
    clearReset: () => {
      isReset = false;
    },
    /**
     * Resets any query errors within the boundary, so queries know they can try again.
     */
    reset: () => {
      isReset = true;
    },
    /**
     * Returns whether the boundary has been reset and not yet cleared.
     */
    isReset: () => {
      return isReset;
    },
  };
}
var QueryErrorResetBoundaryContext = import_react.createContext(createValue());
/**
 * This hook will reset any query errors within the closest `QueryErrorResetBoundary`. If there is no boundary
 * defined it will reset them globally.
 *
 * @returns The boundary's {@link QueryErrorResetBoundaryValue}.
 *
 * @example
 * ```tsx
 * import { ErrorBoundary } from 'react-error-boundary'
 * import { useQueryErrorResetBoundary } from '@tanstack/react-query'
 *
 * function App({ children }: { children: React.ReactNode }) {
 *   const { reset } = useQueryErrorResetBoundary()
 *
 *   return (
 *     <ErrorBoundary
 *       onReset={reset}
 *       fallbackRender={({ resetErrorBoundary }) => (
 *         <div>
 *           There was an error!
 *           <button onClick={() => resetErrorBoundary()}>Try again</button>
 *         </div>
 *       )}
 *     >
 *       {children}
 *     </ErrorBoundary>
 *   )
 * }
 * ```
 */
var useQueryErrorResetBoundary = () => import_react.useContext(QueryErrorResetBoundaryContext);
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/errorBoundaryUtils.js
var ensurePreventErrorBoundaryRetry = (options, errorResetBoundary, query) => {
  const throwOnError =
    query?.state.error && typeof options.throwOnError === "function"
      ? shouldThrowError(options.throwOnError, [query.state.error, query])
      : options.throwOnError;
  if (options.suspense || throwOnError) {
    if (!errorResetBoundary.isReset()) options.retryOnMount = false;
  }
};
var useClearResetErrorBoundary = (errorResetBoundary) => {
  import_react.useEffect(() => {
    errorResetBoundary.clearReset();
  }, [errorResetBoundary]);
};
var getHasError = ({ result, errorResetBoundary, throwOnError, query, suspense }) => {
  return (
    result.isError &&
    !errorResetBoundary.isReset() &&
    !result.isFetching &&
    query &&
    ((suspense && result.data === void 0) || shouldThrowError(throwOnError, [result.error, query]))
  );
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/suspense.js
var defaultThrowOnError = (_error, query) => query.state.data === void 0;
var ensureSuspenseTimers = (defaultedOptions) => {
  if (defaultedOptions.suspense) {
    const MIN_SUSPENSE_TIME_MS = 1e3;
    const clamp = (value) =>
      value === "static" ? value : Math.max(value ?? MIN_SUSPENSE_TIME_MS, MIN_SUSPENSE_TIME_MS);
    const originalStaleTime = defaultedOptions.staleTime;
    defaultedOptions.staleTime =
      typeof originalStaleTime === "function"
        ? (...args) => clamp(originalStaleTime(...args))
        : clamp(originalStaleTime);
    if (typeof defaultedOptions.gcTime === "number")
      defaultedOptions.gcTime = Math.max(defaultedOptions.gcTime, MIN_SUSPENSE_TIME_MS);
  }
};
var shouldSuspend = (defaultedOptions, result) => defaultedOptions?.suspense && result.isPending;
var fetchOptimistic = (defaultedOptions, observer, errorResetBoundary) =>
  observer.fetchOptimistic(defaultedOptions).catch(() => {
    errorResetBoundary.clearReset();
  });
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/useBaseQuery.js
function useBaseQuery(options, Observer, queryClient) {
  const isRestoring = useIsRestoring();
  const errorResetBoundary = useQueryErrorResetBoundary();
  const client = useQueryClient(queryClient);
  const defaultedOptions = client.defaultQueryOptions(options);
  const query = client.getQueryCache().get(defaultedOptions.queryHash);
  const subscribed = options.subscribed !== false;
  defaultedOptions._optimisticResults = isRestoring
    ? "isRestoring"
    : subscribed
      ? "optimistic"
      : void 0;
  ensureSuspenseTimers(defaultedOptions);
  ensurePreventErrorBoundaryRetry(defaultedOptions, errorResetBoundary, query);
  useClearResetErrorBoundary(errorResetBoundary);
  const [observer] = import_react.useState(() => new Observer(client, defaultedOptions));
  const result = observer.getOptimisticResult(defaultedOptions);
  const shouldSubscribe = !isRestoring && subscribed;
  import_react.useSyncExternalStore(
    import_react.useCallback(
      (onStoreChange) => {
        const unsubscribe = shouldSubscribe
          ? observer.subscribe(notifyManager.batchCalls(onStoreChange))
          : noop;
        observer.updateResult();
        return unsubscribe;
      },
      [observer, shouldSubscribe],
    ),
    () => observer.getCurrentResult(),
    () => observer.getCurrentResult(),
  );
  import_react.useEffect(() => {
    observer.setOptions(defaultedOptions);
  }, [defaultedOptions, observer]);
  if (shouldSuspend(defaultedOptions, result))
    throw fetchOptimistic(defaultedOptions, observer, errorResetBoundary);
  if (
    getHasError({
      result,
      errorResetBoundary,
      throwOnError: defaultedOptions.throwOnError,
      query,
      suspense: defaultedOptions.suspense,
    })
  )
    throw result.error;
  return !defaultedOptions.notifyOnChangeProps ? observer.trackResult(result) : result;
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/queryOptions.js
function queryOptions(options) {
  return options;
}
//#endregion
export {
  Query as a,
  QueryObserver as i,
  useBaseQuery as n,
  hasNextPage as o,
  defaultThrowOnError as r,
  hasPreviousPage as s,
  queryOptions as t,
};
