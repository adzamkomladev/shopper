import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime, w as is } from "./react-dom-BCYT53bd.js";
import { a as importUploadGrant, i as importContentType, s as sha256 } from "./schemas-D4eSiRMs.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import {
  c as Button,
  h as useMutation,
  n as ApiError,
  q as useQueryClient,
  r as apiFetch,
} from "./createLucideIcon-DmKyVZgg.js";
import { a as focusOnMount, n as AlertDescription, t as Alert } from "./alert-Cl5zWfQH.js";
import {
  d as CircleAlert,
  i as FieldError,
  r as FieldDescription,
  t as Field,
} from "./field-C8_3jRPt.js";
import { a as CardHeader, n as CardContent, t as Card } from "./card-Bdbyfds4.js";
import { i as importResult, r as importPreview } from "./schemas-B4d_8FW9.js";
import { i as toast, t as Kbd } from "./kbd-DLpSQiun.js";
import { t as CircleCheck } from "./circle-check-C_LeQUoQ.js";
import { t as LoaderCircle } from "./loader-circle-CGIjpJGj.js";
import { t as Upload } from "./upload-CJ_Elxe7.js";
import { i as useShortcuts, n as MOD_KEY, t as useOnline } from "./online-Bubx-X8y.js";
//#region ../../packages/backoffice/src/queries/catalogue/imports.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/** Upload once; the preview and final import use the same registered asset. */
function useCheckImport() {
  return useMutation({
    mutationFn: async (file) => {
      if (!globalThis.crypto?.subtle)
        throw new Error("Open the portal using HTTPS to upload files.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const grant = await apiFetch("/catalogue/imports/uploads", importUploadGrant, {
        method: "POST",
        body: {
          fileName: file.name,
          contentType: is(importContentType, file.type) ? file.type : "application/octet-stream",
          sizeBytes: file.size,
          sha256: await sha256(bytes),
        },
      });
      const sent = await fetch(grant.url, {
        method: grant.method,
        headers: grant.headers,
        body: bytes,
        credentials: "omit",
      }).catch(() => {
        throw new ApiError(0, "Couldn't send the file. Check your connection and try again.");
      });
      if (!sent.ok)
        throw new ApiError(
          sent.status,
          "Couldn't store the file. Choose the file again and retry.",
        );
      return {
        ...(await apiFetch("/catalogue/imports?dryRun=1", importPreview, {
          method: "POST",
          body: { assetId: grant.assetId },
        })),
        assetId: grant.assetId,
      };
    },
  });
}
var MAY_HAVE_FINISHED = "The import may have finished. Check Products before importing again.";
/** The real import. The lists are refetched either way: even a failed request may have written. */
function useRunImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (assetId) => {
      try {
        return await apiFetch("/catalogue/imports", importResult, {
          method: "POST",
          body: { assetId },
        });
      } catch (error) {
        throw unsureOutcome(error);
      }
    },
    onSuccess: (result) =>
      toast.success(
        result.rowsOk === 1 ? "1 product imported" : `${result.rowsOk} products imported`,
      ),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
      ]);
    },
  });
}
/** A dropped connection or an unreadable 2xx reply says nothing about whether the rows were written. */
function unsureOutcome(error) {
  if (!(error instanceof ApiError)) return error;
  if (error.status === 0)
    return new ApiError(0, `${error.message} ${MAY_HAVE_FINISHED}`, void 0, { cause: error });
  if (error.status < 300)
    return new ApiError(error.status, MAY_HAVE_FINISHED, void 0, { cause: error });
  return error;
}
/** What to tell the owner when a check or an import fails. */
function importFailure(error) {
  if (!(error instanceof ApiError)) return error.message;
  if (error.status === 403)
    return "You don't have permission to import products. Ask the shop owner.";
  if (error.status === 400)
    return `We couldn't read that file. Save it as .csv or .xlsx and try again. ${error.message}`;
  if (error.status === 413) return "That file is larger than 10 MB. Split it into smaller files.";
  if (error.status >= 500) return "Something went wrong on our side. Try again in a minute.";
  return error.message;
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/imports/file/drop.tsx
var import_jsx_runtime = require_jsx_runtime();
var ACCEPT = ".csv,.xlsx,.xls";
var SHEET_NAME = /\.(csv|xlsx|xls)$/i;
var KB = 1024;
var MB = KB * KB;
/** A drop zone around a native file input: dropping a file and picking one end up in the same place. */
function FileDrop({ file, onChoose, disabled }) {
  const input = (0, import_react.useRef)(null);
  const [dragging, setDragging] = (0, import_react.useState)(false);
  const [rejection, setRejection] = (0, import_react.useState)();
  function choose(files) {
    const picked = files?.[0] ?? null;
    const problem = picked && rejectionOf(picked);
    setRejection(problem || void 0);
    if (problem && input.current) input.current.value = "";
    onChoose(problem ? null : picked);
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    onDragOver: (event) => {
      event.preventDefault();
      if (!disabled) setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      const { files } = event.dataTransfer;
      if (disabled || !input.current || files.length === 0) return;
      if (files.length > 1) {
        setRejection("Drop one file at a time.");
        return;
      }
      input.current.files = files;
      choose(input.current.files);
    },
    "data-dragging": dragging,
    className:
      "flex flex-col items-center gap-6 rounded-xl border border-dashed bg-card px-6 py-10 text-center transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-accent",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
        className:
          "grid size-10 place-items-center rounded-lg border bg-background text-muted-foreground",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
          "aria-hidden": true,
          className: "size-5",
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-1",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "font-medium",
            children: "Drop a spreadsheet here",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "text-sm text-muted-foreground",
            children: "or choose one. CSV, XLSX or XLS, up to 10 MB.",
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Field, {
        "data-invalid": !!rejection,
        className: "max-w-sm items-center text-center",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
            ref: input,
            id: "spreadsheet",
            type: "file",
            accept: ACCEPT,
            disabled,
            "aria-invalid": !!rejection,
            "aria-describedby": rejection
              ? "spreadsheet-file spreadsheet-error"
              : "spreadsheet-file",
            onChange: (event) => choose(event.target.files),
            className: "peer sr-only",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            asChild: true,
            variant: "outline",
            className:
              "peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
              htmlFor: "spreadsheet",
              children: "Choose spreadsheet",
            }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldDescription, {
            id: "spreadsheet-file",
            children: file ? `${file.name} (${sizeOf(file.size)})` : "No file chosen yet.",
          }),
          rejection &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldError, {
              id: "spreadsheet-error",
              children: rejection,
            }),
        ],
      }),
    ],
  });
}
function rejectionOf(file) {
  if (!SHEET_NAME.test(file.name)) return "Choose a .csv, .xlsx or .xls file.";
  if (file.size > 10485760) return "That file is larger than 10 MB. Split it into smaller files.";
  return "";
}
/** Whole units only: 1536 -> "2 KB", 2.5 MB -> "2.5 MB", so no float ever prints. */
function sizeOf(bytes) {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
  const tenths = Math.round((bytes * 10) / MB);
  return `${Math.trunc(tenths / 10)}.${tenths % 10} MB`;
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/imports/done.tsx
function ImportDone({ result, onImportAnother }) {
  const counts = [
    ["Added", result.created],
    ["Updated", result.updated],
    ["Unchanged", result.unchanged],
    ["Prices added", result.pricesAdded],
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
    ref: focusOnMount,
    tabIndex: -1,
    role: "region",
    "aria-labelledby": "import-done-title",
    className: "outline-none",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardHeader, {
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
          id: "import-done-title",
          className: "flex items-center gap-2 leading-none font-semibold",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
              "aria-hidden": true,
              className: "size-5 text-primary",
            }),
            "Import finished",
          ],
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
        className: "flex flex-col gap-6",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
            className: "grid grid-cols-2 gap-4 sm:grid-cols-4",
            children: counts.map(([label, count]) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                "div",
                {
                  className: "flex flex-col gap-1",
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
                      className: "text-sm text-muted-foreground",
                      children: label,
                    }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
                      className: "text-2xl font-semibold tabular-nums",
                      children: count,
                    }),
                  ],
                },
                label,
              ),
            ),
          }),
          result.rowsFailed > 0 &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
              className: "text-sm text-muted-foreground",
              children: [
                result.rowsFailed === 1 ? "1 row" : `${result.rowsFailed} rows`,
                " with errors",
                " ",
                result.rowsFailed === 1 ? "was" : "were",
                " skipped.",
              ],
            }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                type: "button",
                variant: "outline",
                onClick: onImportAnother,
                children: "Import another file",
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                asChild: true,
                children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                  to: "/products",
                  children: "View products",
                }),
              }),
            ],
          }),
        ],
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/imports/report.tsx
var OFFLINE_NOTE_ID$1 = "import-offline-note";
var plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
var columns = [
  {
    id: "row",
    header: "Row",
    cell: ({ row }) => row.original.row,
  },
  {
    id: "column",
    header: "Column",
    meta: { className: "hidden md:table-cell" },
    cell: ({ row }) => row.original.column,
  },
  {
    id: "problem",
    header: "Problem",
    cell: ({ row }) =>
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col whitespace-normal",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
            className: "text-xs font-semibold md:hidden",
            children: row.original.column,
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: row.original.message }),
          row.original.value &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
              className: "text-xs break-all text-muted-foreground",
              children: ["In the file: ", row.original.value],
            }),
        ],
      }),
  },
];
/** What the dry run found: counts, the choice to import the good rows, then the bad rows. */
function ImportReport({ report, running, online, error, onRun, onChooseAnother }) {
  const empty = report.rowsTotal === 0;
  const none = report.rowsOk === 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: focusOnMount,
    tabIndex: -1,
    "aria-busy": running,
    className: "flex flex-col gap-6 outline-none",
    children: [
      empty
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                children:
                  "The file has no product rows. Add them under the header row, then choose it again.",
              }),
            ],
          })
        : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "flex flex-col gap-2",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
                className: "flex items-center gap-2 font-medium",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
                    "aria-hidden": true,
                    className: "size-5 text-primary",
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    children: plural(report.rowsOk, "row ready to import", "rows ready to import"),
                  }),
                ],
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
                className: "flex items-center gap-2 font-medium",
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
                    "aria-hidden": true,
                    className: report.rowsFailed
                      ? "size-5 text-destructive"
                      : "size-5 text-muted-foreground",
                  }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                    children: plural(report.rowsFailed, "row with errors", "rows with errors"),
                  }),
                ],
              }),
              !none &&
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
                  className: "text-sm text-muted-foreground",
                  children: [
                    "Importing adds ",
                    plural(report.created, "new product", "new products"),
                    ", updates",
                    " ",
                    report.updated,
                    " and leaves ",
                    report.unchanged,
                    " as they are.",
                    report.rowsFailed > 0 && " Rows with errors are skipped.",
                  ],
                }),
            ],
          }),
      none &&
        !empty &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
              children:
                "No row can be imported yet. Fix the rows below in your file, then choose it again.",
            }),
          ],
        }),
      error &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
          variant: "destructive",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
              children: importFailure(error),
            }),
          ],
        }),
      !online &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          id: OFFLINE_NOTE_ID$1,
          className: "text-sm text-muted-foreground",
          children: "You're offline. Reconnect to import.",
        }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-2 sm:flex-row",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            type: "button",
            disabled: none || running || !online,
            "aria-describedby": online ? void 0 : OFFLINE_NOTE_ID$1,
            onClick: onRun,
            children: running
              ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                      "aria-hidden": true,
                      className: "animate-spin",
                    }),
                    "Importing…",
                  ],
                })
              : none
                ? "Import products"
                : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
                    children: [
                      "Import ",
                      plural(report.rowsOk, "product", "products"),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Kbd, {
                        "aria-hidden": true,
                        children: [MOD_KEY, " ↵"],
                      }),
                    ],
                  }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            type: "button",
            variant: "outline",
            disabled: running,
            onClick: onChooseAnother,
            children: "Choose another file",
          }),
        ],
      }),
      report.errors.length > 0 &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
          className: "flex flex-col gap-2",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
              className: "text-lg font-semibold tracking-tight",
              children: "Rows to fix",
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
              label: "Rows with errors",
              columns,
              data: report.errors,
              getRowId: (error) => `${error.row}-${error.column}-${error.message}`,
              className: "max-h-96",
            }),
          ],
        }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/hooks/catalogue/imports/shortcuts.ts
