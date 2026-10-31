import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, currentShop } from "@shopper/backoffice/kit";
import { kybCase, platformOrg, queue, tenantChannel, tenants } from "../schemas/platform";
import type { KybStatus } from "../schemas/types";

// Keys carry the signed-in org, so a different sign-in never reads another's answers.
const key = (...rest: unknown[]) => ["platform", currentShop()?.id ?? "none", ...rest];

/** The platform org staff sign in to; public, so login can name it. */
export const platformOrgQuery = queryOptions({
  queryKey: ["org", "platform"],
  queryFn: () => apiFetch("/platform/org", platformOrg, { shopId: null }),
  staleTime: Infinity,
});

export const kybQueueQuery = (status: KybStatus) =>
  queryOptions({
    queryKey: key("kyb", status),
    queryFn: () => apiFetch(`/platform/kyb?status=${status}`, queue),
  });

export const kybCaseQuery = (orgId: string) =>
  queryOptions({
    queryKey: key("kyb", "case", orgId),
    queryFn: () => apiFetch(`/platform/kyb/${encodeURIComponent(orgId)}`, kybCase),
  });

export const tenantsQuery = () =>
  queryOptions({ queryKey: key("tenants"), queryFn: () => apiFetch("/platform/tenants", tenants) });

/** Approves or rejects one submission; every queue and the case are read again after. */
export function useDecide(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { version: number; decision: "approved" | "rejected"; note?: string }) =>
      apiFetch(`/platform/kyb/${encodeURIComponent(orgId)}/decision`, kybCase, {
        method: "POST",
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key() }),
  });
}

/** Moves one shop's registers to the pilot or the stable till release feed. */
export function useSetChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { orgId: string; channel: "pilot" | "stable" }) =>
      apiFetch(`/platform/tenants/${encodeURIComponent(body.orgId)}/channel`, tenantChannel, {
        method: "POST",
        body: { channel: body.channel },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key("tenants") }),
  });
}
