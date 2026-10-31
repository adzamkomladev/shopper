import * as v from "valibot";
import { buildInfo } from "@shopper/config";
import { TillError } from "@shopper/core/till";
import { updaterMessage, type UpdateStatus } from "@shopper/sync/bridge";
import { compareVersions } from "@shopper/utils";

/**
 * The register's side of updates. The handshake says the minimum version and the org's channel; the Electron main
 * process runs the updater and reports its state. The host tells main the policy (channel, required, whether a
 * shift is open) whenever it changes, and asks main to restart into a ready update.
 */
// ponytail: the handshake's answer is kept in memory and read once per connection: a raised minimum reaches a running
// till at its next handshake (restart or re-enrol), and a till restarted offline is unblocked until it reconnects,
// which is also when it could first download the update. Re-handshake on a timer or persist it if that matters.
export function createUpdates(send: (message: unknown) => void) {
  let release: Pick<UpdateStatus, "channel" | "minVersion"> = {
    minVersion: null,
    channel: "stable",
  };
  let updater: Pick<UpdateStatus, "state" | "version" | "percent"> = {
    state: "off",
    version: null,
    percent: null,
  };
  let policy = "";
  const status = (): UpdateStatus => ({
    ...updater,
    ...release,
    required:
      release.minVersion !== null && compareVersions(buildInfo.version, release.minVersion) < 0,
  });
  return {
    status,
    handshake(next: { minTillVersion?: string | null; updateChannel?: "pilot" | "stable" }) {
      release = {
        minVersion: next.minTillVersion ?? null,
        channel: next.updateChannel ?? "stable",
      };
    },
    /** True when `message` was the updater's state from main; the caller then publishes the status. */
    receive(message: unknown) {
      const parsed = v.safeParse(updaterMessage, message);
      if (!parsed.success) return false;
      updater = {
        state: parsed.output.state,
        version: parsed.output.version,
        percent: parsed.output.percent,
      };
      return true;
    },
    /** Sends main the policy when it changed since the last status. */
    tell(shiftOpen: boolean) {
      const current = status();
      const next = {
        type: "update-policy",
        channel: current.channel,
        required: current.required,
        shiftOpen,
      };
      if (JSON.stringify(next) === policy) return;
      policy = JSON.stringify(next);
      send(next);
    },
    check: () => send({ type: "update-check" }),
    install(shiftOpen: boolean) {
      if (shiftOpen)
        throw new TillError("SHIFT_OPEN", "Close the shift before restarting to update");
      if (updater.state !== "ready")
        throw new TillError("UPDATE_NOT_READY", "There is no downloaded update to install");
      send({ type: "update-install" });
    },
  };
}
