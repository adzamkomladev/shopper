import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { kycDetail } from "../../schemas/kyc";
import { currentShop } from "../../stores/shops";

type Step = { id: string; body?: unknown };

const post = (path: string, body?: unknown) =>
  apiFetch(path, kycDetail, { method: "POST", body: body ?? {} });

/** The calls that move one check along, each answering with the check as it now stands. */
export function useKycActions() {
  const queryClient = useQueryClient();
  const onSuccess = () =>
    queryClient.invalidateQueries({ queryKey: ["kyc", currentShop()?.id ?? "box"] });
  return {
    open: useMutation({ mutationFn: (body: unknown) => post("/kyc", body), onSuccess }),
    verify: useMutation({
      mutationFn: ({ id, body }: Step) => post(`/kyc/${id}/verify`, body),
      onSuccess,
    }),
    resend: useMutation({
      mutationFn: ({ id }: Step) => post(`/kyc/${id}/resend`),
      onSuccess: () => toast.success("New code sent"),
    }),
    recordId: useMutation({
      mutationFn: ({ id, body }: Step) => post(`/kyc/${id}/id`, body),
      onSuccess,
    }),
    skipId: useMutation({ mutationFn: ({ id }: Step) => post(`/kyc/${id}/id/skip`), onSuccess }),
    decide: useMutation({
      mutationFn: ({ id, body }: Step) => post(`/kyc/${id}/decision`, body),
      onSuccess,
    }),
  };
}
