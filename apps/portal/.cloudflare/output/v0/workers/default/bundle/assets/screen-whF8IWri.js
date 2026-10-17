import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  L as object,
  N as nonEmpty,
  Q as string,
  U as pipe,
  i as require_react,
  q as regex,
  r as require_jsx_runtime,
} from "./react-dom-BCYT53bd.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import {
  c as Button,
  n as ApiError,
  q as useQueryClient,
  t as createLucideIcon,
} from "./createLucideIcon-DmKyVZgg.js";
import { t as useQuery } from "./useQuery-D4rdH9-y.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import {
  a as focusOnMount,
  n as AlertDescription,
  r as focusFirstInvalid,
  t as Alert,
} from "./alert-Cl5zWfQH.js";
import { t as SelectField } from "./select-DQI7SO7u.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as branchesQuery } from "./detail-BqLEd-GC.js";
import { t as Kbd } from "./kbd-DLpSQiun.js";
import { t as MonitorSmartphone } from "./monitor-smartphone-DoKGCSHP.js";
import { t as permissionsQuery } from "./permissions--dOQAlW8.js";
import {
  D as useSavePin,
  E as useRevokeDevice,
  T as useIssueEnrolment,
  U as EmptyList,
  h as usersQuery,
  w as devicesQuery,
} from "./router-Dr1B-bFG.js";
import { i as useShortcuts, t as useOnline } from "./online-Bubx-X8y.js";
import { a as SheetFooter, n as SheetClose } from "./sheet-Dp4G9a56.js";
import {
  a as PageHeader,
  o as FormFooter,
  r as deleteButtonId,
  s as FormSheet,
  t as usePanel,
} from "./panel-Dq4364QD.js";
import { t as ConfirmDialog } from "./dialog-BbHRqHuf.js";
import { n as formatDateTime, t as formatDate } from "./groups-BwPFp5Be.js";
import { t as Badge } from "./badge-C1R2IFYz.js";
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/circle.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$1 = {
  name: "circle",
  size: 24,
  node: [
    [
      "circle",
      {
        cx: "12",
        cy: "12",
        r: "10",
        key: "1mglay",
      },
    ],
  ],
};
__iconData$1.node;
var Circle = createLucideIcon(__iconData$1);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/key-round.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData = {
  name: "key-round",
  size: 24,
  node: [
    [
      "path",
      {
        d: "M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",
        key: "1s6t7t",
      },
    ],
    [
      "circle",
      {
        cx: "16.5",
        cy: "7.5",
        r: ".5",
        fill: "currentColor",
        key: "w0ekpg",
      },
    ],
  ],
};
__iconData.node;
var KeyRound = createLucideIcon(__iconData);
//#endregion
//#region ../../packages/backoffice/src/schemas/devices/enrol/form.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var enrolFormSchema = object({ branchId: pipe(string(), nonEmpty("Choose a branch")) });
//#endregion
//#region ../../packages/backoffice/src/components/devices/enrol/form.tsx
var import_jsx_runtime = require_jsx_runtime();
/** Two steps in one sheet: choose the branch, then read the code out to the till. */
function EnrolForm({ branches }) {
  const online = useOnline();
  const issue = useIssueEnrolment();
  const form = useForm({
    defaultValues: { branchId: "" },
    validators: { onSubmit: enrolFormSchema },
    onSubmit: ({ value }) => issue.mutate(value.branchId),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (!issue.data && online && !issue.isPending) form.handleSubmit();
    },
  });
  if (issue.data) {
    const [first, second] = [issue.data.code.slice(0, 3), issue.data.code.slice(3)];
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "flex min-h-0 flex-1 flex-col",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-1 flex-col gap-4 px-4",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
              className: "text-sm text-muted-foreground",
              children: [
                "Enter this code on the till. It works once, and expires",
                " ",
                formatDateTime(issue.data.expiresAt),
                ".",
              ],
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("output", {
              "aria-label": "Enrolment code",
              className:
                "rounded-lg border bg-muted/50 py-6 text-center text-4xl font-semibold tracking-widest tabular-nums",
              children: [first, " ", second],
            }),
          ],
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetFooter, {
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetClose, {
            asChild: true,
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              ref: focusOnMount,
              children: [
                "Done",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                  "aria-hidden": true,
                  children: "↵",
                }),
              ],
            }),
          }),
        }),
      ],
    });
  }
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
            name: "branchId",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Branch",
                placeholder: "Choose a branch",
                autoFocus: true,
                options: branches.map((branch) => ({
                  value: branch.id,
                  label: branch.name,
                })),
              }),
          }),
          issue.error &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
              variant: "destructive",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                  children: issue.error.message,
                }),
              ],
            }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormFooter, {
        label: "Create code",
        pendingLabel: "Creating…",
        pending: issue.isPending,
        online,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/schemas/devices/pin/form.ts
var pinFormSchema = object({
  userId: pipe(string(), nonEmpty("Choose a cashier")),
  pin: pipe(string(), regex(/^\d{4,8}$/, "Use 4 to 8 digits, like 4829")),
});
//#endregion
//#region ../../packages/backoffice/src/components/devices/pin/form.tsx
function PinForm({ members, unavailableMessage, onSaved }) {
  const online = useOnline();
  const save = useSavePin(onSaved);
  const form = useForm({
    defaultValues: {
      userId: "",
      pin: "",
    },
    validators: { onSubmit: pinFormSchema },
    onSubmit: ({ value }) =>
      save.mutate({
        ...value,
        name: members.find((member) => member.id === value.userId)?.name ?? "",
      }),
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
            name: "userId",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Cashier",
                placeholder: "Choose a cashier",
                autoFocus: true,
                options: members.map((member) => ({
                  value: member.id,
                  label: member.name,
                })),
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "pin",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "PIN",
                description: "They type it on the till to sign in. It replaces any PIN they have.",
                type: "password",
                inputMode: "numeric",
                autoComplete: "off",
                onChange: clearError,
              }),
          }),
          unavailableMessage &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
              className: "text-sm text-muted-foreground",
              role: "status",
              children: unavailableMessage,
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
        label: "Save PIN",
        pending: save.isPending,
        online,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/devices/revoke/dialog.tsx
