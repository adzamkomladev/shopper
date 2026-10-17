import { L as object, Q as string } from "./react-dom-BCYT53bd.js";
import {
  a as rememberShop,
  h as useMutation,
  n as ApiError,
  q as useQueryClient,
  r as apiFetch,
} from "./createLucideIcon-DmKyVZgg.js";
import { n as isTenantQuery, r as lookupShop } from "./session-DN4yT67X.js";
//#region ../../packages/backoffice/src/schemas/auth/login/response.ts
var signedIn = object({ user: object({ id: string() }) });
//#endregion
//#region ../../packages/backoffice/src/queries/auth/login.ts
/** Looks the shop up first (unless the box fixes it), remembers it, then signs in as its user. */
function useSignIn(box, onSignedIn) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    onSettled: (_data, _error, values) => {
      values.password = "";
    },
    mutationFn: async ({ shopCode, email, password }) => {
      const org = box ?? (await lookupShop(shopCode));
      rememberShop({
        ...org,
        slug: box ? "" : shopCode.trim().toLowerCase(),
      });
      await apiFetch("/auth/sign-in/email", signedIn, {
        method: "POST",
        body: {
          email,
          password,
        },
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.field === "shopCode")
        document.getElementById("shopCode")?.focus();
    },
    onSuccess: () => {
      queryClient.removeQueries({ predicate: isTenantQuery });
      onSignedIn();
    },
  });
}
//#endregion
export { useSignIn as t };
