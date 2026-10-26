import {
  invitationList,
  cancellationResponse,
  changeResponse,
  grantableBranches,
  roleResponse,
} from "../schemas/users";
import type { AccessValues, StatusChange, UserView, Revealed, InviteValues } from "./types";
export type { AccessValues, StatusChange, UserView, Revealed, InviteValues } from "./types";
import { issued, type InvitationView } from "../schemas/users";
export { type InvitationView } from "../schemas/users";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as v from "valibot";
import { invitationIssueSchema, userListResponse } from "@shopper/auth/schemas";
import { apiFetch } from "../api/client";
import { permissionsQuery } from "./session/permissions";
import { currentShop } from "../stores/shops";

// The list never carries a setup link, so even if the server one day adds it, it is dropped here.

// What issuing or reissuing answers with; the link is read once and never stored (see `revealing`).

export function usersQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["users", shop?.id ?? "box"],
    queryFn: () => apiFetch("/users", userListResponse, { shopId: shop?.id ?? null }),
  });
}

export function invitationsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["invitations", shop?.id ?? "box"],
    queryFn: () => apiFetch("/invitations", invitationList, { shopId: shop?.id ?? null }),
  });
}

/** What the users screen needs before it can draw. Roles load after, because naming them is optional. */
export const usersScreenQueries = () => [usersQuery(), invitationsQuery(), permissionsQuery()];

/**
 * A setup link is a secret that opens an account. It goes straight to `reveal` (the dialog's own
 * state) and out of the mutation, so it never sits in the mutation or query cache.
 */
function strip(
  result: v.InferOutput<typeof issued>,
  reveal: (revealed: Revealed) => void,
): { email: string; revealed: boolean } {
  if (result.setupLink) reveal({ email: result.email, link: result.setupLink });
  return { email: result.email, revealed: !!result.setupLink };
}

async function refreshInvitations(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: ["invitations"] });
}

export function useInvite(reveal: (revealed: Revealed) => void, onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (values: InviteValues) =>
      strip(
        await apiFetch("/invitations", issued, {
          method: "POST",
          body: v.parse(invitationIssueSchema, { ...values, email: values.email.trim() }),
        }),
        reveal,
      ),
    onSuccess: async (result) => {
      if (!result.revealed) toast.success(`Invitation created for ${result.email}`);
      onDone();
      await refreshInvitations(queryClient);
    },
  });
}

/** Replaces an invitation's link. The old link stops working, and an email invitation is sent again. */
export function useReissue(reveal: (revealed: Revealed) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (invitation: InvitationView) =>
      strip(
        await apiFetch(`/invitations/${invitation.id}/reissue`, issued, {
          method: "POST",
          body: {},
        }),
        reveal,
      ),
    onSuccess: async (result) => {
      if (!result.revealed) toast.success(`Invitation renewed for ${result.email}`);
      await refreshInvitations(queryClient);
    },
    onError: (error) => toast.error(error.message),
  });
}

export function useCancelInvitation(onCancelled: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitation: InvitationView) =>
      apiFetch(`/invitations/${invitation.id}/cancel`, cancellationResponse, {
        method: "POST",
        body: {},
      }),
    onSuccess: async () => {
      toast.success("Invitation cancelled");
      onCancelled();
      await refreshInvitations(queryClient);
    },
  });
}

/** The branches whoever manages access may hand out: their own, or every branch. Needs role.write. */
export function accessBranchesQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["users", "branches", shop?.id ?? "box"],
    queryFn: () => apiFetch("/users/branches", grantableBranches, { shopId: shop?.id ?? null }),
  });
}

/** Saves a member's role and branches, each only when it changed. Permissions follow at once, so the session refetches. */
export function useSaveAccess(member: UserView, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: AccessValues) => {
      if (values.roleId !== member.roleId)
        await apiFetch(`/users/${member.id}/role`, roleResponse, {
          method: "PATCH",
          body: { roleId: values.roleId },
        });
      const branchIds = values.everywhere ? [] : [...values.branchIds].sort();
      if (branchIds.join() !== [...member.branchIds].sort().join())
        await apiFetch(`/users/${member.id}/branches`, changeResponse, {
          method: "PUT",
          body: { branchIds },
        });
    },
    onSuccess: async () => {
      toast.success("Access updated");
      onSaved();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
    },
  });
}

/** Deactivates (signs out everywhere, refuses sign-in) or reactivates a member. */
export function useMemberStatus(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ member, action }: StatusChange) =>
      apiFetch(`/users/${member.id}/${action}`, changeResponse, { method: "POST" }),
    onSuccess: async (_result, { member, action }) => {
      toast.success(`${member.name} ${action}d`);
      onDone();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
      ]);
    },
  });
}
