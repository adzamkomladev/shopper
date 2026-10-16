import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  H as picklist,
  L as object,
  N as nonEmpty,
  Q as string,
  U as pipe,
  i as require_react,
  r as require_jsx_runtime,
  tt as trim,
  y as email,
} from "./react-dom-BCYT53bd.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { t as DataTable } from "./data-B-YoF4og.js";
import { c as Button, n as ApiError, t as createLucideIcon } from "./createLucideIcon-DmKyVZgg.js";
import { t as useQuery } from "./useQuery-D4rdH9-y.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, r as focusFirstInvalid, t as Alert } from "./alert-Cl5zWfQH.js";
import { t as SelectField } from "./select-DQI7SO7u.js";
import { a as FieldGroup, d as CircleAlert, u as Label } from "./field-C8_3jRPt.js";
import { i as toast, t as Kbd } from "./kbd-DLpSQiun.js";
import { t as permissionsQuery } from "./permissions--dOQAlW8.js";
import { a as sessionQuery } from "./session-DN4yT67X.js";
import {
  S as rolesQuery,
  U as EmptyList,
  d as useAssignRole,
  f as useCancelInvitation,
  h as usersQuery,
  m as useReissue,
  p as useInvite,
  u as invitationsQuery,
  x as roleLabel,
} from "./router-Dr1B-bFG.js";
import { t as Input } from "./control-DkcwkdzM.js";
import { i as useShortcuts, t as useOnline } from "./online-Bubx-X8y.js";
import {
  a as PageHeader,
  i as editButtonId,
  o as FormFooter,
  s as FormSheet,
  t as usePanel,
} from "./panel-Dq4364QD.js";
import {
  a as DialogFooter,
  i as DialogDescription,
  n as DialogClose,
  o as DialogHeader,
  r as DialogContent,
  s as DialogTitle,
  t as Dialog,
} from "./dialog-B8Uvl6EC.js";
import { t as ConfirmDialog } from "./dialog-BbHRqHuf.js";
import { t as useNow } from "./now-DCvEBg2d.js";
import { t as formatDate } from "./groups-BwPFp5Be.js";
import { t as Badge } from "./badge-C1R2IFYz.js";
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/copy.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData$1 = {
  name: "copy",
  size: 24,
  node: [
    [
      "rect",
      {
        width: "14",
        height: "14",
        x: "8",
        y: "8",
        rx: "2",
        ry: "2",
        key: "17jyea",
      },
    ],
    [
      "path",
      {
        d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2",
        key: "zix9uf",
      },
    ],
  ],
};
__iconData$1.node;
var Copy = createLucideIcon(__iconData$1);
//#endregion
//#region ../../node_modules/.pnpm/lucide-react@1.55.0_@types+react@19.3.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/mail.mjs
/**
 * @license lucide-react v1.55.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */
