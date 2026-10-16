import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  L as object,
  Q as string,
  U as pipe,
  i as require_react,
  j as minLength,
  r as require_jsx_runtime,
  tt as trim,
  y as email,
} from "./react-dom-BCYT53bd.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { c as Button, n as ApiError } from "./createLucideIcon-DmKyVZgg.js";
import { t as useSuspenseQuery } from "./useSuspenseQuery-DuYokS7h.js";
import { n as AlertDescription, t as Alert } from "./alert-Cl5zWfQH.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { n as CardContent } from "./card-Bdbyfds4.js";
import { t as LoaderCircle } from "./loader-circle-CGIjpJGj.js";
import { t as currentOrgQuery } from "./session-DN4yT67X.js";
import { t as useSignIn } from "./login-DiQv0Gul.js";
import { c as AuthFrame, et as useNavigate, tt as useSearch } from "./router-Dr1B-bFG.js";
import { t as LoginSuccess } from "./success-CsevBfjb.js";
//#region ../../packages/backoffice/src/schemas/auth/login/input.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
/** `needsShopCode` is false on the box, which serves one shop and has no shop code. */
function loginSchema(needsShopCode) {
  return object({
    shopCode: needsShopCode
      ? pipe(string(), trim(), minLength(1, "Enter your shop code"))
      : string(),
    email: pipe(string(), trim(), email("Enter a valid email address")),
    password: pipe(string(), minLength(1, "Enter your password")),
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/auth/login/form.tsx
var import_jsx_runtime = require_jsx_runtime();
function LoginForm({ box, defaultShopCode, onSignedIn }) {
  const signIn = useSignIn(box, onSignedIn);
  const form = useForm({
    defaultValues: {
      shopCode: defaultShopCode,
      email: "",
      password: "",
    },
    validators: { onSubmit: loginSchema(!box) },
    onSubmit: ({ value }) => signIn.mutate({ ...value }),
    onSubmitInvalid: ({ formApi }) => {
      const invalid = Object.entries(formApi.state.fieldMeta).find(
        ([, meta]) => meta.errors.length,
      );
      if (invalid) document.getElementById(invalid[0])?.focus();
    },
  });
  const focusFirst = !box && !defaultShopCode ? "shopCode" : "email";
  const error = signIn.error;
  const shopCodeError =
    error instanceof ApiError && error.field === "shopCode" ? error.message : void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CardContent, {
    className: "px-6 sm:px-22",
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
      noValidate: true,
      className: "flex flex-col gap-9",
      onSubmit: (event) => {
        event.preventDefault();
        form.handleSubmit();
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
          className: "sr-only",
          children: "Log in to Shopper",
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-col gap-2",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
              "aria-hidden": true,
              className: "text-4xl font-semibold tracking-tight text-primary",
              children: "Shopper",
            }),
            box &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
                className: "text-lg font-medium text-muted-foreground",
                children: box.name,
              }),
          ],
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
          className: "text-lg font-medium",
          children:
            "For security reasons please enter your email and password to continue using point of sale",
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(FieldGroup, {
          className: "gap-9",
          children: [
            !box &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
                name: "shopCode",
                children: (field) =>
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                    field,
                    label: "Shop code",
                    className: "h-10",
                    serverError: shopCodeError,
                    autoFocus: focusFirst === "shopCode",
                    autoComplete: "organization",
                    autoCapitalize: "none",
                    spellCheck: false,
                  }),
              }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
              name: "email",
              children: (field) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field,
                  label: "Email",
                  className: "h-10",
                  type: "email",
                  autoFocus: focusFirst === "email",
                  autoComplete: "username",
                }),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
              name: "password",
              children: (field) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field,
                  label: "Password",
                  className: "h-10",
                  type: "password",
                  autoComplete: "current-password",
                }),
            }),
          ],
        }),
        error &&
          !shopCodeError &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                children: error.message,
              }),
            ],
          }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
          type: "submit",
          size: "lg",
          className: "w-full rounded-full",
          disabled: signIn.isPending,
          children: [
            signIn.isPending &&
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                className: "animate-spin",
              }),
            signIn.isPending ? "Logging in…" : "Log in",
          ],
        }),
        !box &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
            className: "text-center text-sm text-muted-foreground",
            children: [
              "New to Shopper?",
              " ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                to: "/signup",
                className: "font-medium text-primary underline-offset-4 hover:underline",
                children: "Create a shop",
              }),
            ],
          }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/screens/auth/login/screen.tsx
function LoginScreen() {
  const { data: box } = useSuspenseQuery(currentOrgQuery);
  const { shop } = useSearch({ from: "/login" });
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = (0, import_react.useState)(false);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
    children: signedIn
      ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginSuccess, {
          onContinue: () => void navigate({ to: "/products" }),
        })
      : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginForm, {
          box,
          defaultShopCode: shop ?? "",
          onSignedIn: () => setSignedIn(true),
        }),
  });
}
//#endregion
export { LoginScreen };