function RevokeDeviceDialog({ device, open, onOpenChange, restoreFocus }) {
  const revoke = useRevokeDevice(() => onOpenChange(false));
  const name = device?.name ?? "this device";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmDialog, {
    open,
    onOpenChange: (next) => {
      if (!next) revoke.reset();
      onOpenChange(next);
    },
    title: `Revoke ${name}?`,
    description: "This device can no longer sign in cashiers. Enrol it again to bring it back.",
    confirmLabel: "Revoke device",
    error: revoke.error?.message,
    pending: revoke.isPending,
    onConfirm: () => device && revoke.mutate(device),
    restoreFocus,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/devices/table.tsx
function DeviceTable({ devices, onRevoke }) {
  const columns = [
    {
      id: "name",
      header: "Device",
      meta: { className: "whitespace-normal font-medium" },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "branch",
      header: "Branch",
      cell: ({ row }) => row.original.branchName,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) =>
        row.original.status === "active"
          ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
              variant: "outline",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Circle, {
                  "aria-hidden": true,
                  className: "fill-success text-success",
                }),
                "Active",
              ],
            })
          : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
              variant: "secondary",
              children: "Revoked",
            }),
    },
    {
      id: "added",
      header: "Added",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ];
  if (onRevoke)
    columns.push({
      id: "actions",
      header: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "sr-only",
          children: "Actions",
        }),
      cell: ({ row }) =>
        row.original.status === "active" &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
          className: "flex justify-end",
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            id: deleteButtonId(row.original.id),
            variant: "outline",
            size: "sm",
            "aria-label": `Revoke ${row.original.name}`,
            onClick: () => onRevoke(row.original),
            children: "Revoke",
          }),
        }),
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
    label: "Devices",
    columns,
    data: devices,
    getRowId: (device) => device.id,
    className: "min-h-0",
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/devices/screen.tsx
function DevicesScreen() {
  const queryClient = useQueryClient();
  const { data: devices } = useSuspenseQuery(devicesQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const branches = useQuery({
    ...branchesQuery(),
    retry: false,
  });
  const members = useQuery({
    ...usersQuery(),
    retry: false,
  });
  const addRef = (0, import_react.useRef)(null);
  const pinRef = (0, import_react.useRef)(null);
  const enrol = usePanel(addRef);
  const pin = usePanel(pinRef);
  const removal = usePanel(addRef);
  const canEnrol = held.includes("device.enroll") && !!branches.data?.length;
  const canPin = held.includes("cashier.pin.assign");
  const hasBranchRead = held.includes("branch.read");
  const cannotReadBranches = held.includes("device.enroll") && !hasBranchRead;
  const branchChoicesFailed = held.includes("device.enroll") && hasBranchRead && branches.isError;
  const noPanelOpen = !enrol.open && !pin.open && !removal.open;
  const shortcuts = useShortcuts({
    N: () => canEnrol && noPanelOpen && enrol.show(),
    P: () => canPin && noPanelOpen && pin.show(),
  });
  const isEmpty = devices.length === 0;
  const closeEnrol = (open) => {
    enrol.setOpen(open);
    if (!open) queryClient.invalidateQueries({ queryKey: ["devices"] });
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex min-h-0 flex-1 flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
        title: "Devices",
        action:
          canEnrol && !isEmpty
            ? {
                label: "Enrol device",
                shortcut: "N",
                onClick: () => enrol.show(),
                ref: addRef,
              }
            : void 0,
        children:
          canPin &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
            ref: pinRef,
            variant: "outline",
            onClick: () => pin.show(),
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, { "aria-hidden": true }),
              "Set cashier PIN",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                "aria-hidden": true,
                children: "P",
              }),
            ],
          }),
      }),
      cannotReadBranches &&
        !isEmpty &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "-mt-3 text-sm text-muted-foreground",
          children:
            "To enrol a device you need to be able to see branches. Ask an owner to enrol it.",
        }),
      branchChoicesFailed &&
        !isEmpty &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "-mt-3 text-sm text-muted-foreground",
          role: "status",
          children: "Branch choices couldn’t load. Check your connection and refresh to try again.",
        }),
      isEmpty
        ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(EmptyList, {
            icon: MonitorSmartphone,
            title: "No devices yet",
            description:
              branches.data?.length === 0
                ? "A device is a till that signs cashiers in to a branch. Add a branch first, then enrol the till."
                : "A device is a till that signs cashiers in to a branch. Enrol the till to get started.",
            children: [
              branches.data?.length === 0 &&
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                  asChild: true,
                  children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                    to: "/branches",
                    children: "Go to branches",
                  }),
                }),
              canEnrol &&
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
                  ref: addRef,
                  onClick: () => enrol.show(),
                  children: [
                    "Enrol device",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                      "aria-hidden": true,
                      children: "N",
                    }),
                  ],
                }),
            ],
          })
        : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DeviceTable, {
            devices,
            onRevoke: held.includes("device.revoke")
              ? (device) => removal.show(device, deleteButtonId(device.id))
              : void 0,
          }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: enrol.open,
        onOpenChange: closeEnrol,
        title: "Enrol a device",
        description:
          "Choose the branch the till will work in. You get a code to enter on the till.",
        restoreFocus: enrol.restoreFocus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EnrolForm, {
          branches: branches.data ?? [],
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: pin.open,
        onOpenChange: pin.setOpen,
        title: "Set cashier PIN",
        description: "Give a member a PIN to sign in on a till.",
        restoreFocus: pin.restoreFocus,
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PinForm, {
          members: members.data ?? [],
          unavailableMessage: members.isError
            ? members.error instanceof ApiError && members.error.status === 403
              ? "You can't see the member list, so ask an owner to set the PIN."
              : "Couldn't load the member list. Check your connection and refresh to try again."
            : void 0,
          onSaved: () => pin.setOpen(false),
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RevokeDeviceDialog, {
        device: removal.value,
        open: removal.open,
        onOpenChange: removal.setOpen,
        restoreFocus: removal.restoreFocus,
      }),
    ],
  });
}
//#endregion
export { DevicesScreen };
