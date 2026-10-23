import { queryOptions } from "@tanstack/react-query";
import * as v from "valibot";
import { statementDocument } from "@shopper/core/schemas";
import { ApiError } from "../../api/client";

const OFFLINE = "Can't reach the server. Check your connection and try again.";

// The token is the whole credential, so it goes in the path only: never in the console or the query cache for long.
const address = (token: string, tail = "") =>
  `/api/public/statements/${encodeURIComponent(token)}${tail}`;

async function get(path: string) {
  const response = await fetch(path).catch(() => {
    throw new ApiError(0, OFFLINE);
  });
  if (response.status === 404) throw new ApiError(404, "This statement link doesn't work");
  if (response.status === 429)
    throw new ApiError(429, "Too many tries. Wait a minute and try again.");
  return response;
}

/** The statement a customer's link opens. A bad, expired or revoked link is a 404 with nothing else said. */
export function statementQuery(token: string) {
  return queryOptions({
    queryKey: ["statement", token],
    queryFn: async () => {
      const response = await get(address(token));
      if (!response.ok) throw new ApiError(response.status, "The statement couldn't be loaded.");
      const parsed = v.safeParse(statementDocument, await response.json().catch(() => null));
      if (!parsed.success) throw new ApiError(502, "The statement couldn't be read. Try again.");
      return parsed.output;
    },
    gcTime: 0,
    retry: false,
  });
}

/** Fetches the PDF and hands it to the browser as a file, so a failure can be explained on the page. */
export async function downloadStatementPdf(token: string, name: string) {
  const response = await get(address(token, "/pdf"));
  if (!response.ok)
    throw new ApiError(response.status, "The PDF couldn't be made. Try again in a moment.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(await response.blob());
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}
