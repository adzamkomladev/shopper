import { v7 } from "uuid";
import { readHandshake } from "../connection";
import type { createPushTransport } from "./http";
import type { PushOptions } from "./types";

/** One handshake round trip. `read` validates the answer; `midpoint` is when the server most likely stamped its time. */
export async function requestHandshake(
  transport: ReturnType<typeof createPushTransport>,
  config: PushOptions["config"],
  receiptLastUsed: number,
  now: () => number,
) {
  const requestId = v7();
  const sentAt = now();
  const { response, raw } = await transport.request("/sync/handshake", {
    requestId,
    appVersion: config.appVersion,
    protocol: config.protocol,
    receiptLastUsed,
  });
  return {
    response,
    read: () => readHandshake(JSON.parse(raw), requestId, config.protocol),
    midpoint: () => Math.round((sentAt + now()) / 2),
  };
}
