import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, r as focusFirstInvalid, t as Alert } from "./alert-Cl5zWfQH.js";
import { t as SelectField } from "./select-DQI7SO7u.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as Kbd } from "./kbd-DLpSQiun.js";
import { t as ScanBarcode } from "./scan-barcode-jWJo2gmb.js";
import { t as permissionsQuery } from "./permissions--dOQAlW8.js";
import {
  A as mappingsQuery,
  B as roleOfDigit,
  F as mappingFormSchema,
  H as valueName,
  I as mappingValues,
  L as DIGITS,
  M as useSaveMapping,
  N as emptyMapping,
  P as mappingFailure,
  R as digitsText,
  U as EmptyList,
  V as sentence,
  W as ReadOnlyNote,
  j as useDeleteMapping,
  z as rangeOf,
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
//#region ../../packages/backoffice/src/components/catalogue/mappings/delete/dialog.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function DeleteMappingDialog({ mapping, open, onOpenChange, restoreFocus }) {
  const remove = useDeleteMapping(() => onOpenChange(false));
  const prefix = mapping?.prefix ?? "this";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmDialog, {
    open,
    onOpenChange: (next) => {
      if (!next) remove.reset();
      onOpenChange(next);
    },
    title: `Delete the layout for prefix ${prefix}?`,
    description:
      "Tills will no longer read weights or prices from labels with this prefix. Scanning those labels will no longer add products.",
    confirmLabel: "Delete layout",
    error: remove.error && mappingFailure(remove.error, String(prefix)).message,
    pending: remove.isPending,
    onConfirm: () => mapping && remove.mutate(mapping),
    restoreFocus,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/mappings/strip.tsx
var CELL = {
  prefix: "bg-muted text-muted-foreground",
  product: "bg-primary text-primary-foreground",
  value: "bg-success text-success-foreground",
  conflict: "bg-destructive text-white",
  check: "bg-muted text-muted-foreground",
  free: "border border-dashed text-muted-foreground",
};
/** The 13 digits of a label coloured by what each one carries; an overlap shows in red as you type. */
function LayoutStrip({ layout }) {
  const product = rangeOf(Number(layout.productStart), Number(layout.productLength));
  const value = rangeOf(Number(layout.valueStart), Number(layout.valueLength));
  const name = valueName(layout.kind);
  const described = [
    [
      "prefix",
      {
        first: 1,
        last: 2,
      },
    ],
    ["product code", product],
    [name, value],
    [
      "check digit",
      {
        first: 13,
        last: 13,
      },
    ],
  ].filter((part) => !!part[1]);
  const label = `Barcode layout: ${described.map(([what, range]) => `${digitsText(range)} ${what}`).join(", ")}.`;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex flex-col gap-3",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
        role: "img",
        "aria-label": label,
        className: "grid grid-cols-13 gap-1",
        children: DIGITS.map((digit) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "span",
            {
              "aria-hidden": true,
              className: `flex aspect-square items-center justify-center rounded-sm text-xs font-medium tabular-nums ${CELL[roleOfDigit(digit, product, value)]}`,
              children: digit,
            },
            digit,
          ),
        ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
        className: "flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground",
        children: described.map(([what, range]) =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "li",
            { children: [what.charAt(0).toUpperCase() + what.slice(1), ", ", digitsText(range)] },
            what,
          ),
        ),
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/mappings/form.tsx
var KINDS = [
  {
    value: "weight",
    label: "Weight",
  },
  {
    value: "price",
    label: "Price",
  },
];
var UNITS = [
  {
    value: "kg",
    label: "Kilograms (kg)",
  },
  {
    value: "g",
    label: "Grams (g)",
  },
];
function MappingForm({ mapping, layouts, onSaved }) {
  const online = useOnline();
  const save = useSaveMapping(mapping, onSaved);
  const taken = new Set(layouts.filter((other) => other.id !== mapping?.id).map((l) => l.prefix));
  const form = useForm({
    defaultValues: mapping ? mappingValues(mapping) : emptyMapping,
    validators: { onSubmit: mappingFormSchema },
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
  const failure = save.error && mappingFailure(save.error, form.getFieldValue("prefix"));
  const number = (name, label) =>
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
      name,
      children: (field) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
          field,
          label,
          inputMode: "numeric",
          autoComplete: "off",
          onChange: clearError,
        }),
    });
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
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Subscribe, {
            selector: (state) => state.values,
            children: (values) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayoutStrip, { layout: values }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "prefix",
            validators: {
              onSubmit: ({ value }) =>
                taken.has(Number(value))
                  ? {
                      message: `Prefix ${value.trim()} already has a layout. Edit that one instead.`,
                    }
                  : void 0,
            },
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "Prefix",
                autoFocus: true,
                inputMode: "numeric",
                autoComplete: "off",
                description: "The two digits every label of this kind starts with, from 20 to 29.",
                serverError: failure && "field" in failure ? failure.message : void 0,
                onChange: clearError,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "kind",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Label type",
                options: KINDS,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Subscribe, {
            selector: (state) => state.values.kind,
            children: (kind) =>
              kind === "weight" &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
                name: "unit",
                children: (field) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                    field,
                    label: "Weight unit",
                    options: UNITS,
                  }),
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
            className: "grid grid-cols-2 gap-4",
            children: [
              number("productStart", "Product code starts at digit"),
              number("productLength", "Product code length (digits)"),
              number("valueStart", "Value starts at digit"),
              number("valueLength", "Value length (digits)"),
            ],
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "decimals",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "Decimal places",
                inputMode: "numeric",
                autoComplete: "off",
                description:
                  "How many of the value's digits come after the decimal point. With 3, the digits 01250 mean 1.250.",
                onChange: clearError,
              }),
          }),
          failure &&
            !("field" in failure) &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
              variant: "destructive",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                  children: failure.message,
                }),
              ],
            }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormFooter, {
        label: "Save layout",
        pending: save.isPending,
        online,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/catalogue/mappings/table.tsx
var digits = ({ start, length }) => sentence(digitsText(rangeOf(start + 1, length)));
var decimals = (count) => `${count} ${count === 1 ? "decimal" : "decimals"}`;
function MappingTable({ mappings, onEdit, onDelete }) {
  const columns = [
    {
      id: "prefix",
      header: "Prefix",
      meta: { className: "font-medium tabular-nums" },
      cell: ({ row }) => row.original.prefix,
    },
    {
      id: "kind",
      header: "Label",
      cell: ({ row }) =>
        row.original.kind === "weight" ? `Weight in ${row.original.unit}` : "Price",
    },
    {
      id: "product",
      header: "Product code",
      cell: ({ row }) => digits(row.original.product),
    },
    {
      id: "value",
      header: "Value",
      cell: ({ row }) => `${digits(row.original.value)}, ${decimals(row.original.decimals)}`,
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
          name: `prefix ${row.original.prefix}`,
          onEdit: onEdit && (() => onEdit(row.original)),
          onDelete: onDelete && (() => onDelete(row.original)),
        }),
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
    label: "Barcode layouts",
    columns,
    data: mappings,
    getRowId: (mapping) => mapping.id,
    className: "min-h-0",
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/catalogue/mappings/screen.tsx
var MAX_LAYOUTS = 10;
function MappingsScreen() {
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: layouts } = useSuspenseQuery(mappingsQuery());
  const canWrite = held.includes("product.write");
  const full = layouts.length >= MAX_LAYOUTS;
  const canAdd = canWrite && !full;
  const addRef = (0, import_react.useRef)(null);
  const form = usePanel(addRef);
  const removal = usePanel(addRef);
  const shortcuts = useShortcuts({ N: () => canAdd && !form.open && !removal.open && form.show() });
  const isEmpty = layouts.length === 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex min-h-0 flex-1 flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
        title: "Barcode layouts",
        action:
          isEmpty || !canAdd
            ? void 0
            : {
                label: "Add layout",
                shortcut: "N",
                onClick: () => form.show(),
                ref: addRef,
              },
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        className: "max-w-2xl text-sm text-muted-foreground",
        children:
          "Scale and price labels carry a product code and a weight or price inside a 13-digit barcode that starts with 20 to 29. Tell the till where to read each one.",
      }),
      !canWrite &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadOnlyNote, {
          children: "You can view barcode layouts. Ask an owner for permission to make changes.",
        }),
      full &&
        canWrite &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadOnlyNote, {
          children: "Every prefix from 20 to 29 has a layout. Edit one to change it.",
        }),
      isEmpty
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyList, {
            icon: ScanBarcode,
            title: "No barcode layouts yet",
            description: canWrite
              ? "Add the layout your scale prints, so scanning a label adds the product and its weight."
              : "Until one is added, tills can't read weights or prices from labels.",
            children:
              canAdd &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                ref: addRef,
                onClick: () => form.show(),
                children: [
                  "Add layout",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                    "aria-hidden": true,
                    children: "N",
                  }),
                ],
              }),
          })
        : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MappingTable, {
            mappings: layouts,
            onEdit: canWrite ? (layout) => form.show(layout, editButtonId(layout.id)) : void 0,
            onDelete: canWrite
              ? (layout) => removal.show(layout, deleteButtonId(layout.id))
              : void 0,
          }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: form.open,
        onOpenChange: form.setOpen,
        title: form.value ? "Edit layout" : "New layout",
        description: form.value
          ? "Change where the till reads this label's digits."
          : "Say which digits hold the product code and the weight or price.",
        restoreFocus: form.restoreFocus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          MappingForm,
          {
            mapping: form.value,
            layouts,
            onSaved: () => form.setOpen(false),
          },
          form.value?.id ?? "new",
        ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeleteMappingDialog, {
        mapping: removal.value,
        open: removal.open,
        onOpenChange: removal.setOpen,
        restoreFocus: removal.restoreFocus,
      }),
    ],
  });
}
//#endregion
export { MappingsScreen };
