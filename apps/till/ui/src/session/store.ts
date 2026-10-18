import { useSyncExternalStore } from "react";
import {
  connectionSnapshot,
  registerCapability,
  request,
  subscribeConnection,
} from "../connection/store";
import type { SignInFailure, SignInFailureCode, SignInSnapshot } from "./types";

const codes: readonly SignInFailureCode[] = [
  "INVALID_CREDENTIALS",
  "SIGN_IN_LOCKED",
  "OFFLINE_UNAVAILABLE",
  "DEVICE_REJECTED",
  "SIGN_IN_UNAVAILABLE",
];
const listeners = new Set<() => void>();
let snapshot: SignInSnapshot = { status: "idle", failure: null };
let unlockedFor: string | null = null;

export function useSignInSnapshot() {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

/** Signs in through the host; true when the register now has a user. */
export async function signIn(email: string, password: string) {
  publish({ status: "signing", failure: null });
  const reply = await request({ type: "session.signIn", email, password });
  if (reply?.type === "result") {
    publish({ status: "idle", failure: null });
    return true;
  }
  publish({ status: "idle", failure: failureOf(reply) });
  return false;
}

export async function signOut() {
  await request({ type: "session.signOut" });
}

/** The host cookie that lets `/api` answer rotates on sign-out, so unlock once per signed-in user. */
export function initializeSession() {
  subscribeConnection(() => {
    const { host, status } = connectionSnapshot();
    const user = host === "connected" ? status?.user : undefined;
    if (!user) {
      if (status?.user === null) unlockedFor = null;
      return;
    }
    if (unlockedFor === user.userId) return;
    unlockedFor = user.userId;
    // ponytail: one attempt per sign-in; the back office reports a locked register itself.
    void unlock();
  });
}

async function unlock() {
  const capability = registerCapability();
  if (!capability) return;
  const response = await fetch("/desktop/unlock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ capability }),
  }).catch(() => undefined);
  if (!response?.ok) unlockedFor = null;
}

function failureOf(reply: Awaited<ReturnType<typeof request>>): SignInFailure {
  if (!reply)
    return {
      code: "HOST_UNREACHABLE",
      message: "Cannot reach the register host. Reconnect, then try again.",
    };
  const code = reply.type === "error" ? codes.find((known) => known === reply.code) : undefined;
  const message = reply.type === "error" ? reply.message : "Sign-in is unavailable. Try again.";
  return { code: code ?? "OTHER", message };
}

function publish(next: SignInSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
