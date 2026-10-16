import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { L as money } from "./inputs-CH80xucg.js";
import { t as useRouter } from "./useRouter-DvEAwN-p.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import {
  i as QueryObserver,
  n as useBaseQuery,
  o as hasNextPage,
  r as defaultThrowOnError,
  s as hasPreviousPage,
} from "./queryOptions-eKLVKX7x.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, r as focusFirstInvalid, t as Alert } from "./alert-Cl5zWfQH.js";
import {
  a as SelectTrigger,
  i as SelectItem,
  n as Select,
  o as SelectValue,
  r as SelectContent,
  t as SelectField,
} from "./select-DQI7SO7u.js";
import {
  a as FieldGroup,
  d as CircleAlert,
  o as FieldLabel,
  t as Field,
} from "./field-C8_3jRPt.js";
import { d as Search } from "./popover-BEG8WX3O.js";
import { t as Kbd } from "./kbd-DLpSQiun.js";
import {
  i as newProductSchema,
  n as fieldOfError,
  r as messageOfError,
  t as emptyProduct,
} from "./catalogue-BxH-8PyC.js";
import {
  G as categoriesQuery,
  J as useCreateProduct,
  K as productsQuery,
  X as NoMatch,
  Y as EmptyCatalogue,
  Z as TableSkeleton,
  et as useNavigate,
  tt as useSearch,
} from "./router-Dr1B-bFG.js";
import { i as useShortcuts, n as MOD_KEY, t as useOnline } from "./online-Bubx-X8y.js";
import {
  a as SheetFooter,
  i as SheetDescription,
  n as SheetClose,
  o as SheetHeader,
  r as SheetContent,
  s as SheetTitle,
  t as Sheet,
} from "./sheet-Dp4G9a56.js";
import { n as UNITS, r as CategoryCombobox, t as TAX_CLASSES } from "./options-0CYuL_zN.js";
import { t as Money } from "./money-DGt5dT2g.js";
import { t as Badge } from "./badge-C1R2IFYz.js";
import {
  i as InputGroupInput,
  n as InputGroup,
  r as InputGroupAddon,
  t as useDebouncedCallback,
} from "./callback-xJkOzKSk.js";
//#region ../../node_modules/.pnpm/@tanstack+query-core@5.103.3/node_modules/@tanstack/query-core/build/modern/infiniteQueryObserver.js
/**
 * An `InfiniteQueryObserver` extends `QueryObserver` to observe and switch
 * between infinite queries. It augments the base `QueryObserverResult` with
 * infinite-query-specific fields and methods, such as `hasNextPage` and
 * `fetchNextPage`, and is the primitive that framework adapters (e.g.
 * `useInfiniteQuery`) build their hooks on top of.
 *
 * @example
 * ```ts
 * const observer = new InfiniteQueryObserver(queryClient, {
 *   queryKey: ['projects'],
 *   queryFn: ({ pageParam }) => fetchProjects(pageParam),
 *   initialPageParam: 0,
 *   getNextPageParam: (lastPage) => lastPage.nextCursor,
 * })
 *
 * const unsubscribe = observer.subscribe((result) => console.log(result))
 * ```
 */
