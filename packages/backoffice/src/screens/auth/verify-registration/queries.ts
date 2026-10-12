import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { registrationCompleteResponse, registrationViewResponse } from "@shopper/auth/schemas";
import { publicFetch, type LinkCredentials as Link } from "../public-api";

/** Previewing never consumes the link: only the Verify email button does. */
export function registrationQuery({ id, token }: Link) {
  return queryOptions({
    queryKey: ["registration", id],
    queryFn: () =>
      publicFetch(
        `/onboarding/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`,
        registrationViewResponse,
      ),
    retry: false,
  });
}

export function useVerify(link: Link) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: () =>
      publicFetch("/onboarding/verify", registrationViewResponse, { method: "POST", body: link }),
    onSuccess: (view) => queryClient.setQueryData(registrationQuery(link).queryKey, view),
  });
}

type Complete = { shopCode: string; password: string };

export function useComplete(link: Link, onCompleted: (done: Complete & { email: string }) => void) {
  return useMutation({
    gcTime: 0,
    onSettled: (_data, _error, values) => {
      values.password = "";
    },
    mutationFn: (values: Complete) =>
      publicFetch("/onboarding/complete", registrationCompleteResponse, {
        method: "POST",
        body: { ...link, ...values },
      }),
    onSuccess: (result, values) =>
      onCompleted({ shopCode: result.shopCode, email: result.email, password: values.password }),
  });
}
