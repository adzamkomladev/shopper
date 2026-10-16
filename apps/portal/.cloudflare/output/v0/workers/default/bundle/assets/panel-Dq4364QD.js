import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import { t as Kbd } from "./kbd-DLpSQiun.js";
import { n as MOD_KEY } from "./online-Bubx-X8y.js";
import {
  a as SheetFooter,
  i as SheetDescription,
  n as SheetClose,
  o as SheetHeader,
  r as SheetContent,
  s as SheetTitle,
  t as Sheet,
} from "./sheet-Dp4G9a56.js";
//#region ../../packages/backoffice/src/components/admin/form/sheet.tsx
var import_jsx_runtime = require_jsx_runtime();
/** A right-hand sheet that hands focus back when it closes. */
function FormSheet({ open, onOpenChange, title, description, restoreFocus, children, className }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
    open,
    onOpenChange,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
      className: className ?? "sm:max-w-md",
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        restoreFocus();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetHeader, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetTitle, { children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheetDescription, {
              children: description,
            }),
          ],
        }),
        children,
      ],
    }),
  });
}
var OFFLINE_NOTE_ID = "save-offline-note";
/** Cancel and the one submit button, which says why it is disabled when the device is offline. */
function FormFooter({ label, pendingLabel = "Saving…", pending, online }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
    children: [
      !online &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          id: OFFLINE_NOTE_ID,
          className: "px-4 text-sm text-muted-foreground",
          children: "You're offline. Reconnect to save.",
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
            disabled: !online || pending,
            "aria-describedby": online ? void 0 : OFFLINE_NOTE_ID,
            children: pending
              ? pendingLabel
              : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
                  children: [
                    label,
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
//#region ../../packages/backoffice/src/components/admin/page/header.tsx
/** The heading row every administration screen starts with, with its one primary button. */
function PageHeader({ title, action, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex items-center justify-between gap-4",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
        className: "text-3xl font-bold tracking-tight",
        children: title,
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex items-center gap-3",
        children: [
          children,
          action &&
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              ref: action.ref,
              onClick: action.onClick,
              children: [
                action.label,
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Kbd, {
                  "aria-hidden": true,
                  children: action.shortcut,
                }),
              ],
            }),
        ],
      }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/admin/row/actions.tsx
var editButtonId = (id) => `edit-${id}`;
var deleteButtonId = (id) => `delete-${id}`;
/** Edit and Delete for one table row. Both stay reachable by Tab; the dialogs they open take Enter and Escape. */
function RowActions({ name, id, onEdit, onDelete }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
    className: "flex justify-end gap-2",
    onFocusCapture: (event) => {
      if (event.target instanceof HTMLButtonElement)
        event.target.scrollIntoView({
          block: "nearest",
          inline: "nearest",
        });
    },
    children: [
      onEdit &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
          id: editButtonId(id),
          variant: "outline",
          size: "sm",
          "aria-label": `Edit ${name}`,
          onClick: onEdit,
          children: "Edit",
        }),
      onDelete &&
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
          id: deleteButtonId(id),
          variant: "outline",
          size: "sm",
          "aria-label": `Delete ${name}`,
          onClick: onDelete,
          children: "Delete",
        }),
    ],
  });
}
//#endregion
//#region ../../packages/backoffice/src/hooks/admin/panel.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/** Moves focus to the element with this id, or to `fallback` when it is gone (a deleted row). */
function focusById(id, fallback) {
  (document.getElementById(id ?? "") ?? fallback.current)?.focus();
}
/**
 * Open state for a sheet or dialog, plus where focus returns when it closes. The value outlives
 * the close so the content does not change while the exit animation plays.
 */
function usePanel(fallback) {
  const [state, setState] = (0, import_react.useState)({ open: false });
  return {
    open: state.open,
    value: state.value,
    show: (value, trigger) =>
      setState({
        open: true,
        value,
        trigger,
      }),
    setOpen: (open) =>
      setState((current) => ({
        ...current,
        open,
      })),
    restoreFocus: () => focusById(state.trigger, fallback),
  };
}
//#endregion
export {
  PageHeader as a,
  editButtonId as i,
  RowActions as n,
  FormFooter as o,
  deleteButtonId as r,
  FormSheet as s,
  usePanel as t,
};
