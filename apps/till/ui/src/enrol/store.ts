import { request } from "../connection/store";
import type { EnrolInput } from "../schemas/enrol";
import type { EnrolFailure, EnrolOutcome, ServerOutcome } from "./types";

const named: readonly string[] = ["SHOP_NOT_FOUND", "ENROL_REFUSED", "ENROL_LOCKED"];

/** Asks the host to enrol this till. On success the host restarts on the same bridge and the page reconnects. */
export async function enrolTill(input: EnrolInput): Promise<EnrolOutcome> {
  const reply = await request({ type: "device.enrol", ...input });
  if (reply?.type === "result" && reply.kind === "enrolled")
    return {
      kind: "enrolled",
      shopName: reply.identity.shopName,
      registerName: reply.identity.registerName,
    };
  const code = reply?.type === "error" && named.includes(reply.code) ? reply.code : "OFFLINE";
  return { kind: "refused", code: code as EnrolFailure };
}

/**
 * Asks the register to enrol with the box at a typed address instead. On success the register restarts on it and
 * the page reconnects; otherwise the reason is the cashier's to read.
 */
export async function changeServer(address: string): Promise<ServerOutcome> {
  const reply = await request({ type: "device.server", address });
  if (reply?.type === "result" && reply.kind === "server-changed") return { kind: "changed" };
  if (reply?.type === "error" && reply.code === "SERVER_REFUSED")
    return { kind: "refused", message: reply.message };
  return { kind: "refused", message: "The register did not answer. Try again." };
}