var InfiniteQueryObserver = class extends QueryObserver {
  constructor(client, options) {
    super(client, options);
  }
  bindMethods() {
    super.bindMethods();
    this.fetchNextPage = this.fetchNextPage.bind(this);
    this.fetchPreviousPage = this.fetchPreviousPage.bind(this);
  }
  /**
   * Updates the observer's options. Behaves the same as
   * `QueryObserver.setOptions`, additionally marking the options as
   * belonging to an infinite query before delegating to the base
   * implementation.
   */
  setOptions(options) {
    options._type = "infinite";
    super.setOptions(options);
  }
  /**
   * The infinite-query counterpart of {@link QueryObserver#getOptimisticResult}, marking the
   * options as an infinite query before delegating to it. Called by framework adapters (e.g.
   * `useInfiniteQuery`) ahead of subscribing, to compute the current `InfiniteQueryObserverResult`
   * synchronously.
   */
  getOptimisticResult(options) {
    options._type = "infinite";
    return super.getOptimisticResult(options);
  }
  /**
   * Fetches the next page of the infinite query and returns a promise that
   * resolves with the resulting `InfiniteQueryObserverResult`. The page
   * param used for the fetch is determined by `getNextPageParam`, which
   * receives the current pages/page params and whose result also determines
   * `hasNextPage`.
   *
   * @example
   * ```ts
   * const { hasNextPage } = observer.getCurrentResult()
   *
   * if (hasNextPage) {
   *   await observer.fetchNextPage()
   * }
   * ```
   *
   * @see {@link InfiniteQueryObserver#fetchPreviousPage}
   */
  fetchNextPage(options) {
    return this.fetch({
      ...options,
      meta: { fetchMore: { direction: "forward" } },
    });
  }
  /**
   * Fetches the previous page of the infinite query and returns a promise
   * that resolves with the resulting `InfiniteQueryObserverResult`. The page
   * param used for the fetch is determined by `getPreviousPageParam`, which
   * receives the current pages/page params and whose result also determines
   * `hasPreviousPage`.
   *
   * @example
   * ```ts
   * const { hasPreviousPage } = observer.getCurrentResult()
   *
   * if (hasPreviousPage) {
   *   await observer.fetchPreviousPage()
   * }
   * ```
   *
   * @see {@link InfiniteQueryObserver#fetchNextPage}
   */
  fetchPreviousPage(options) {
    return this.fetch({
      ...options,
      meta: { fetchMore: { direction: "backward" } },
    });
  }
  createResult(query, options) {
    const { state } = query;
    const parentResult = super.createResult(query, options);
    const { isFetching, isRefetching, isError, isRefetchError } = parentResult;
    const fetchDirection = state.fetchMeta?.fetchMore?.direction;
    const isFetchNextPageError = isError && fetchDirection === "forward";
    const isFetchingNextPage = isFetching && fetchDirection === "forward";
    const isFetchPreviousPageError = isError && fetchDirection === "backward";
    const isFetchingPreviousPage = isFetching && fetchDirection === "backward";
    return {
      ...parentResult,
      fetchNextPage: this.fetchNextPage,
      fetchPreviousPage: this.fetchPreviousPage,
      hasNextPage: hasNextPage(options, state.data),
      hasPreviousPage: hasPreviousPage(options, state.data),
      isFetchNextPageError,
      isFetchingNextPage,
      isFetchPreviousPageError,
      isFetchingPreviousPage,
      isRefetchError: isRefetchError && !isFetchNextPageError && !isFetchPreviousPageError,
      isRefetching: isRefetching && !isFetchingNextPage && !isFetchingPreviousPage,
    };
  }
};
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/useSuspenseInfiniteQuery.js
/**
 * The options for `useSuspenseInfiniteQuery` are the same as for `useInfiniteQuery`, except for `throwOnError`,
 * `enabled`, and `placeholderData`.
 *
 * Caveat: cancellation does not work.
 *
 * @remarks Multiple suspenseful query calls in the same component suspend serially, causing a request
 * waterfall — each one blocks rendering until it resolves, so the next doesn't even start fetching until
 * then. There's no way to parallelize multiple infinite queries under Suspense. Also keep in mind that
 * imperative fetch calls, such as `fetchNextPage`, may interfere with the default refetch behavior,
 * resulting in outdated data. Make sure to call these functions only in response to user actions, or add
 * conditions like `hasNextPage && !isFetching`.
 * @see {@link useInfiniteQuery} for the non-Suspense version of this hook.
 * @param options - The {@link UseSuspenseInfiniteQueryOptions} to use — the same options as `useInfiniteQuery`, minus the ones listed above.
 * @param queryClient - Use this to use a custom `QueryClient`. Otherwise, the one from the nearest context will
 * be used.
 * @returns The same object as `useInfiniteQuery`, except that `data` is guaranteed to be defined,
 * `isPlaceholderData` is missing, and `status` is either `success` or `error` (with the derived flags set
 * accordingly).
 *
 * @example
 * The query error is thrown if a fetch fails and no cached data exists yet, so an error boundary is
 * required around `<Suspense>`. A failed background refetch instead continues to render the cached data.
 * Use {@link QueryErrorResetBoundary} to let the user retry after such an error:
 * ```tsx
 * import { Suspense } from 'react'
 * import { ErrorBoundary } from 'react-error-boundary'
 * import {
 *   QueryErrorResetBoundary,
 *   useSuspenseInfiniteQuery,
 * } from '@tanstack/react-query'
 *
 * function Projects() {
 *   // `data` is guaranteed to be defined here — no `isPending` check needed.
 *   const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage } =
 *     useSuspenseInfiniteQuery({
 *       queryKey: ['projects'],
 *       queryFn: ({ pageParam }) => fetchProjects(pageParam),
 *       initialPageParam: 0,
 *       getNextPageParam: (lastPage) => lastPage.nextId,
 *     })
 *
 *   return (
 *     <div>
 *       <ul>
 *         {data.pages.map((page) =>
 *           page.projects.map((project) => <li key={project.id}>{project.name}</li>),
 *         )}
 *       </ul>
 *       <button
 *         onClick={() => fetchNextPage()}
 *         disabled={!hasNextPage || isFetching}
 *       >
 *         {isFetchingNextPage
 *           ? 'Loading more...'
 *           : hasNextPage
 *             ? 'Load More'
 *             : 'Nothing more to load'}
 *       </button>
 *     </div>
 *   )
 * }
 *
 * function App() {
 *   return (
 *     <QueryErrorResetBoundary>
 *       {({ reset }) => (
 *         <ErrorBoundary
 *           onReset={reset}
 *           fallbackRender={({ resetErrorBoundary }) => (
 *             <div>
 *               There was an error!
 *               <button onClick={() => resetErrorBoundary()}>Try again</button>
 *             </div>
 *           )}
 *         >
 *           <Suspense fallback={<h1>Loading projects...</h1>}>
 *             <Projects />
 *           </Suspense>
 *         </ErrorBoundary>
 *       )}
 *     </QueryErrorResetBoundary>
 *   )
 * }
 * ```
 */
