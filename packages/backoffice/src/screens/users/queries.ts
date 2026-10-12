import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as v from "valibot";
import { invitationIssueSchema, invitationListItem, userListResponse } from "@shopper/auth/schemas";
import { apiFetch } from "../../api/client";
import { permissionsQuery } from "../../session/permissions";
import { currentShop } from "../../shops/store";

export type UserView = v.InferOutput<typeof userListResponse>[number];

// The list never carries a setup link, so even if the server one day adds it, it is dropped here.
const invitationRow = v.object({
  ...v.omit(invitationListItem, ["setupLink"]).entries,
  deliveryStatus: v.optional(v.string()),
});
export type InvitationView = v.InferOutput<typeof invitationRow>;
// What issuing or reissuing answers with; the link is read once and never stored (see `revealing`).
const issued = v.object({ ...invitationListItem.entries, setupLink: v.optional(v.string()) });

export function usersQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["users", shop?.id ?? "box"],
    queryFn: () => apiFetch("/users", userListResponse, { shopId: shop?.id ?? null }),
  });
}

export function invitationsQuery(shop = currentShop()) {
  return queryOptions({
    queryKey: ["invitations", shop?.id ?? "box"],
    queryFn: () => apiFetch("/invitations", v.array(invitationRow), { shopId: shop?.id ?? null }),
  });
}

/** What the users screen needs before it can draw. Roles load after, because naming them is optional. */
export const usersScreenQueries = () => [usersQuery(), invitationsQuery(), permissionsQuery()];

export type Revealed = { email: string; link: string };

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

export type InviteValues = { email: string; roleId: string; channel: string };

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
      apiFetch(`/invitations/${invitation.id}/cancel`, v.looseObject({}), {
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

/** Moves a member to another role. Their permissions follow at once, so session permissions are refetched too. */
export function useAssignRole(member: UserView, onSaved: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) =>
      apiFetch(`/users/${member.id}/role`, v.looseObject({}), {
        method: "PATCH",
        body: { roleId },
      }),
    onSuccess: async () => {
      toast.success("Role updated");
      onSaved();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["session"] }),
      ]);
    },
  });
}
