import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiFetch } from "../../api/client";
import { downloadFile } from "../../lib/download";
import { newStatementLink, queued, revoked } from "../../schemas/customers/account";

type Period = { from: string; to: string };
const CHANNEL = { sms: "SMS", email: "email" } as const;

/** Queues the statement for the period by SMS or email. Sending the same one again changes nothing. */
export function useSendStatement(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channel, ...period }: Period & { channel: keyof typeof CHANNEL }) =>
      apiFetch(`/customers/${id}/statements`, queued, {
        method: "POST",
        body: { channel, ...period },
      }),
    onSuccess: async (_sent, { channel }) => {
      toast.success(`Statement on its way by ${CHANNEL[channel]}`);
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (failure) => toast.error(failure.message),
  });
}

/** A new link to the statement for the period; the address is only known now, so it is used at once. */
function useStatementLink(
  id: string,
  use: (link: { token: string; url: string }) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (period: Period) => {
      const link = await apiFetch(`/customers/${id}/statement/links`, newStatementLink, {
        method: "POST",
        body: period,
      });
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      await use(link);
    },
    onError: (failure) => toast.error(failure.message),
  });
}

/** Makes a link and puts its address on the clipboard. */
export function useCopyStatementLink(id: string) {
  return useStatementLink(id, async ({ url }) => {
    await navigator.clipboard.writeText(url).then(
      () => void toast.success("Link copied. It works for 30 days."),
      () => void toast.message("Copy this link", { description: url, duration: Infinity }),
    );
  });
}

/** Makes a link and downloads the statement behind it as a PDF. */
export function useDownloadStatementPdf(id: string) {
  return useStatementLink(id, ({ token }) =>
    downloadFile(`/public/statements/${token}/pdf`, "statement.pdf", {
      unreachable: "Can't reach the server. Check your connection and try again.",
      denied: "Your account can't download statements.",
      failed: "The statement couldn't be prepared. Try again.",
    }),
  );
}

export function useRevokeStatementLink(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      apiFetch(`/customers/${id}/statement/links/${linkId}`, revoked, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success("Link revoked");
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (failure) => toast.error(failure.message),
  });
}
