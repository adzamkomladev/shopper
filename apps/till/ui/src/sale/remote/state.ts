import { useSyncExternalStore } from "react";
import { request } from "../../connection/store";
import type { RemoteState } from "./types";

type Transport = typeof request;

const POLL_MS = 2000;
const idle: RemoteState = {
  status: "idle",
  id: null,
  saleId: null,
  amount: null,
  expiresAt: null,
  message: null,
};
const listeners = new Set<() => void>();
let state = idle;
let timer: ReturnType<typeof setTimeout> | undefined;
let transport: Transport = request;

/** Asks the branch's managers; the answer is checked every 2 seconds until it is final. */
export async function askRemote(input: {
  saleId: string;
  receiptNumber?: string;
  amount: number;
  reason: string;
}) {
  resetRemote();
  set({ ...idle, status: "asking", saleId: input.saleId, amount: input.amount });
  apply(await transport({ type: "approval.remote.request", kind: "refund", ...input }));
}

/** Forgets the request, so a changed refund has to be asked again. */
export function resetRemote() {
  clearTimeout(timer);
  set(idle);
}

/** The register refused the approved refund (used, changed or offline): the reason shows and it can be asked again. */
export function refuseRemote(message: string) {
  clearTimeout(timer);
  set({ ...state, status: "refused", message });
}

export const useRemoteApproval = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );

/** The harness answers in place of the host. */
export function setRemoteTransport(next: Transport) {
  transport = next;
}

function apply(reply: Awaited<ReturnType<Transport>>) {
  if (reply?.type !== "result" || reply.kind !== "remoteApproval")
    return set({
      ...state,
      status: "offline",
      message:
        reply?.type === "error"
          ? reply.message
          : "Connect to the internet to ask a manager remotely",
    });
  const id = reply.approval.id;
  set({
    ...state,
    status: reply.approval.status,
    id,
    expiresAt: reply.approval.expiresAt,
    message: reply.approval.declineReason,
  });
  if (reply.approval.status === "pending")
    timer = setTimeout(async () => {
      const next = await transport({ type: "approval.remote.status", approvalId: id });
      // A reset or a newer request while this one was in flight wins.
      if (state.id === id) apply(next);
    }, POLL_MS);
}

function set(next: RemoteState) {
  state = next;
  for (const listener of listeners) listener();
}
