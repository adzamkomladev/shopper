/// <reference types="vite-plus/client" />
import "../src/styles.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { ShortcutRoot } from "@shopper/ui/hooks/shortcuts";
import { SignInScreen } from "../src/screens/signin/screen";
import type { HostConnection } from "../src/connection/types";
import type { Approval, ApproverState } from "../src/sale/types";
import type { SignInFailure, SignInFailureCode, SignInSnapshot } from "../src/session/types";
import { managerPin, managers } from "./approvals";

declare global {
  interface Window {
    signInCalls: { email: string; password: string }[];
    reconnects: number;
    unlockCalls: { email: string; approval: Approval }[];
  }
}
window.signInCalls = [];
window.reconnects = 0;
window.unlockCalls = [];

// Test-only: the sign-in screen without a host. `?scenario=` is what the screen shows on load and
// `?then=` is how the host answers an attempt (a failure code, or `ok`). `?approvers=failed|none` is the
// host's answer to who may unlock; every manager unlocks with the harness manager PIN.
const failures: Record<SignInFailureCode, string> = {
  INVALID_CREDENTIALS: "Wrong email or password",
  SIGN_IN_LOCKED: "Too many attempts. Try again at 14:35.",
  OFFLINE_UNAVAILABLE: "Connect to the internet to sign in",
  DEVICE_REJECTED: "This register is no longer enrolled. Enroll it again.",
  SIGN_IN_UNAVAILABLE: "Sign-in is unavailable. Try again.",
  HOST_UNREACHABLE: "Cannot reach the register host.",
  OTHER: "Sign-in is unavailable. Try again.",
};
const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") ?? "idle";
const then = params.get("then") ?? "INVALID_CREDENTIALS";
const failureOf = (code: SignInFailureCode): SignInFailure => ({
  code,
  message: failures[code],
  ...(code === "SIGN_IN_LOCKED" && { email: "ama@example.com" }),
});
const approverAnswer = params.get("approvers");
const host: HostConnection =
  scenario === "HOST_UNREACHABLE"
    ? "disconnected"
    : scenario === "connecting"
      ? "connecting"
      : "connected";
const initial: SignInSnapshot =
  scenario === "signing"
    ? { status: "signing", failure: null }
    : scenario in failures
      ? { status: "idle", failure: failureOf(scenario as SignInFailureCode) }
      : { status: "idle", failure: null };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Harness() {
  const [snapshot, setSnapshot] = useState(initial);
  const [signedIn, setSignedIn] = useState(false);
  async function submit(email: string, password: string) {
    window.signInCalls.push({ email, password });
    setSnapshot({ status: "signing", failure: null });
    await sleep(then === "slow" ? 1500 : 200);
    const ok = then === "ok" || then === "slow";
    setSnapshot({ status: "idle", failure: ok ? null : failureOf(then as SignInFailureCode) });
    setSignedIn(ok);
    return ok;
  }
  async function readApprovers(): Promise<ApproverState> {
    await sleep(300);
    const failed = approverAnswer === "failed";
    return {
      permission: "staff.unlock",
      status: failed ? "failed" : "ready",
      approvers: failed || approverAnswer === "none" ? [] : managers,
      stale: false,
    };
  }
  async function unlock(email: string, approval: Approval) {
    window.unlockCalls.push({ email, approval });
    await sleep(200);
    if (approval.pin !== managerPin)
      return { ok: false as const, code: "APPROVAL_INVALID", message: "Wrong PIN" };
    setSnapshot({ status: "idle", failure: null });
    return { ok: true as const };
  }
  return signedIn ? (
    <p role="status">Signed in</p>
  ) : (
    <SignInScreen
      host={host}
      offline={scenario === "offline" || scenario === "OFFLINE_UNAVAILABLE"}
      onReconnect={() => (window.reconnects += 1)}
      onSubmit={submit}
      onUnlock={unlock}
      readApprovers={readApprovers}
      snapshot={snapshot}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <ShortcutRoot>
    <Harness />
  </ShortcutRoot>,
);
