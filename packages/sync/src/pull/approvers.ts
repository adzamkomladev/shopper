import * as v from "valibot";
import { approverList } from "@shopper/core/schemas";
import { forgetStaff, refreshApprovers as storeApprovers } from "@shopper/core/till";
import { createPushTransport } from "../push/http";
import type { PushOptions } from "../push/types";

/**
 * Fetches who can approve on this register and replaces the till's copy, then forgets anyone no longer allowed to
 * sign in here. Returns false when the server cannot be reached or refuses, so the previous list (and its 7-day
 * clock) stays as it was.
 */
export async function refreshApprovers(options: Pick<PushOptions, "database" | "config" | "now">) {
  const { config } = options;
  const transport = createPushTransport(options);
  let response: Response;
  let raw: string;
  try {
    ({ response, raw } = await transport.request("/sync/approvers"));
  } catch {
    return false;
  }
  if (!response.ok) return false;
  const { approvers, staff } = v.parse(approverList, JSON.parse(raw));
  const context = { orgId: config.orgId, deviceId: config.deviceId, appVersion: config.appVersion };
  await storeApprovers(options.database, context, {
    approvers,
    at: new Date((options.now ?? Date.now)()),
  });
  if (staff) await forgetStaff(options.database, context, { staff });
  return true;
}