function useSuspenseInfiniteQuery(options, queryClient) {
  return useBaseQuery(
    {
      ...options,
      enabled: true,
      suspense: true,
      throwOnError: defaultThrowOnError,
      placeholderData: void 0,
    },
    InfiniteQueryObserver,
    queryClient,
  );
}
//#endregion
//#region ../../node_modules/.pnpm/@tanstack+react-query@5.103.3_react@19.3.0/node_modules/@tanstack/react-query/build/modern/useInfiniteQuery.js
function useInfiniteQuery(options, queryClient) {
  return useBaseQuery(options, InfiniteQueryObserver, queryClient);
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/list/create/form.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
var OFFLINE_NOTE_ID = "save-offline-note";
function NewProductForm({ onCreated }) {
  const online = useOnline();
  const create = useCreateProduct(onCreated);
  const form = useForm({
    defaultValues: emptyProduct,
    validators: { onSubmit: newProductSchema },
    onSubmit: ({ value }) => create.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !create.isPending) form.handleSubmit();
    },
  });
  const clearError = () => {
    if (create.isError) create.reset();
  };
  const failedField = fieldOfError(create.error);
  const failure = (name) =>
    failedField === name && create.error ? messageOfError(create.error) : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
    ref: shortcuts,
    noValidate: true,
    className: "flex min-h-0 flex-1 flex-col",
    onSubmit: (event) => {
      event.preventDefault();
      form.handleSubmit();
    },
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FieldGroup, {
        className: "flex-1 overflow-y-auto px-4",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "name",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "Name",
                autoFocus: true,
                autoComplete: "off",
                serverError: failure("name"),
                onChange: clearError,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "sku",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "SKU",
                autoComplete: "off",
                autoCapitalize: "characters",
                spellCheck: false,
                serverError: failure("sku"),
                onChange: clearError,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "baseUnit",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Unit",
                options: UNITS,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "taxClass",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Tax class",
                options: TAX_CLASSES,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "categoryId",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldLabel, {
                    htmlFor: field.name,
                    children: "Category",
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CategoryCombobox, {
                    id: field.name,
                    value: field.state.value ?? null,
                    onChange: field.handleChange,
                  }),
                ],
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "barcode",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "Barcode",
                description: "Optional. Scan it or type the code.",
                autoComplete: "off",
                inputMode: "numeric",
                serverError: failure("barcode"),
                onChange: clearError,
              }),
          }),
          create.error &&
            !failedField &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
              variant: "destructive",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                  children: create.error.message,
                }),
              ],
            }),
        ],
      }),
      !online &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          id: OFFLINE_NOTE_ID,
          className: "px-4 text-sm text-muted-foreground",
          children: "You're offline. Reconnect to save this product.",
        }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetFooter, {
        className: "flex-col-reverse sm:flex-row sm:justify-end",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetClose, {
            asChild: true,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              type: "button",
              variant: "outline",
              children: "Cancel",
            }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            type: "submit",
            disabled: !online || create.isPending,
            "aria-describedby": online ? void 0 : OFFLINE_NOTE_ID,
            children: create.isPending
              ? "Saving…"
              : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
                  children: [
                    "Save product",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Kbd, {
                      "aria-hidden": true,
                      children: [MOD_KEY, " ↵"],
                    }),
                  ],
                }),
          }),
        ],
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/list/create/sheet.tsx
function NewProductSheet({ open, onOpenChange, addRef }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
    open,
    onOpenChange,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
      className: "sm:max-w-md",
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        addRef.current?.focus();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: "New product" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, {
              children: "Add the basics now. You can set prices next.",
            }),
          ],
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewProductForm, {
          onCreated: () => onOpenChange(false),
        }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/list/table.tsx
