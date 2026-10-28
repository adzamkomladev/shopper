import { buildInfo } from "@shopper/config";
import { createPushTransport, sessionCredential } from "@shopper/sync";
import type { HostConfiguration } from "../config";

// Offline sessions this host run has had adopted; a later request under one needs no second round trip.
const adopted = new Set<string>();

/**
 * Headers for a live request under the cashier's session. An offline session is adopted on the server first:
 * these requests carry only its proof, and the server knows it only once adopted.
 */
export async function paymentHeaders(config: HostConfiguration) {
  const session = config.session;
  if (session?.parentSessionId && !adopted.has(session.id)) {
    const transport = createPushTransport({
      config: {
        orgId: config.identity.orgId,
        deviceId: config.identity.deviceId,
        appVersion: buildInfo.version,
        protocol: buildInfo.syncProtocol,
        upstream: config.upstream,
        deviceToken: config.deviceToken,
      },
      timeoutMs: 10_000,
    });
    // Unreachable or refused: the request goes ahead and fails like any other the server cannot authorise.
    const reply = await transport
      .request("/sync/sessions", sessionCredential(session))
      .catch(() => undefined);
    if (reply?.response.ok && (JSON.parse(reply.raw) as { adopted?: boolean }).adopted)
      adopted.add(session.id);
  }
  return {
    authorization: `Bearer ${session?.proof ?? ""}`,
    "X-Shopper-Device": config.identity.deviceId,
    "X-Shopper-Device-Token": config.deviceToken,
    "X-Shopper-Org": config.identity.orgId,
    "content-type": "application/json",
  };
}
