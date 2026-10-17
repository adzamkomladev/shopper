import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  L as object,
  N as nonEmpty,
  Q as string,
  U as pipe,
  i as require_react,
  k as maxLength,
  m as array,
  r as require_jsx_runtime,
  tt as trim,
} from "./react-dom-BCYT53bd.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, r as focusFirstInvalid, t as Alert } from "./alert-Cl5zWfQH.js";
import {
  a as FieldGroup,
  c as FieldSet,
  d as CircleAlert,
  n as FieldContent,
  o as FieldLabel,
  r as FieldDescription,
  s as FieldLegend,
  t as Field,
} from "./field-C8_3jRPt.js";
import { t as Switch } from "./switch-_8mZES_3.js";
import { t as permissionsQuery } from "./permissions--dOQAlW8.js";
import {
  C as useSaveRole,
  S as rolesQuery,
  b as permissionsListQuery,
  x as roleLabel,
} from "./router-Dr1B-bFG.js";
import { i as useShortcuts, t as useOnline } from "./online-Bubx-X8y.js";
import { a as SheetFooter, n as SheetClose } from "./sheet-Dp4G9a56.js";
import {
  a as PageHeader,
  i as editButtonId,
  o as FormFooter,
  s as FormSheet,
  t as usePanel,
} from "./panel-Dq4364QD.js";
import { t as Badge } from "./badge-C1R2IFYz.js";
//#region ../../packages/backoffice/src/schemas/roles/form.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var roleFormSchema = object({
  name: pipe(
    string(),
    trim(),
    nonEmpty("Enter a role name"),
    maxLength(100, "Keep the name to 100 characters or fewer"),
  ),
  permissionCodes: array(string()),
});
//#endregion
//#region ../../packages/backoffice/src/lib/roles/permissions.ts
/** What each permission lets a member do, in the words an owner would use. */
var PERMISSION_LABELS = {
  "sale.create": "Ring up sales",
  "refund.request": "Request refunds",
  "refund.approve": "Approve refunds",
  "shift.read": "View shifts",
  "shift.write": "Open and close shifts",
  "stock.read": "View stock",
  "stock.write": "Change stock",
  "product.read": "View products",
  "product.write": "Change products",
  "product.propose": "Propose product changes",
  "tax.read": "View tax rules",
  "tax.write": "Change tax rules",
  "report.read": "View reports",
  "audit.read": "View audit log",
  "user.read": "View users",
  "user.write": "Invite and manage users",
  "role.read": "View roles",
  "role.write": "Change roles",
  "store.read": "View stores",
  "store.write": "Change stores",
  "branch.read": "View branches",
  "branch.write": "Change branches",
  "device.read": "View devices",
  "device.enroll": "Enrol devices",
  "device.revoke": "Revoke devices",
  "cashier.pin.assign": "Set cashier PINs",
};
/** The matrix reads top to bottom in these groups. */
var PERMISSION_GROUPS = [
  {
    name: "Sales",
    codes: ["sale.create", "refund.request", "refund.approve"],
  },
  {
    name: "Shifts",
    codes: ["shift.read", "shift.write"],
  },
  {
    name: "Products and stock",
    codes: ["product.read", "product.write", "product.propose", "stock.read", "stock.write"],
  },
  {
    name: "Tax, reports and audit",
    codes: ["tax.read", "tax.write", "report.read", "audit.read"],
  },
  {
    name: "People",
    codes: ["user.read", "user.write", "role.read", "role.write"],
  },
  {
    name: "Stores and branches",
    codes: ["store.read", "store.write", "branch.read", "branch.write"],
  },
  {
    name: "Devices",
    codes: ["device.read", "device.enroll", "device.revoke", "cashier.pin.assign"],
  },
];
//#endregion
//#region ../../packages/backoffice/src/components/roles/matrix.tsx
var import_jsx_runtime = require_jsx_runtime();
/** Every permission in its group, each one a switch. The role's whole matrix is one field. */
function PermissionMatrix({ value, onChange, canGrant, tillCodes, readOnly }) {
  const toggle = (code, on) =>
    onChange(on ? [...value, code] : value.filter((held) => held !== code));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
        className: "text-sm text-muted-foreground",
        children: "Permissions marked Till also work on a till.",
      }),
      PERMISSION_GROUPS.map((group) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          FieldSet,
          {
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldLegend, {
                variant: "label",
                children: group.name,
              }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
                className: "flex flex-col divide-y rounded-lg border",
                children: group.codes.map((code) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                    Field,
                    {
                      orientation: "horizontal",
                      className: "px-4 py-3",
                      children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FieldContent, {
                          children: [
                            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FieldLabel, {
                              htmlFor: `permission-${code}`,
                              children: [
                                PERMISSION_LABELS[code],
                                tillCodes.has(code) &&
                                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
                                    variant: "outline",
                                    children: "Till",
                                  }),
                              ],
                            }),
                            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FieldDescription, {
                              className: "font-mono text-xs",
                              children: code,
                            }),
                          ],
                        }),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
                          id: `permission-${code}`,
                          checked: value.includes(code),
                          disabled: readOnly || !canGrant.has(code),
                          onCheckedChange: (on) => toggle(code, on),
                        }),
                      ],
                    },
                    code,
                  ),
                ),
              }),
            ],
          },
          group.name,
        ),
      ),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/roles/form.tsx
