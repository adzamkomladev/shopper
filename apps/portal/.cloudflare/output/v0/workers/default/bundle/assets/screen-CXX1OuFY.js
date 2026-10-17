import { a as __toESM } from "./rolldown-runtime-7_rZTKki.js";
import {
  L as object,
  Q as string,
  i as require_react,
  r as require_jsx_runtime,
} from "./react-dom-BCYT53bd.js";
import {
  _ as registrationViewResponse,
  m as registrationStartResponse,
} from "./schemas-DUCUNo6u.js";
import { t as Link } from "./link-Dm8tj3is.js";
import { n as useForm, t as TextField } from "./text-9gJXRsif.js";
import { c as Button, h as useMutation, q as useQueryClient } from "./createLucideIcon-DmKyVZgg.js";
import { t as queryOptions } from "./queryOptions-eKLVKX7x.js";
import { t as useQuery } from "./useQuery-D4rdH9-y.js";
import {
  a as focusOnMount,
  n as AlertDescription,
  r as focusFirstInvalid,
  t as Alert,
} from "./alert-Cl5zWfQH.js";
import { a as FieldGroup, d as CircleAlert } from "./field-C8_3jRPt.js";
import { t as LoaderCircle } from "./loader-circle-CGIjpJGj.js";
import { r as publicFetch } from "./api-DjRs8MRa.js";
import { c as AuthFrame, l as AuthPanel } from "./router-Dr1B-bFG.js";
import {
  a as signupSchema,
  o as suggestShopCode,
  t as SHOP_CODE_HELP,
} from "./onboarding-DE-edj8X.js";
//#region ../../packages/backoffice/src/schemas/auth/signup.ts
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var resendResponse = object({ id: string() });
//#endregion
//#region ../../packages/backoffice/src/queries/auth/signup.ts
function useStartRegistration(onStarted) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (values) => {
      onStarted(
        await publicFetch("/onboarding/start", registrationStartResponse, {
          method: "POST",
          body: values,
        }),
      );
    },
  });
}
/** Whether the email went out. Read on demand: when the screen opens, on refocus and on Check delivery. */
function deliveryQuery({ id, resendToken }) {
  return queryOptions({
    queryKey: ["registration-delivery", id],
    queryFn: async () =>
      (
        await publicFetch(
          `/onboarding/${id}?resendToken=${encodeURIComponent(resendToken)}`,
          registrationViewResponse,
        )
      ).deliveryStatus ?? "pending",
    retry: false,
  });
}
function useResend({ id, resendToken }) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: () =>
      publicFetch(`/onboarding/${id}/resend`, resendResponse, {
        method: "POST",
        body: { resendToken },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registration-delivery", id] }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/auth/signup/check/email.tsx
var import_jsx_runtime = require_jsx_runtime();
function CheckEmail({ started, onChangeEmail }) {
  const delivery = useQuery({
    ...deliveryQuery(started),
    initialData: started.deliveryStatus,
  });
  const resend = useResend(started);
  const status = delivery.data;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthPanel, {
    title: "Check your email",
    description: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, {
      children: [
        "We sent a link to ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
          className: "text-foreground",
          children: started.email,
        }),
        ". Open it to confirm it's you. The link works for 24 hours.",
      ],
    }),
    children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
      className: "flex flex-col gap-6",
      children: [
        status === "failed" &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                children:
                  "We couldn't send the email. Resend it, or go back and check the address.",
              }),
            ],
          }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
          role: "status",
          className: "text-sm text-muted-foreground",
          children: [
            status === "pending" && "Sending the email…",
            status === "sent" && "The email was sent.",
            resend.isSuccess && " Another email is on its way. It can take a minute to arrive.",
          ],
        }),
        resend.error &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                children: resend.error.message,
              }),
            ],
          }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-col gap-4 sm:flex-row",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              size: "lg",
              className: "rounded-full sm:flex-1",
              onClick: () => resend.mutate(),
              disabled: resend.isPending,
              ref: focusOnMount,
              children: [
                resend.isPending &&
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                    className: "animate-spin",
                  }),
                "Resend email",
              ],
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
              size: "lg",
              variant: "outline",
              className: "rounded-full sm:flex-1",
              onClick: () => void delivery.refetch(),
              disabled: delivery.isFetching,
              children: "Check delivery",
            }),
          ],
        }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
          variant: "link",
          className: "self-start px-0",
          onClick: onChangeEmail,
          children: "Use a different email",
        }),
      ],
    }),
  });
}
//#endregion
//#region ../../packages/backoffice/src/components/auth/signup/form.tsx
function SignupForm({ onStarted }) {
  const start = useStartRegistration(onStarted);
  const codeEdited = (0, import_react.useRef)(false);
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      shopName: "",
      shopCode: "",
    },
    validators: { onSubmit: signupSchema },
    onSubmit: ({ value }) => start.mutate(value),
    onSubmitInvalid: focusFirstInvalid,
  });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthPanel, {
    title: "Create your shop",
    description:
      "Tell us who you are and what to call your shop. We'll email you a link to confirm it's you.",
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
              name: "email",
              children: (field) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field,
                  label: "Email",
                  type: "email",
                  autoComplete: "email",
                }),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
              name: "shopName",
              children: (field) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field,
                  label: "Shop name",
                  autoComplete: "organization",
                  onChange: (event) => {
                    if (!codeEdited.current)
                      form.setFieldValue("shopCode", suggestShopCode(event.target.value));
                  },
                }),
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(form.Field, {
              name: "shopCode",
              children: (field) =>
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TextField, {
                  field,
                  label: "Shop code",
                  description: SHOP_CODE_HELP,
                  autoCapitalize: "none",
                  spellCheck: false,
                  onChange: () => {
                    codeEdited.current = true;
                  },
                }),
            }),
          ],
        }),
        start.error &&
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Alert, {
            variant: "destructive",
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, { "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDescription, {
                children: start.error.message,
              }),
            ],
          }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
          className: "flex flex-col gap-4",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
              type: "submit",
              size: "lg",
              className: "w-full rounded-full",
              disabled: start.isPending,
              children: [
                start.isPending &&
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
                    className: "animate-spin",
                  }),
                start.isPending ? "Sending the link…" : "Continue",
              ],
            }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
              className: "text-center text-sm text-muted-foreground",
              children: [
                "Already have a shop?",
                " ",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
                  to: "/login",
                  className: "font-medium text-primary underline-offset-4 hover:underline",
                  children: "Log in",
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
//#region ../../packages/backoffice/src/screens/auth/signup/screen.tsx
function SignupScreen() {
  const [started, setStarted] = (0, import_react.useState)(null);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthFrame, {
    children: started
      ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckEmail, {
          started,
          onChangeEmail: () => setStarted(null),
        })
      : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignupForm, { onStarted: setStarted }),
  });
}
//#endregion
export { SignupScreen };
