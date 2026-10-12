import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import * as v from "valibot";
import { registrationStartResponse, registrationViewResponse } from "@shopper/auth/schemas";
import { publicFetch } from "../public-api";

export type Started = v.InferOutput<typeof registrationStartResponse>;
export type SignupValues = { name: string; email: string; shopName: string; shopCode: string };
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
      publicFetch(`/onboarding/${id}/resend`, v.object({ id: v.string() }), {
        method: "POST",
        body: { resendToken },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["registration-delivery", id] }),
  });
}