/** Mod+Enter takes the next step: check the chosen file, then import it. Attach the ref to the screen's root. */
function useImportShortcuts(actions) {
  return useShortcuts({ "Mod+Enter": actions.next });
}
//#endregion
//#region ../../packages/backoffice/src/screens/catalogue/imports/screen.tsx
var OFFLINE_NOTE_ID = "check-offline-note";
var TITLE_ID = "import-title";
function ImportsScreen() {
  const online = useOnline();
  const [file, setFile] = (0, import_react.useState)(null);
  const check = useCheckImport();
  const run = useRunImport();
  const busy = check.isPending || run.isPending;
  const report = check.data;
  function choose(next) {
    setFile(next);
    check.reset();
  }
  function startOver() {
    choose(null);
    run.reset();
    document.getElementById(TITLE_ID)?.focus();
  }
  function next() {
    if (!online || busy || run.isSuccess || !file) return;
    if (!report) check.mutate(file);
    else if (report.rowsOk > 0) run.mutate(report.assetId);
  }
  const shortcuts = useImportShortcuts({ next });
  const describedBy =
    [!online && OFFLINE_NOTE_ID, !file && "spreadsheet-file spreadsheet-error"]
      .filter(Boolean)
      .join(" ") || void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-2",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
            id: TITLE_ID,
            ref: focusOnMount,
            tabIndex: -1,
            className: "text-3xl font-bold tracking-tight outline-none",
            children: "Import products",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "max-w-prose text-sm text-muted-foreground",
            children:
              "Add or update many products from a CSV or Excel file. Check it first: products change only when you import. Every file needs SKU, Name and Selling Price columns, and new products also need Tax Class.",
          }),
        ],
      }),
      run.data
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportDone, {
            result: run.data,
            onImportAnother: startOver,
          })
        : report
          ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImportReport, {
              report,
              running: run.isPending,
              online,
              error: run.error,
              onRun: next,
              onChooseAnother: startOver,
            })
          : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileDrop, {
                  file,
                  onChoose: choose,
                  disabled: busy,
                }),
                check.error &&
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
                    variant: "destructive",
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
                        "aria-hidden": true,
                      }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                        children: importFailure(check.error),
                      }),
                    ],
                  }),
                !online &&
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                    id: OFFLINE_NOTE_ID,
                    className: "text-sm text-muted-foreground",
                    children: "You're offline. Reconnect to check your file.",
                  }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                    type: "button",
                    disabled: !file || !online || check.isPending,
                    "aria-describedby": describedBy,
                    onClick: next,
                    children: check.isPending
                      ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                              "aria-hidden": true,
                              className: "animate-spin",
                            }),
                            "Checking…",
                          ],
                        })
                      : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
                          children: [
                            "Check file",
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Kbd, {
                              "aria-hidden": true,
                              children: [MOD_KEY, " ↵"],
                            }),
                          ],
                        }),
                  }),
                }),
              ],
            }),
    ],
  });
}
//#endregion
export { ImportsScreen };
