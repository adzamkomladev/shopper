import { queryOptions, useMutation } from "@tanstack/react-query";
import { invitationAcceptResponse, invitationPreviewResponse } from "@shopper/auth/schemas";
import type * as v from "valibot";
import { publicFetch, type LinkCredentials as Link } from "../public-api";
import { useSignIn } from "../login/queries";

export type Preview = v.InferOutput<typeof invitationPreviewResponse>;

/** Previewing never consumes the invitation: only Join does. */
export function invitationQuery({ id, token }: Link) {
  return queryOptions({
    queryKey: ["invitation", id],
    queryFn: () =>
      publicFetch(
        `/invitations/${encodeURIComponent(id)}/preview?token=${encodeURIComponent(token)}`,
        invitationPreviewResponse,
      ),
    retry: false,
    // The route reloads previews on navigation; mounting the form must not re-read a consumed link.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

class JoinedError extends Error {
  readonly joined = true;
}

/**
 * A new person is created by accepting, then signed in. An existing account signs in with its own
 * password first, because the server only attaches the role to the account that is signed in.
 */
export function useJoin(link: Link, preview: Preview, onJoined: () => void) {
  const signIn = useSignIn(null, () => {});
  const accept = (body: { name?: string; password?: string }) =>
    publicFetch(`/invitations/${link.id}/accept`, invitationAcceptResponse, {
      method: "POST",
      body: { token: link.token, ...body },
    });
  return useMutation({
    gcTime: 0,
    onSettled: (_data, _error, values) => {
      values.password = "";
    },
    mutationFn: async ({ name, password }: { name?: string; password: string }) => {
      const credentials = { shopCode: preview.shopCode, email: preview.email, password };
      if (preview.existingAccount) {
        await signIn.mutateAsync(credentials);
        await accept({});
        return;
      }
      await accept({ name, password });
      await signIn.mutateAsync(credentials).catch((error: Error) => {
        throw new JoinedError(error.message, { cause: error });
      });
    },
    onSuccess: onJoined,
  });
}

/** True when the account exists but signing in failed, so the person only needs to log in. */
export const joinedButNotSignedIn = (error: Error | null): error is JoinedError =>
  error instanceof JoinedError;
