import { r as require_jsx_runtime } from "./react-dom-BCYT53bd.js";
import { c as Button, i as currentShop } from "./createLucideIcon-DmKyVZgg.js";
import { a as focusOnMount } from "./alert-Cl5zWfQH.js";
import { n as CardContent } from "./card-Bdbyfds4.js";
import { t as CircleCheck } from "./circle-check-C_LeQUoQ.js";
//#region ../../packages/backoffice/src/components/auth/login/success.tsx
var import_jsx_runtime = require_jsx_runtime();
function LoginSuccess({ onContinue }) {
  const shop = currentShop();
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(CardContent, {
    className: "flex flex-col items-center gap-9 px-6 text-center sm:px-22",
    children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
        "aria-hidden": true,
        className: "size-27 fill-success text-success-foreground [&>circle]:stroke-success",
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
        className: "flex flex-col gap-5",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
            className: "text-4xl font-semibold tracking-tight",
            children: "You're signed in",
          }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
            className: "text-lg font-medium",
            children: shop
              ? `You're signed in to ${shop.name}.`
              : "You can now use the back office.",
          }),
        ],
      }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
        size: "lg",
        className: "w-full rounded-full",
        onClick: onContinue,
        ref: focusOnMount,
        children: "Continue to products",
      }),
    ],
  });
}
//#endregion
export { LoginSuccess as t };
