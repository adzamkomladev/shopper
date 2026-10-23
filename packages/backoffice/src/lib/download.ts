import { ApiError } from "../api/client";
import { currentShop } from "../stores/shops";

type Messages = { unreachable: string; denied: string; failed: string };

/** Fetches an API path and hands the reply to the browser as a file, so a failure can be explained. */
export async function downloadFile(path: string, filename: string, messages: Messages) {
  const shop = currentShop()?.id;
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: shop ? { "X-Shopper-Org": shop } : undefined,
  }).catch(() => {
    throw new ApiError(0, messages.unreachable);
  });
  if (!response.ok)
    throw new ApiError(
      response.status,
      response.status === 403 ? messages.denied : messages.failed,
    );
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
