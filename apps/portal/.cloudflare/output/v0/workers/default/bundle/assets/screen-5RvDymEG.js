import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import { c as Button, n as ApiError } from "./createLucideIcon-DmKyVZgg.js";
import { t as useQuery } from "./useQuery-D4rdH9-y.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, r as focusFirstInvalid, t as Alert } from "./alert-Cl5zWfQH.js";
import { t as SelectField } from "./select-DQI7SO7u.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as branchesQuery } from "./detail-BqLEd-GC.js";
import { t as Kbd } from "./kbd-DLpSQiun.js";
import { t as GitBranch } from "./git-branch-AN0ykaqP.js";
import { t as Store } from "./store-Dsr3zRui.js";
import { t as permissionsQuery } from "./permissions--dOQAlW8.js";
import { r as emptyBranch, t as branchFormSchema } from "./management-BtgoPGrQ.js";
import {
  O as useDeleteBranch,
  U as EmptyList,
  W as ReadOnlyNote,
  _ as storesQuery,
  k as useSaveBranch,
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
//#region ../../packages/backoffice/src/components/branches/delete/dialog.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function DeleteBranchDialog({ branch, open, onOpenChange, restoreFocus }) {
  const remove = useDeleteBranch(() => onOpenChange(false));
  const name = branch?.name ?? "this branch";
  const error = remove.error;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmDialog, {
    open,
    onOpenChange: (next) => {
      if (!next) remove.reset();
      onOpenChange(next);
    },
    title: `Delete ${name}?`,
    description: "This removes the branch. It can't be undone.",
    confirmLabel: "Delete branch",
    error:
      error instanceof ApiError && error.status === 409
        ? `${name} is still used by tills or sales, so it can't be deleted.`
        : error?.message,
    pending: remove.isPending,
    onConfirm: () => branch && remove.mutate(branch),
    restoreFocus,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/branches/form.tsx
function BranchForm({ branch, stores, onSaved }) {
  const online = useOnline();
  const save = useSaveBranch(branch, onSaved);
  const form = useForm({
    defaultValues: branch
      ? {
          name: branch.name,
          storeId: branch.storeId,
        }
      : emptyBranch(stores.length === 1 ? stores[0].id : ""),
    validators: { onSubmit: branchFormSchema },
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
            name: "storeId",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Store",
                placeholder: "Choose a store",
                options: stores.map((store) => ({
                  value: store.id,
                  label: store.name,
                })),
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
        label: "Save branch",
        pending: save.isPending,
        online,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/branches/table.tsx
function BranchTable({ branches, storeNames, onEdit, onDelete }) {
  const columns = [
    {
      id: "name",
      header: "Branch",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "store",
      header: "Store",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) => storeNames.get(row.original.storeId) ?? "Unknown store",
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
    label: "Branches",
    columns,
    data: branches,
    getRowId: (branch) => branch.id,
    className: "min-h-0",
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/branches/screen.tsx
function BranchesScreen() {
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: branches } = useSuspenseQuery(branchesQuery());
  const canReadStores = held.includes("store.read");
  const storeContext = useQuery({
    ...storesQuery(),
    enabled: canReadStores,
  });
  const stores = storeContext.data;
  const canWrite = held.includes("branch.write");
  const canEdit = canWrite && canReadStores && !!stores?.length;
  const addRef = (0, import_react.useRef)(null);
  const form = usePanel(addRef);
  const removal = usePanel(addRef);
  const noPanelOpen = !form.open && !removal.open;
  const shortcuts = useShortcuts({ N: () => canEdit && noPanelOpen && form.show() });
  const isEmpty = branches.length === 0;
  if (canReadStores && stores?.length === 0)
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "flex flex-col gap-6",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, { title: "Branches" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyList, {
          icon: Store,
          title: "Add a store first",
          description:
            "Every branch belongs to a store. Add one, then come back to add its branches.",
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            asChild: true,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
              to: "/stores",
              children: "Go to stores",
            }),
          }),
        }),
      ],
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex min-h-0 flex-1 flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
        title: "Branches",
        action:
          isEmpty || !canEdit
            ? void 0
            : {
                label: "Add branch",
                shortcut: "N",
                onClick: () => form.show(),
                ref: addRef,
              },
      }),
      (!canWrite || !canReadStores) &&
        !(canReadStores && storeContext.isPending) &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadOnlyNote, {
          children: canWrite
            ? "Viewing stores is needed to create or move a branch."
            : "You can view branches. Ask an owner for permission to make changes.",
        }),
      isEmpty
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyList, {
            icon: GitBranch,
            title: "No branches yet",
            description: "Tills and stock belong to a branch. Add the place where you sell.",
            children:
              canEdit &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                ref: addRef,
                onClick: () => form.show(),
                children: [
                  "Add branch",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                    "aria-hidden": true,
                    children: "N",
                  }),
                ],
              }),
          })
        : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BranchTable, {
            branches,
            storeNames: new Map((stores ?? []).map((store) => [store.id, store.name])),
            onEdit: canEdit ? (branch) => form.show(branch, editButtonId(branch.id)) : void 0,
            onDelete: canWrite
              ? (branch) => removal.show(branch, deleteButtonId(branch.id))
              : void 0,
          }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: form.open,
        onOpenChange: form.setOpen,
        title: form.value ? "Edit branch" : "New branch",
        description: form.value
          ? "Rename the branch or move it to another store."
          : "Name the branch and choose its store.",
        restoreFocus: form.restoreFocus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          BranchForm,
          {
            branch: form.value,
            stores: stores ?? [],
            onSaved: () => form.setOpen(false),
          },
          form.value?.id ?? "new",
        ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeleteBranchDialog, {
        branch: removal.value,
        open: removal.open,
        onOpenChange: removal.setOpen,
        restoreFocus: removal.restoreFocus,
      }),
    ],
  });
}
//#endregion
export { BranchesScreen };
