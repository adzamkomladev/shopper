import { randomBytes } from "node:crypto";
import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { enrollmentResult } from "@shopper/auth/schemas";
import { bridgeRequest, type BridgeMessage, type BridgeRequest } from "@shopper/sync/bridge";
import { enrolmentConfiguration, shopLookup } from "../../schemas/till/host/config";
import { error, openHostTransport } from "./transport";

type Enrol = Extract<BridgeRequest, { type: "device.enrol" }>;

/**
 * A till with no identity yet: its bridge answers only enrolment. The shop code finds the org, the one-time code
 * enrols the device, and the result is what the register file needs. `enrolled` resolves once its socket is
 * closed, with the port and capability the full host keeps so the page that enrolled reconnects as it was.
 */
export async function startEnrolmentHost(raw: unknown, send: (message: unknown) => void) {
  const config = v.parse(enrolmentConfiguration, raw);
  const capability = randomBytes(32).toString("hex");
  let busy = false;
  let finish: (registration: Registration) => void = () => {};
  const enrolled = new Promise<Registration>((resolve) => {
    finish = resolve;
  });
  const dispatch = async (request: BridgeRequest): Promise<BridgeMessage> => {
    if (request.type === "hello" || request.type === "status")
      return { id: request.id, type: "result", kind: "unenrolled" };
    if (request.type !== "device.enrol")
      return error(request, "UNENROLLED", "Enrol this till before using it");
    if (busy) return error(request, "ENROL_REFUSED", "This till is already enrolling");
    busy = true;
    const outcome = await enrol(config.upstream, request).finally(() => {
      busy = false;
    });
    if ("code" in outcome) return error(request, outcome.code, outcome.message);
    // The reply reaches the page before the socket closes; the full host then takes the same port.
    setTimeout(
      () =>
        void transport.close().then(() => finish({ ...outcome, port: transport.port, capability })),
      250,
    );
    return { id: request.id, type: "result", kind: "enrolled", identity: outcome.identity };
  };
  const transport = await openHostTransport({
    port: config.port,
    origins: config.origins,
    ui: config.ui,
    capability,
    protocol: buildInfo.syncProtocol,
    dispatch,
  });
  send({
    type: "ready",
    port: transport.port,
    capability,
    appVersion: buildInfo.version,
    protocol: buildInfo.syncProtocol,
  });
  return {
    enrolled,
    /** A request on the parent's private channel, answered like one from the page. */
    async receive(value: unknown) {
      const parsed = v.safeParse(bridgeRequest, value);
      send(
        parsed.success
          ? await dispatch(parsed.output)
          : error(value, "INVALID_MESSAGE", "Invalid register request"),
      );
    },
    close: () => transport.close(),
  };
}

type Registration = Exclude<Awaited<ReturnType<typeof enrol>>, { code: string }> & {
  port: number;
  capability: string;
};

async function enrol(upstream: string, request: Enrol) {
  const shop = await call(new URL(`/orgs/${encodeURIComponent(request.shopCode)}`, upstream));
  if ("code" in shop) return shop;
  if (shop.status === 404)
    return refusal("SHOP_NOT_FOUND", "No shop has that code. Check it and try again.");
  const org = v.safeParse(shopLookup, await shop.json().catch(() => null));
  if (!shop.ok || !org.success) return refusal("OFFLINE", "The server did not answer. Try again.");
  const reply = await call(new URL("/devices/enroll", upstream), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopper-Org": org.output.id },
    body: JSON.stringify({ orgId: org.output.id, code: request.code, name: request.name }),
  });
  if ("code" in reply) return reply;
  if (reply.status === 429)
    return refusal("ENROL_LOCKED", "Too many tries. Wait 15 minutes, then create a new code.");
  if (reply.status >= 400 && reply.status < 500)
    return refusal(
      "ENROL_REFUSED",
      "That code is wrong, expired or already used. Create a new one.",
    );
  const result = v.safeParse(enrollmentResult, await reply.json().catch(() => null));
  if (!reply.ok || !result.success)
    return refusal("OFFLINE", "The server did not answer. Try again.");
  return {
    identity: {
      orgId: org.output.id.toLowerCase(),
      deviceId: result.output.deviceId.toLowerCase(),
      storeId: result.output.storeId.toLowerCase(),
      branchId: result.output.branchId.toLowerCase(),
      shopName: org.output.name,
      registerName: request.name,
    },
    deviceToken: result.output.deviceToken,
    receiptCodes: result.output.receiptCodes,
  };
}

const refusal = (code: string, message: string) => ({ code, message });

function call(url: URL, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(10_000) }).catch(() =>
    refusal("OFFLINE", "This till cannot reach the server. Check its connection, then try again."),
  );
}
