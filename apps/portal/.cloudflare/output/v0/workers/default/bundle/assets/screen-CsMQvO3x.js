import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import { i as require_react, r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { c as Button, n as ApiError } from "./createLucideIcon-DmKyVZgg.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import {
  a as focusOnMount,
  n as AlertDescription,
  r as focusFirstInvalid,
  t as Alert,
} from "./alert-Cl5zWfQH.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as LoaderCircle } from "./loader-circle-CGIjpJGj.js";
import { t as brokenLink } from "./api-DjRs8MRa.js";
import { t as useSignIn } from "./login-DiQv0Gul.js";
import {
  c as AuthFrame,
  et as useNavigate,
  i as useVerify,
  l as AuthPanel,
  n as registrationQuery,
  r as useComplete,
  tt as useSearch,
} from "./router-Dr1B-bFG.js";
import { t as LoginSuccess } from "./success-CsevBfjb.js";
import { n as completeSchema, t as SHOP_CODE_HELP } from "./onboarding-DE-edj8X.js";
//#region ../../packages/backoffice/src/components/auth/verify/registration/complete/form.tsx
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_jsx_runtime = require_jsx_runtime();
function errorField(error) {
  if (!(error instanceof ApiError)) return void 0;
  return error.status === 409 ? "shopCode" : error.field;
}
/** The password is asked only now, after the email is verified, and goes straight to the server. */
function CompleteForm({ link, email, shopCode, onSignedIn }) {
  const signIn = useSignIn(null, onSignedIn);
  const complete = useComplete(link, (done) => signIn.mutate(done));
  const form = useForm({
    defaultValues: {
      shopCode,
      password: "",
    },
    validators: { onSubmit: completeSchema },
    onSubmit: ({ value }) =>
      complete.mutate(
        { ...value },
        {
          onError: (error) => {
            const field = errorField(error);
            if (field) document.getElementById(field)?.focus();
          },
        },
      ),
    onSubmitInvalid: focusFirstInvalid,
  });
  const failure = complete.error;
  const field = errorField(failure);
  const created = complete.isSuccess;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthPanel, {
    title: "Set up your shop",
    description: `${email} is verified. Choose your shop code and a password to finish.`,
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
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
              name: "password",
              children: (passwordField) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field: passwordField,
                  label: "Password",
                  type: "password",
                  autoFocus: true,
                  autoComplete: "new-password",
                  description: "At least 12 characters.",
                  serverError: field === "password" ? failure?.message : void 0,
                }),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
              name: "shopCode",
              children: (codeField) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field: codeField,
                  label: "Shop code",
                  description: SHOP_CODE_HELP,
                  autoCapitalize: "none",
                  spellCheck: false,
                  serverError: field === "shopCode" ? failure?.message : void 0,
                }),
            }),
          ],
        }),
        failure &&
          !field &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                children: failure.message,
              }),
            ],
          }),
        created &&
          signIn.error &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDescription, {
                children: [
                  "Your shop is ready, but we couldn't log you in: ",
                  signIn.error.message,
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                    to: "/login",
                    search: { shop: complete.data.shopCode },
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
          disabled: complete.isPending || signIn.isPending,
          children: [
            (complete.isPending || signIn.isPending) &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                className: "animate-spin",
              }),
            complete.isPending
              ? "Creating your shop…"
              : signIn.isPending
                ? "Logging in…"
                : "Create shop",
          ],
        }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/auth/verify/registration/already/set/up.tsx
function AlreadySetUp({ shopCode }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthPanel, {
    title: "Your shop is already set up",
    description: "This link has done its job. Log in with your email and password to carry on.",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
      asChild: true,
      size: "lg",
      className: "w-full rounded-full",
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
        to: "/login",
        search: { shop: shopCode },
        children: "Log in",
      }),
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/auth/verify/registration/verify/step.tsx
/** Opening the link only previews it; this button is what verifies the address. */
function VerifyStep({ link, email, shopName }) {
  const verify = useVerify(link);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthPanel, {
    title: "Verify your email",
    description: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
      children: [
        "You're setting up ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
          className: "text-foreground",
          children: shopName,
        }),
        " with",
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
          className: "text-foreground",
          children: email,
        }),
        ".",
      ],
    }),
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "flex flex-col gap-6",
      children: [
        verify.error &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                children: verify.error.message,
              }),
            ],
          }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
          size: "lg",
          className: "w-full rounded-full",
          onClick: () => verify.mutate(),
          disabled: verify.isPending,
          ref: focusOnMount,
          children: [
            verify.isPending &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                className: "animate-spin",
              }),
            verify.isPending ? "Verifying…" : "Verify email",
          ],
        }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/auth/verify/registration/screen.tsx
function VerifyRegistrationScreen() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = (0, import_react.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
    children: signedIn
      ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginSuccess, {
          onContinue: () => void navigate({ to: "/products" }),
        })
      : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Steps, { onSignedIn: () => setSignedIn(true) }),
  });
}
function Steps({ onSignedIn }) {
  const { id, token } = useSearch({ from: "/verify-registration" });
  if (!id || !token) brokenLink();
  const link = {
    id,
    token,
  };
  const { data: view } = useSuspenseQuery(registrationQuery(link));
  if (view.completed)
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlreadySetUp, { shopCode: view.shopCode });
  if (!view.verified)
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VerifyStep, {
      link,
      email: view.email,
      shopName: view.shopName,
    });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompleteForm, {
    link,
    email: view.email,
    shopCode: view.shopCode,
    onSignedIn,
  });
}
//#endregion
export { VerifyRegistrationScreen };
