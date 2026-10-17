import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { L as money } from "./inputs-CH80xucg.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import { t as useQuery } from "./useQuery-D4rdH9-y.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, r as focusFirstInvalid, t as Alert } from "./alert-Cl5zWfQH.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as branchesQuery } from "./detail-BqLEd-GC.js";
import { t as Kbd } from "./kbd-DLpSQiun.js";
import { t as Store } from "./store-Dsr3zRui.js";
import { t as permissionsQuery } from "./permissions--dOQAlW8.js";
import { a as storeFormSchema, i as emptyStore, o as storeValues } from "./management-BtgoPGrQ.js";
import {
  U as EmptyList,
  W as ReadOnlyNote,
  _ as storesQuery,
  g as deleteMessage,
  v as useDeleteStore,
  y as useSaveStore,
} from "./router-Dr1B-bFG.js";
import { i as useShortcuts, t as useOnline } from "./online-Bubx-X8y.js";
import {
  a as PageHeader,
  i as editButtonId,
  n as RowActions,
  o as FormFooter,
  r as deleteButtonId,
  s as FormSheet,
  t as usePanel,
} from "./panel-Dq4364QD.js";
import { t as ConfirmDialog } from "./dialog-BbHRqHuf.js";
import { t as Money } from "./money-DGt5dT2g.js";
//#region ../../packages/backoffice/src/components/stores/delete/dialog.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function DeleteStoreDialog({ store, open, onOpenChange, branchCount, restoreFocus }) {
  const remove = useDeleteStore(() => onOpenChange(false));
  const name = store?.name ?? "this store";
  const blocked =
    branchCount && branchCount > 0
      ? `${name} still has ${branchCount} ${branchCount === 1 ? "branch" : "branches"}. Delete or move ${branchCount === 1 ? "it" : "them"} first.`
      : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmDialog, {
    open,
    onOpenChange: (next) => {
      if (!next) remove.reset();
      onOpenChange(next);
    },
    title: `Delete ${name}?`,
    description: "This removes the store. It can't be undone.",
    confirmLabel: "Delete store",
    blocked,
    error: remove.error ? deleteMessage(remove.error, name) : void 0,
    pending: remove.isPending,
    onConfirm: () => store && remove.mutate(store),
    restoreFocus,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/stores/form.tsx
function StoreForm({ store, onSaved }) {
  const online = useOnline();
  const save = useSaveStore(store, onSaved);
  const form = useForm({
    defaultValues: store ? storeValues(store) : emptyStore,
    validators: { onSubmit: storeFormSchema },
    onSubmit: ({ value }) => save.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !save.isPending) form.handleSubmit();
    },
  });
  const clearError = () => {
    if (save.isError) save.reset();
  };
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
                onChange: clearError,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "cashRounding",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "Cash rounding (GH₵)",
                description: "The smallest amount a cash total is rounded to, like 0.05.",
                inputMode: "decimal",
                autoComplete: "off",
                onChange: clearError,
              }),
          }),
          save.error &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
              variant: "destructive",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                  children: save.error.message,
                }),
              ],
            }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormFooter, {
        label: "Save store",
        pending: save.isPending,
        online,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/stores/table.tsx
function StoreTable({ stores, onEdit, onDelete }) {
  const columns = [
    {
      id: "name",
      header: "Store",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "rounding",
      header: "Cash rounding",
      meta: { align: "right" },
      cell: ({ row }) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Money, {
          amount: money(row.original.cashRoundingStep),
        }),
    },
  ];
  if (onEdit || onDelete)
    columns.push({
      id: "actions",
      header: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "sr-only",
          children: "Actions",
        }),
      cell: ({ row }) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RowActions, {
          id: row.original.id,
          name: row.original.name,
          onEdit: onEdit && (() => onEdit(row.original)),
          onDelete: onDelete && (() => onDelete(row.original)),
        }),
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
    label: "Stores",
    columns,
    data: stores,
    getRowId: (store) => store.id,
    className: "min-h-0",
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/stores/screen.tsx
function StoresScreen() {
  const { data: stores } = useSuspenseQuery(storesQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: branches } = useQuery(branchesQuery());
  const addRef = (0, import_react.useRef)(null);
  const form = usePanel(addRef);
  const removal = usePanel(addRef);
  const noPanelOpen = !form.open && !removal.open;
  const canWrite = held.includes("store.write");
  const shortcuts = useShortcuts({ N: () => canWrite && noPanelOpen && form.show() });
  const isEmpty = stores.length === 0;
  const branchCount = (store) =>
    branches && store ? branches.filter((branch) => branch.storeId === store.id).length : null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex min-h-0 flex-1 flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
        title: "Stores",
        action:
          isEmpty || !canWrite
            ? void 0
            : {
                label: "Add store",
                shortcut: "N",
                onClick: () => form.show(),
                ref: addRef,
              },
      }),
      !canWrite &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadOnlyNote, {
          children: "You can view stores. Ask an owner for permission to make changes.",
        }),
      isEmpty
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyList, {
            icon: Store,
            title: "No stores yet",
            description:
              "A store groups your branches and sets how cash totals are rounded. Add one to start.",
            children:
              canWrite &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                ref: addRef,
                onClick: () => form.show(),
                children: [
                  "Add store",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                    "aria-hidden": true,
                    children: "N",
                  }),
                ],
              }),
          })
        : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StoreTable, {
            stores,
            onEdit: canWrite ? (store) => form.show(store, editButtonId(store.id)) : void 0,
            onDelete: canWrite ? (store) => removal.show(store, deleteButtonId(store.id)) : void 0,
          }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: form.open,
        onOpenChange: form.setOpen,
        title: form.value ? "Edit store" : "New store",
        description: form.value
          ? "Change the name or how cash is rounded."
          : "Give the store a name.",
        restoreFocus: form.restoreFocus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          StoreForm,
          {
            store: form.value,
            onSaved: () => form.setOpen(false),
          },
          form.value?.id ?? "new",
        ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeleteStoreDialog, {
        store: removal.value,
        open: removal.open,
        onOpenChange: removal.setOpen,
        branchCount: branchCount(removal.value),
        restoreFocus: removal.restoreFocus,
      }),
    ],
  });
}
//#endregion
export { StoresScreen };
