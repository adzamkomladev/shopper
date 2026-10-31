import type { UpdateStatus } from "@shopper/sync/bridge";

/** `?update=required|ready` on the shell harness: an update waiting on this shift, or an optional one downloaded. */
export function pendingUpdate(scenario: string | null): UpdateStatus | undefined {
  if (scenario !== "required" && scenario !== "ready") return undefined;
  return {
    state: "ready",
    version: "0.2.0",
    percent: 100,
    required: scenario === "required",
    minVersion: scenario === "required" ? "0.2.0" : null,
    channel: "stable",
  };
}
