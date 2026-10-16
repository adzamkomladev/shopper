import type { HostConfiguration } from "../config";
export function paymentHeaders(config: HostConfiguration) {
  return {
    authorization: `Bearer ${config.session?.proof ?? ""}`,
    "X-Shopper-Device": config.identity.deviceId,
    "X-Shopper-Device-Token": config.deviceToken,
    "X-Shopper-Org": config.identity.orgId,
    "content-type": "application/json",
  };
}
