import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import { auditStreams, streamVerification } from "../../schemas/audit";
import { currentShop } from "../../stores/shops";

/** The org chain and every register chain with its head and last anchor. */
export const auditStreamsQuery = (shop = currentShop()) =>
  queryOptions({
    queryKey: ["audit", shop?.id ?? "box", "streams"],
    queryFn: () => apiFetch("/audit/streams", auditStreams),
  });

/** Re-hashes one chain end to end on the server. Never cached: a verdict is only true when it is asked for. */
export const verifyStream = (stream: string) =>
  apiFetch(`/audit/verify?${new URLSearchParams({ stream })}`, streamVerification);
