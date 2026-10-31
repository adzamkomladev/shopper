export type UpdateState = {
  state: "idle" | "checking" | "available" | "downloading" | "ready" | "error";
  version: string | null;
  percent: number | null;
};
/** What the host says: the org's channel, whether this build is below the minimum, and whether a shift is open. */
export type UpdatePolicy = { channel: "pilot" | "stable"; required: boolean; shiftOpen: boolean };
