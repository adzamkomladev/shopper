import { resendResponse } from "../../schemas/auth/signup";
import type { Started, SignupValues } from "./types";
export type { Started, SignupValues } from "./types";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { registrationStartResponse, registrationViewResponse } from "@shopper/auth/schemas";
import { publicFetch } from "../../api/auth/public/api";

type Delivery = Started["deliveryStatus"];

export function useStartRegistration(onStarted: (started: Started) => void) {
  return useMutation({
    gcTime: 0,
    mutationFn: async (values: SignupValues) => {
      const started = await publicFetch("/onboarding/start", registrationStartResponse, {
        method: "POST",
        body: values,
      });
      onStarted(started);
    },
  });
}

/** Whether the email went out. Read on demand: when the screen opens, on refocus and on Check delivery. */
export function deliveryQuery({ id, resendToken }: Pick<Started, "id" | "resendToken">) {
  return queryOptions({
    queryKey: ["registration-delivery", id],
    queryFn: async (): Promise<Delivery> =>
      (
        await publicFetch(
          `/onboarding/${id}?resendToken=${encodeURIComponent(resendToken)}`,
          registrationViewResponse,
        )
      ).deliveryStatus ?? "pending",
    retry: false,
  });
}

export function useResend({ id, resendToken }: Pick<Started, "id" | "resendToken">) {
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
