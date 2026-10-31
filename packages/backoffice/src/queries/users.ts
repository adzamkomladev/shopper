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
import { queryOptions, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as v from "valibot";
import { invitationIssueSchema, userListResponse } from "@shopper/auth/schemas";
import { apiFetch } from "../api/client";
import { permissionsQuery } from "./session/permissions";
import { rolesQuery } from "./roles";
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
 * Starts the optional role choices and grantable branches beside the screen's own queries, without holding the
 * screen for them, so they rarely arrive after it draws and push the table down.
 */
export async function prefetchAccessChoices(queryClient: QueryClient) {
  // A failed permissions load is the route's error to show; here it only means nothing to start.
  const held = await queryClient.ensureQueryData(permissionsQuery()).catch((): string[] => []);
  if (held.includes("role.read")) void queryClient.prefetchQuery({ ...rolesQuery(), retry: false });
  if (held.includes("role.write"))
    void queryClient.prefetchQuery({ ...accessBranchesQuery(), retry: false });
}

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
    onSuccess: () => {
      toast.success("Access updated");
      onSaved();
    },
    // The role can save and the branches then fail, so the list refetches either way.
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
    },
  });
}

const DONE = { deactivate: "deactivated", reactivate: "reactivated", unlock: "unlocked" } as const;

/** Deactivates (signs out everywhere, refuses sign-in), reactivates, or lifts a sign-in lockout. */
export function useMemberStatus(onDone: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ member, action }: StatusChange) =>
      apiFetch(`/users/${member.id}/${action}`, changeResponse, { method: "POST" }),
    onSuccess: async (_result, { member, action }) => {
      toast.success(`${member.name} ${DONE[action]}`);
      onDone();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
      ]);
    },
  });
}
