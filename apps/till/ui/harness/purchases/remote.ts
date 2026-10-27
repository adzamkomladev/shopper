// Test-only: the host's answers to "Ask a manager", so the till UI harness can show every remote approval state.
import { setRemoteTransport } from "../../src/sale/remote/state";
import { id } from "../fixtures";
import { scenarioOf } from "./scenarios";

type Recorder = (type: string) => (...args: unknown[]) => unknown;

/** The request is pending first; the first status check answers the way the scenario says. */
export function remoteHarness(name: string, record: Recorder) {
  const answer = scenarioOf(name).remote;
  if (!answer) return;
  const expiresAt = new Date(Date.UTC(2026, 9, 27, 10, 40)).toISOString();
  const reply = (status: "pending" | "approved" | "declined" | "expired") => ({
    id: id("99"),
    type: "result" as const,
    kind: "remoteApproval" as const,
    approval: {
      id: id("90"),
      status,
      expiresAt,
      declineReason: status === "declined" ? "The tin is not damaged" : null,
    },
  });
  setRemoteTransport(async (body) => {
    record(body.type)(body);
    if (answer === "offline")
      return {
        id: id("99"),
        type: "error",
        code: "APPROVAL_OFFLINE",
        message: "Connect to the internet to ask a manager remotely",
      };
    return body.type === "approval.remote.status" ? reply(answer) : reply("pending");
  });
}
