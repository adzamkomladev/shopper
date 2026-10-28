import { request } from "../connection/store";
import type { EnrolInput } from "../schemas/enrol";
import type { EnrolFailure, EnrolOutcome } from "./types";

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