var __iconData = {
  name: "mail",
  size: 24,
  node: [
    [
      "path",
      {
        d: "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7",
        key: "132q7q",
      },
    ],
    [
      "rect",
      {
        x: "2",
        y: "4",
        width: "20",
        height: "16",
        rx: "2",
        key: "izxlao",
      },
    ],
  ],
};
__iconData.node;
var Mail = createLucideIcon(__iconData);
//#endregion
//#region ../../packages/backoffice/src/components/users/cancel/dialog.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function CancelInvitationDialog({ invitation, open, onOpenChange, restoreFocus }) {
  const cancel = useCancelInvitation(() => onOpenChange(false));
  const email = invitation?.email ?? "this invitation";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfirmDialog, {
    open,
    onOpenChange: (next) => {
      if (!next) cancel.reset();
      onOpenChange(next);
    },
    title: `Cancel invitation for ${email}?`,
    description: "The link stops working straight away. You can invite them again later.",
    confirmLabel: "Cancel invitation",
    error: cancel.error?.message,
    pending: cancel.isPending,
    onConfirm: () => invitation && cancel.mutate(invitation),
    restoreFocus,
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/users/change/role/form.tsx
function ChangeRoleForm({ member, roles, onSaved }) {
  const online = useOnline();
  const assign = useAssignRole(member, onSaved);
  const form = useForm({
    defaultValues: { roleId: member.roleId },
    onSubmit: ({ value }) => assign.mutate(value.roleId),
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !assign.isPending) form.handleSubmit();
    },
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
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "roleId",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Role",
                autoFocus: true,
                options: roles.map((role) => ({
                  value: role.id,
                  label: roleLabel(role),
                })),
              }),
          }),
          assign.error &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
              variant: "destructive",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                  children: assign.error.message,
                }),
              ],
            }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormFooter, {
        label: "Save role",
        pending: assign.isPending,
        online,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/lib/users/invitation/status.ts
/** An invitation that is still pending past its expiry has lapsed, but the server only knows it as pending. */
function present(invitation, now) {
  switch (invitation.status) {
    case "accepted":
      return {
        label: "Accepted",
        variant: "default",
        open: false,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        variant: "outline",
        open: false,
      };
    case "expired":
      return {
        label: "Expired",
        variant: "outline",
        open: false,
      };
    default:
      return Date.parse(invitation.expiresAt) <= now
        ? {
            label: "Expired",
            variant: "outline",
            open: true,
          }
        : {
            label: "Pending",
            variant: "secondary",
            open: true,
          };
  }
}
var DELIVERY = {
  sent: "Email sent",
  failed: "Email not delivered",
  pending: "Sending email…",
};
/** What happened to the email, for an emailed invitation that is still open. */
var deliveryNote = (invitation) =>
  invitation.channel === "email" ? DELIVERY[invitation.deliveryStatus ?? "pending"] : void 0;
//#endregion
//#region ../../packages/backoffice/src/components/users/invitations/table.tsx
var CLOCK_MS = 6e4;
var cancelButtonId = (id) => `cancel-${id}`;
function InvitationsTable({ invitations, roleNames, actions }) {
  const now = useNow(CLOCK_MS);
  const columns = [
    {
      id: "email",
      header: "Invited",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-col",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
              className: "font-medium",
              children: row.original.email,
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
              className: "text-muted-foreground",
              children: row.original.channel === "email" ? "By email" : "By setup link",
            }),
          ],
        }),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => (row.original.roleId && roleNames.get(row.original.roleId)) || "—",
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = present(row.original, now);
        const delivery = status.label === "Pending" ? deliveryNote(row.original) : void 0;
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-col items-start gap-1",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
              variant: status.variant,
              children: status.label,
            }),
            delivery &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
                className: "text-xs text-muted-foreground",
                children: delivery,
              }),
          ],
        });
      },
    },
    {
      id: "expires",
      header: "Expires",
      cell: ({ row }) => formatDate(row.original.expiresAt),
    },
  ];
  if (actions)
    columns.push({
      id: "actions",
      header: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "sr-only",
          children: "Actions",
        }),
      cell: ({ row }) => {
        const invitation = row.original;
        if (!present(invitation, now).open) return null;
        const byEmail = invitation.channel === "email";
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex justify-end gap-2",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              variant: "outline",
              size: "sm",
              disabled: actions.pending,
              "aria-label": byEmail
                ? `Resend invitation to ${invitation.email}`
                : `New link for ${invitation.email}`,
              onClick: () => actions.onReissue(invitation),
              children: byEmail ? "Resend" : "New link",
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              id: cancelButtonId(invitation.id),
              variant: "outline",
              size: "sm",
              "aria-label": `Cancel invitation for ${invitation.email}`,
              onClick: () => actions.onCancel(invitation),
              children: "Cancel",
            }),
          ],
        });
      },
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
    label: "Invitations",
    columns,
    data: invitations,
    getRowId: (invitation) => invitation.id,
    className: "max-h-96",
  });
}
//#endregion
//#region ../../packages/backoffice/src/schemas/users/invite/form.ts
var inviteFormSchema = object({
  email: pipe(
    string(),
    trim(),
    nonEmpty("Enter an email address"),
    email("Enter an email address like ama@example.com"),
  ),
  roleId: pipe(string(), nonEmpty("Choose a role")),
  channel: picklist(["email", "local"]),
});
//#endregion
//#region ../../packages/backoffice/src/components/users/invite/form.tsx
var CHANNELS = [
  {
    value: "email",
    label: "Email the invitation",
  },
  {
    value: "local",
    label: "Create a setup link",
  },
];
function InviteForm({ roles, reveal, onDone }) {
  const online = useOnline();
  const invite = useInvite(reveal, onDone);
  const form = useForm({
    defaultValues: {
      email: "",
      roleId: "",
      channel: "email",
    },
    validators: { onSubmit: inviteFormSchema },
    onSubmit: ({ value }) => invite.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (online && !invite.isPending) form.handleSubmit();
    },
  });
  const clearError = () => {
    if (invite.isError) invite.reset();
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
            name: "email",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                field,
                label: "Email",
                type: "email",
                autoFocus: true,
                autoComplete: "off",
                onChange: clearError,
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "roleId",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "Role",
                placeholder: "Choose a role",
                options: roles.map((role) => ({
                  value: role.id,
                  label: roleLabel(role),
                })),
              }),
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
            name: "channel",
            children: (field) =>
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectField, {
                field,
                label: "How to send it",
                options: CHANNELS,
              }),
          }),
          invite.error &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
              variant: "destructive",
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                  children: invite.error.message,
                }),
              ],
            }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormFooter, {
        label: "Send invitation",
        pending: invite.isPending,
        online,
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/users/members/table.tsx
function MembersTable({ members, onChangeRole }) {
  const columns = [
    {
      id: "name",
      header: "Name",
      meta: { className: "whitespace-normal" },
      cell: ({ row }) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-col",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
              className: "font-medium",
              children: row.original.name,
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
              className: "flex items-center gap-2 text-muted-foreground",
              children: [
                row.original.email,
                !row.original.emailVerified &&
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
                    variant: "outline",
                    children: "Not verified",
                  }),
              ],
            }),
          ],
        }),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) =>
        roleLabel({
          name: row.original.roleName,
          protectedOwner: row.original.protectedOwner,
        }),
    },
  ];
  if (onChangeRole)
    columns.push({
      id: "actions",
      header: () =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
          className: "sr-only",
          children: "Actions",
        }),
      cell: ({ row }) =>
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
          className: "flex justify-end",
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
            id: editButtonId(row.original.id),
            variant: "outline",
            size: "sm",
            "aria-label": `Change role for ${row.original.name}`,
            onClick: () => onChangeRole(row.original),
            children: "Change role",
          }),
        }),
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DataTable, {
    label: "Members",
    columns,
    data: members,
    getRowId: (member) => member.id,
    className: "max-h-96",
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/users/setup/link/dialog.tsx
/** Shows a setup link once, with the quickest way to copy it. Nothing here outlives the dialog's state. */
function SetupLinkDialog({ revealed, open, onOpenChange, restoreFocus }) {
  const copyRef = (0, import_react.useRef)(null);
  const inputRef = (0, import_react.useRef)(null);
  async function copy() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.link);
      toast.success("Link copied");
    } catch {
      inputRef.current?.select();
      toast.message("Press Ctrl+C to copy the selected link");
    }
  }
  const shortcuts = useShortcuts({ C: () => void copy() });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
    open,
    onOpenChange,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
      ref: shortcuts,
      onOpenAutoFocus: (event) => {
        event.preventDefault();
        copyRef.current?.focus();
      },
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        restoreFocus();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
              children: "Setup link ready",
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogDescription, {
              children: [
                "Send this link to ",
                revealed?.email ?? "them",
                ". It works once and stops working after 7 days, or as soon as you make a new link.",
              ],
            }),
          ],
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-col gap-2",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
              htmlFor: "setup-link",
              children: "Setup link",
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
              id: "setup-link",
              ref: inputRef,
              readOnly: true,
              value: revealed?.link ?? "",
            }),
          ],
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
              asChild: true,
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                variant: "outline",
                children: "Done",
              }),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              ref: copyRef,
              onClick: () => void copy(),
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { "aria-hidden": true }),
                "Copy link",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                  "aria-hidden": true,
                  children: "C",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/users/screen.tsx
