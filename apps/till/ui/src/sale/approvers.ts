import { request } from "../connection/store";
import type { ApprovalPermission, ApproverState } from "./types";

export const loadingApprovers = (permission: ApprovalPermission): ApproverState => ({
  permission,
  status: "loading",
  approvers: [],
  stale: false,
});

/** Who the host says can approve `permission`; a lost connection is a failed list, never an empty one. */
export async function readApprovers(permission: ApprovalPermission): Promise<ApproverState> {
  const reply = await request({ type: "approvers.list", permission });
  const ready = reply?.type === "result" && reply.kind === "approvers";
  return {
    permission,
    status: ready ? "ready" : "failed",
    approvers: ready ? reply.approvers : [],
    stale: ready && reply.stale,
  };
}