var DESKTOP_ONLY = "hidden md:table-cell";
function ProductTable({ products, categories, onEndReached }) {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
    label: "Products",
    columns: [
      {
        id: "product",
        header: "Product",
        meta: { className: "whitespace-normal" },
        cell: ({ row }) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-col",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                to: "/products/$productId",
                params: { productId: row.original.id },
                className: "w-fit font-medium hover:underline",
                children: row.original.name,
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                className: "text-xs text-muted-foreground",
                children: row.original.sku,
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
                className: "text-xs text-muted-foreground md:hidden",
                children: [
                  unitLabel(row.original),
                  " ·",
                  " ",
                  categoryName.get(row.original.categoryId ?? "") ?? "No category",
                ],
              }),
            ],
          }),
      },
      {
        id: "category",
        header: "Category",
        meta: { className: DESKTOP_ONLY },
        cell: ({ row }) =>
          categoryName.get(row.original.categoryId ?? "") ??
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Muted, { children: "No category" }),
      },
      {
        id: "unit",
        header: "Unit",
        meta: { className: DESKTOP_ONLY },
        cell: ({ row }) => unitLabel(row.original),
      },
      {
        id: "price",
        header: "Price",
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.price === null
            ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Muted, { children: "No price" })
            : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
                amount: money(row.original.price),
                className: "font-medium",
              }),
      },
      {
        id: "tax",
        header: "Tax class",
        meta: { className: DESKTOP_ONLY },
        cell: ({ row }) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
            variant: "secondary",
            children: TAX_CLASSES.find((tax) => tax.value === row.original.taxClass)?.label,
          }),
      },
      {
        id: "online",
        header: "Online",
        meta: { className: DESKTOP_ONLY },
        cell: ({ row }) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
            variant: row.original.onlineVisible ? "default" : "outline",
            children: row.original.onlineVisible ? "Online" : "Store only",
          }),
      },
    ],
    data: products,
    getRowId: (product) => product.id,
    onEndReached,
    className: "min-h-0",
  });
}
function Muted({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
    className: "text-muted-foreground",
    children,
  });
}
function unitLabel(product) {
  return UNITS.find((unit) => unit.value === product.baseUnit)?.label;
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/list/results.tsx
/** The part of the screen that waits for products: the table, or the state that stands in for it. */
function ProductResults({ search, categories, addRef, onAdd, onClear }) {
  const query = productsQuery(search);
  const { data, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } =
    useSuspenseInfiniteQuery(query);
  const products = data.pages.flatMap((page) => page.items);
  if (products.length === 0)
    return search.q || search.categoryId
      ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NoMatch, {
          query: search.q,
          onClear,
        })
      : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyCatalogue, {
          onAdd,
          addRef,
        });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        ProductTable,
        {
          products,
          categories,
          onEndReached: () =>
            hasNextPage && !isFetchingNextPage && !isFetchNextPageError && void fetchNextPage(),
        },
        query.queryKey.join("|"),
      ),
      isFetchNextPageError &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
          variant: "destructive",
          className: "flex items-center gap-3",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
              className: "flex-1",
              children: "Couldn't load more products.",
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              variant: "outline",
              size: "sm",
              onClick: () => void fetchNextPage(),
              children: "Retry",
            }),
          ],
        }),
      isFetchingNextPage &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          role: "status",
          className: "text-center text-sm text-muted-foreground",
          children: "Loading more products…",
        }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/list/toolbar.tsx
