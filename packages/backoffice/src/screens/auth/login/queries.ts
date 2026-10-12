import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as v from "valibot";
import { ApiError, apiFetch } from "../../../api/client";
import { isTenantQuery, lookupShop } from "../../../session/queries";
import { rememberShop } from "../../../shops/store";
import type { LoginValues } from "../../../schemas/login";

const signedIn = v.object({ user: v.object({ id: v.string() }) });

/** Looks the shop up first (unless the box fixes it), remembers it, then signs in as its user. */
export function useSignIn(box: { id: string; name: string } | null, onSignedIn: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ shopCode, email, password }: LoginValues) => {
      const org = box ?? (await lookupShop(shopCode));
      rememberShop({ ...org, slug: box ? "" : shopCode.trim().toLowerCase() });
      await apiFetch("/auth/sign-in/email", signedIn, {
        method: "POST",
        body: { email, password },
      });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.field === "shopCode")
        document.getElementById("shopCode")?.focus();
    },
    onSuccess: () => {
      // Everything cached so far belongs to the previous user or shop, not just the session answer.
      queryClient.removeQueries({ predicate: isTenantQuery });
      onSignedIn();
    },
  });
}