var NO_ROLES = [];
function UsersScreen() {
  const { data: members } = useSuspenseQuery(usersQuery());
  const { data: allInvitations } = useSuspenseQuery(invitationsQuery());
  const { data: held } = useSuspenseQuery(permissionsQuery());
  const { data: session } = useSuspenseQuery(sessionQuery());
  const roleList = useQuery({
    ...rolesQuery(),
    retry: false,
  });
  const roles = roleList.data ?? NO_ROLES;
  const roleListPermissionDenied =
    roleList.error instanceof ApiError && roleList.error.status === 403;
  const currentMember = members.find((member) => member.id === session?.user.id);
  const grantableRoles = roles.filter(
    (role) =>
      (currentMember?.protectedOwner || !role.protectedOwner) &&
      role.permissionCodes.every((code) => held.includes(code)),
  );
  const addRef = (0, import_react.useRef)(null);
  const invite = usePanel(addRef);
  const roleChange = usePanel(addRef);
  const link = usePanel(addRef);
  const cancellation = usePanel(addRef);
  const reissue = useReissue((revealed) => link.show(revealed));
  const canWriteRoles = held.includes("role.write");
  const canAssign = canWriteRoles && roleList.data !== void 0 && grantableRoles.length > 0;
  const canInvite = canAssign && held.includes("user.write");
  const noPanelOpen = !invite.open && !roleChange.open && !link.open && !cancellation.open;
  const shortcuts = useShortcuts({ I: () => canInvite && noPanelOpen && invite.show() });
  const invitations = allInvitations.filter((invitation) => invitation.status !== "replaced");
  const roleNames = new Map(roles.map((role) => [role.id, role.name]));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    ref: shortcuts,
    className: "flex min-h-0 flex-1 flex-col gap-6",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
        title: "Users",
        action: canInvite
          ? {
              label: "Invite user",
              shortcut: "I",
              onClick: () => invite.show(),
              ref: addRef,
            }
          : void 0,
      }),
      !canWriteRoles &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "-mt-3 text-sm text-muted-foreground",
          children:
            "You can see who has access. Changing roles or inviting people needs the role permission.",
        }),
      canWriteRoles &&
        roleList.isPending &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "-mt-3 text-sm text-muted-foreground",
          role: "status",
          children: "Loading role choices…",
        }),
      canWriteRoles &&
        roleList.isError &&
        !roleList.data &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "-mt-3 text-sm text-muted-foreground",
          role: "status",
          children: roleListPermissionDenied
            ? "Role choices aren’t available because you can’t read the role list. Check your access and refresh."
            : "Role choices couldn’t load. Check your connection and refresh to try again.",
        }),
      canWriteRoles &&
        roleList.data &&
        grantableRoles.length === 0 &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "-mt-3 text-sm text-muted-foreground",
          role: "status",
          children: "No roles are available within your permission level to assign.",
        }),
      canAssign &&
        !held.includes("user.write") &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "-mt-3 text-sm text-muted-foreground",
          children: "You can change roles. Inviting people needs the user permission.",
        }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "flex flex-col gap-3",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
            className: "text-lg font-semibold",
            children: "Members",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MembersTable, {
            members,
            onChangeRole: canAssign
              ? (member) => roleChange.show(member, editButtonId(member.id))
              : void 0,
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
        className: "flex flex-col gap-3",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
            className: "text-lg font-semibold",
            children: "Invitations",
          }),
          invitations.length === 0
            ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyList, {
                icon: Mail,
                title: "No invitations yet",
                description:
                  "Invitations you send show up here with their status, so you can send them again or cancel them.",
              })
            : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InvitationsTable, {
                invitations,
                roleNames,
                actions: canInvite
                  ? {
                      pending: reissue.isPending,
                      onReissue: (invitation) => reissue.mutate(invitation),
                      onCancel: (invitation) =>
                        cancellation.show(invitation, cancelButtonId(invitation.id)),
                    }
                  : void 0,
              }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: invite.open,
        onOpenChange: invite.setOpen,
        title: "Invite a user",
        description: "They get a link to choose a password and sign in with the role you pick.",
        restoreFocus: () => !link.open && invite.restoreFocus(),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InviteForm, {
          roles: grantableRoles,
          reveal: (revealed) => link.show(revealed),
          onDone: () => invite.setOpen(false),
        }),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSheet, {
        open: roleChange.open,
        onOpenChange: roleChange.setOpen,
        title: "Change role",
        description: `Choose the role ${roleChange.value?.name ?? "this member"} signs in with.`,
        restoreFocus: roleChange.restoreFocus,
        children:
          roleChange.value &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            ChangeRoleForm,
            {
              member: roleChange.value,
              roles: grantableRoles,
              onSaved: () => roleChange.setOpen(false),
            },
            roleChange.value.id,
          ),
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupLinkDialog, {
        revealed: link.value,
        open: link.open,
        onOpenChange: link.setOpen,
        restoreFocus: link.restoreFocus,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CancelInvitationDialog, {
        invitation: cancellation.value,
        open: cancellation.open,
        onOpenChange: cancellation.setOpen,
        restoreFocus: cancellation.restoreFocus,
      }),
    ],
  });
}
//#endregion
export { UsersScreen };
