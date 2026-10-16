import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { c as Button } from "./createLucideIcon-DmKyVZgg.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, r as focusFirstInvalid, t as Alert } from "./alert-Cl5zWfQH.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as LoaderCircle } from "./loader-circle-CGIjpJGj.js";
import { t as brokenLink } from "./api-DjRs8MRa.js";
import {
  a as invitationQuery,
  c as AuthFrame,
  et as useNavigate,
  l as AuthPanel,
  o as joinedButNotSignedIn,
  s as useJoin,
  tt as useSearch,
} from "./router-Dr1B-bFG.js";
import { t as LoginSuccess } from "./success-CsevBfjb.js";
import { i as joinSchema, r as existingJoinSchema } from "./onboarding-DE-edj8X.js";
//#region ../../packages/backoffice/src/components/auth/accept/invitation/join/form.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function JoinForm({ link, preview, onJoined }) {
  const join = useJoin(link, preview, onJoined);
  const existing = preview.existingAccount;
  const form = useForm({
    defaultValues: {
      name: "",
      password: "",
    },
    validators: { onSubmit: existing ? existingJoinSchema : joinSchema },
    onSubmit: ({ value }) => join.mutate({ ...value }),
    onSubmitInvalid: focusFirstInvalid,
  });
  const error = join.error;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthPanel, {
    title: `Join ${preview.shopName}`,
    description: existing
      ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
          children: [
            "Sign in as ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
              className: "text-foreground",
              children: preview.email,
            }),
            " to join as",
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
              className: "text-foreground",
              children: preview.roleName,
            }),
            ". Your password stays the same.",
          ],
        })
      : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
          children: [
            "You've been invited as ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
              className: "text-foreground",
              children: preview.roleName,
            }),
            " ",
            "with ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
              className: "text-foreground",
              children: preview.email,
            }),
            ". Add your name and choose a password.",
          ],
        }),
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
      noValidate: true,
      className: "flex flex-col gap-9",
      onSubmit: (event) => {
        event.preventDefault();
        form.handleSubmit();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FieldGroup, {
          className: "gap-6",
          children: [
            !existing &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
                name: "name",
                children: (field) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                    field,
                    label: "Your name",
                    autoFocus: true,
                    autoComplete: "name",
                  }),
              }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
              name: "password",
              children: (field) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field,
                  label: "Password",
                  type: "password",
                  autoFocus: existing,
                  autoComplete: existing ? "current-password" : "new-password",
                  description: existing ? void 0 : "At least 12 characters.",
                }),
            }),
          ],
        }),
        error &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDescription, {
                children: [
                  joinedButNotSignedIn(error)
                    ? `You've joined, but we couldn't log you in: ${error.message}. `
                    : `${error.message} `,
                  joinedButNotSignedIn(error) &&
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                      to: "/login",
                      search: { shop: preview.shopCode },
                      className: "underline",
                      children: "Log in",
                    }),
                ],
              }),
            ],
          }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
          type: "submit",
          size: "lg",
          className: "w-full rounded-full",
          disabled: join.isPending,
          children: [
            join.isPending &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                className: "animate-spin",
              }),
            join.isPending ? "Joining…" : existing ? "Sign in and join" : "Create account and join",
          ],
        }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/auth/accept/invitation/screen.tsx
function AcceptInvitationScreen() {
  const navigate = useNavigate();
  const [joined, setJoined] = (0, import_react.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
    children: joined
      ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginSuccess, {
          onContinue: () => void navigate({ to: "/products" }),
        })
      : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Invitation, {
          onJoined: () => setJoined(true),
        }),
  });
}
function Invitation({ onJoined }) {
  const { id, token } = useSearch({ from: "/accept-invitation" });
  if (!id || !token) brokenLink();
  const link = {
    id,
    token,
  };
  const { data: preview } = useSuspenseQuery(invitationQuery(link));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(JoinForm, {
    link,
    preview,
    onJoined,
  });
}
//#endregion
export { AcceptInvitationScreen };
