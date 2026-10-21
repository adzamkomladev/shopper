import { v7 } from "uuid";
import { api } from "../till/server";
import { syncHeaders } from "../till/requests";
import type { inventorySession } from "../till/stock";

/** A till posts a stock document to /sync/stock as the given session. */
export const till = (
  document: Record<string, unknown>,
  session: Awaited<ReturnType<typeof inventorySession>>,
) =>
  api.request("/sync/stock", {
    method: "POST",
    headers: syncHeaders(),
    body: JSON.stringify({
      requestId: v7(),
      proof: session.proof,
      document: {
        v: 1,
        id: v7(),
        actorId: session.userId,
        sessionId: session.sessionId,
        ...document,
      },
    }),
  });