var ALL = "all";
function ProductToolbar({
  text,
  onTextChange,
  searchRef,
  categories,
  categoryId,
  onCategoryChange,
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex flex-wrap gap-3",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InputGroup, {
        className: "min-w-0 flex-1 basis-64",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputGroupAddon, {
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { "aria-hidden": true }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputGroupInput, {
            ref: searchRef,
            value: text,
            onChange: (event) => onTextChange(event.target.value),
            placeholder: "Name, SKU or barcode",
            "aria-label": "Search products",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InputGroupAddon, {
            align: "inline-end",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
              "aria-hidden": true,
              children: "/",
            }),
          }),
        ],
      }),
      categories.length > 0 &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
          value: categoryId ?? ALL,
          onValueChange: (value) => onCategoryChange(value === ALL ? void 0 : value),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
              "aria-label": "Filter by category",
              className: "w-full sm:w-52",
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {}),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SelectContent, {
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
                  value: ALL,
                  children: "All categories",
                }),
                categories.map((category) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    SelectItem,
                    {
                      value: category.id,
                      children: category.name,
                    },
                    category.id,
                  ),
                ),
              ],
            }),
          ],
        }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/hooks/catalogue/list/search.ts
var SEARCH_DEBOUNCE_MS = 250;
/** The search box text, kept in `?q` a moment after typing stops (replace: no history per keystroke). */
function useProductSearch(search) {
  const navigate = useNavigate();
  const router = useRouter();
  const [text, setText] = (0, import_react.useState)(search.q ?? "");
  const [seenQuery, setSeenQuery] = (0, import_react.useState)(search.q);
  if (search.q !== seenQuery) {
    setSeenQuery(search.q);
    if ((search.q ?? "") !== text.trim()) setText(search.q ?? "");
  }
  const update = (patch) =>
    navigate({
      to: "/products",
      search: (previous) => ({
        ...previous,
        ...patch,
      }),
      replace: true,
    });
  const setQuery = useDebouncedCallback((value) => {
    if (router.state.location.pathname === "/products") update({ q: value.trim() || void 0 });
  }, SEARCH_DEBOUNCE_MS);
  return {
    text,
    onTextChange: (value) => {
      setText(value);
      setQuery(value);
    },
    onCategoryChange: (categoryId) => void update({ categoryId }),
    clear: () => {
      setQuery.cancel();
      setText("");
      update({
        q: void 0,
        categoryId: void 0,
      });
    },
  };
}
//#endregion
//#region ../../packages/backoffice/src/hooks/catalogue/list/shortcuts.ts
/** N starts a new product; "/" jumps to the product search. Attach the ref to the screen's root. */
function useProductsShortcuts(actions) {
  return useShortcuts({
    N: actions.newProduct,
    "/": actions.focusSearch,
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/catalogue/list/screen.tsx
function ProductsScreen() {
  const search = useSearch({ from: "/_shop/products" });
  const { data: categories } = useSuspenseQuery(categoriesQuery());
  const { data: loaded } = useInfiniteQuery(productsQuery(search));
  const [sheetOpen, setSheetOpen] = (0, import_react.useState)(false);
  const searchRef = (0, import_react.useRef)(null);
  const addRef = (0, import_react.useRef)(null);
  const searchState = useProductSearch(search);
  const shortcuts = useProductsShortcuts({
    newProduct: () => setSheetOpen(true),
    focusSearch: () => searchRef.current?.focus(),
  });
  const isEmptyCatalogue = !(search.q || search.categoryId) && loaded?.pages[0]?.items.length === 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex min-h-0 flex-1 flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex items-center justify-between gap-4",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
            className: "text-3xl font-bold tracking-tight",
            children: "Products",
          }),
          !isEmptyCatalogue &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              ref: addRef,
              onClick: () => setSheetOpen(true),
              children: [
                "Add product",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                  "aria-hidden": true,
                  children: "N",
                }),
              ],
            }),
        ],
      }),
      !isEmptyCatalogue &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductToolbar, {
          text: searchState.text,
          onTextChange: searchState.onTextChange,
          onCategoryChange: searchState.onCategoryChange,
          searchRef,
          categories,
          categoryId: search.categoryId,
        }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_react.Suspense, {
        fallback: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TableSkeleton, {}),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProductResults, {
          search,
          categories,
          addRef,
          onAdd: () => setSheetOpen(true),
          onClear: searchState.clear,
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NewProductSheet, {
        open: sheetOpen,
        onOpenChange: setSheetOpen,
        addRef,
      }),
    ],
  });
}
//#endregion
export { ProductsScreen };
