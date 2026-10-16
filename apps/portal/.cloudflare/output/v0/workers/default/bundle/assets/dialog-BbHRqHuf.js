import { r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import { n as AlertDescription, t as Alert } from "./alert-Cl5zWfQH.js";
import { d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as Kbd } from "./kbd-DLpSQiun.js";
import { i as useShortcuts, n as MOD_KEY, t as useOnline } from "./online-Bubx-X8y.js";
import {
  a as DialogFooter,
  i as DialogDescription,
  n as DialogClose,
  o as DialogHeader,
  r as DialogContent,
  s as DialogTitle,
  t as Dialog,
} from "./dialog-B8Uvl6EC.js";
//#region ../../packages/backoffice/src/components/admin/confirm/dialog.tsx
var import_jsx_runtime = require_jsx_runtime();
var BLOCKED_ID = "confirm-blocked";
/** Asks before something that can't be undone. Escape cancels; Mod+Enter confirms. */
function ConfirmDialog(props) {
  const { open, onOpenChange, title, description, confirmLabel, blocked, error, pending } = props;
  const online = useOnline();
  const canConfirm = online && !pending && !blocked;
  const shortcuts = useShortcuts({
    "Mod+Enter": () => {
      if (canConfirm) props.onConfirm();
    },
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
    open,
    onOpenChange,
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
      ref: shortcuts,
      onCloseAutoFocus: (event) => {
        event.preventDefault();
        props.restoreFocus();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogHeader, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: title }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogDescription, {
              children: description,
            }),
          ],
        }),
        blocked &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            id: BLOCKED_ID,
            className: "text-sm text-muted-foreground",
            children: blocked,
          }),
        !online &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "text-sm text-muted-foreground",
            children: "You're offline. Reconnect to continue.",
          }),
        error &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, { children: error }),
            ],
          }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, {
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogClose, {
              asChild: true,
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
                variant: "outline",
                children: "Cancel",
              }),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              variant: props.destructive === false ? "default" : "destructive",
              disabled: !canConfirm,
              "aria-describedby": blocked ? BLOCKED_ID : void 0,
              onClick: props.onConfirm,
              children: [
                pending ? "Working…" : confirmLabel,
                !pending &&
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Kbd, {
                    "aria-hidden": true,
                    children: [MOD_KEY, " ↵"],
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
export { ConfirmDialog as t };