/** Why the role can't be changed by this member, or undefined when they can edit it. */
function lockReason(role, mine, canWrite) {
  if (role?.protectedOwner)
    return "The owner role always has every permission and can't be changed.";
  if (!canWrite) return "You don't have permission to change roles.";
  if (role?.permissionCodes.some((code) => !mine.has(code)))
    return "You can't change this role because it includes permissions you don't have.";
}
function RoleForm({ role, mine, tillCodes, canWrite, onSaved }) {
  const online = useOnline();
  const save = useSaveRole(role, onSaved);
  const locked = lockReason(role, mine, canWrite);
  const ceilingNote = PERMISSION_GROUPS.every(({ codes }) => codes.every((code) => mine.has(code)))
    ? void 0
    : "You can't grant permissions you don't have yourself.";
  const form = useForm({
    defaultValues: {
      name: role?.name ?? "",
      permissionCodes: role?.permissionCodes ?? [],
    },
    validators: { onSubmit: roleFormSchema },
    onSubmit: ({ value }) =>
      save.mutate({
        ...value,
        name: value.name.trim(),
      }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (!locked && online && !save.isPending) form.handleSubmit();
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
        role: "region",
        "aria-label": "Role details and permissions",
        tabIndex: 0,
        className: "flex-1 overflow-y-auto px-4",
        children: [
          (locked ?? ceilingNote) &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
              className: "text-sm text-muted-foreground",
              children: locked ?? ceilingNote,
            }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "name",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "Name",
                autoFocus: !locked,
                autoComplete: "off",
                disabled: !!locked,
                onChange: clearError,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "permissionCodes",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PermissionMatrix, {
                value: field.state.value,
                onChange: (codes) => {
                  field.handleChange(codes);
                  clearError();
                },
                canGrant: mine,
                tillCodes,
                readOnly: !!locked,
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
      locked
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetFooter, {
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetClose, {
              asChild: true,
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                type: "button",
                variant: "outline",
                children: "Close",
              }),
            }),
          })
        : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormFooter, {
            label: "Save role",
            pending: save.isPending,
            online,
          }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/roles/table.tsx
function RoleTable({ roles, total, canWrite, mine, onOpen }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
    label: "Roles",
    columns: [
      {
        id: "name",
        header: "Role",
        meta: { className: "whitespace-normal font-medium" },
        cell: ({ row }) => roleLabel(row.original),
      },
      {
        id: "permissions",
        header: "Permissions",
        meta: { className: "tabular-nums" },
        cell: ({ row }) => `${row.original.permissionCodes.length} of ${total}`,
      },
      {
        id: "actions",
        header: () =>
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
            className: "sr-only",
            children: "Actions",
          }),
        cell: ({ row }) => {
          const editable = !lockReason(row.original, mine, canWrite);
          return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
            className: "flex justify-end",
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              id: editButtonId(row.original.id),
              variant: "outline",
              size: "sm",
              "aria-label": `${editable ? "Edit" : "View"} permissions for ${roleLabel(row.original)}`,
              onClick: () => onOpen(row.original),
              children: editable ? "Edit permissions" : "View permissions",
            }),
          });
        },
      },
    ],
    data: roles,
    getRowId: (role) => role.id,
    className: "min-h-0",
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/roles/screen.tsx
function RolesScreen() {
  const { data: roles } = useSuspenseQuery(rolesQuery());
  const { data: permissions } = useSuspenseQuery(permissionsListQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const addRef = (0, import_react.useRef)(null);
  const form = usePanel(addRef);
  const mine = new Set(held);
  const canWrite = mine.has("role.write");
  const tillCodes = new Set(permissions.filter((row) => row.tillAllowed).map((row) => row.code));
  const shortcuts = useShortcuts({ N: () => canWrite && !form.open && form.show() });
  const current = form.value;
  const title = !current
    ? "New role"
    : current.protectedOwner
      ? "Owner role"
      : lockReason(current, mine, canWrite)
        ? "View role"
        : "Edit role";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex min-h-0 flex-1 flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
        title: "Roles",
        action: canWrite
          ? {
              label: "New role",
              shortcut: "N",
              onClick: () => form.show(),
              ref: addRef,
            }
          : void 0,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleTable, {
        roles,
        total: permissions.length,
        canWrite,
        mine,
        onOpen: (role) => form.show(role, editButtonId(role.id)),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: form.open,
        onOpenChange: form.setOpen,
        title,
        description: current
          ? "What members with this role can do."
          : "Name the role and choose what it can do.",
        restoreFocus: form.restoreFocus,
        className: "sm:max-w-xl",
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          RoleForm,
          {
            role: current,
            mine,
            tillCodes,
            canWrite,
            onSaved: () => form.setOpen(false),
          },
          current?.id ?? "new",
        ),
      }),
    ],
  });
}
//#endregion
export { RolesScreen };
