import { useSyncExternalStore } from "react";
import {
  connectRegister,
  connectionSnapshot,
  request,
  subscribeConnection,
} from "../connection/store";
import { loadingApprovers, readApprovers } from "../sale/approvers";
import type { ApproverState, SaleOutcome } from "../sale/types";
import { phaseOf, printed, shiftFailure } from "./replies";
import type { ShiftActions, ShiftSnapshot } from "./types";

type State = Pick<
  ShiftSnapshot,
  "report" | "judgement" | "approvalRequired" | "closed" | "approvers"
>;
const idleApprovers: ApproverState = {
  permission: null,
  status: "idle",
  approvers: [],
  stale: false,
};
const fresh: State = {
  report: { status: "idle" },
  judgement: null,
  approvalRequired: false,
  closed: null,
  approvers: idleApprovers,
};
const listeners = new Set<() => void>();
let state = fresh;
let composed: { connection: unknown; state: State; value: ShiftSnapshot } | undefined;
let reportRequest = 0;
/** Counts sign-outs, so an answer that arrives for the last user is dropped, not shown to the next. */
let epoch = 0;
let signedBefore = false;

subscribeConnection(() => {
  const { status } = connectionSnapshot();
  const signedIn = status?.user === undefined ? signedBefore : status.user !== null;
  // The next staff member starts with nothing of the last one's close on screen.
  if (!signedIn && signedBefore) {
    state = fresh;
    epoch += 1;
    reportRequest += 1;
  }
  signedBefore = signedIn;
  notify();
});

export function useShiftSnapshot() {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

const can = (permission: string) =>
  (
    connectionSnapshot().status?.user?.permissions ??
    connectionSnapshot().status?.permissions ??
    []
  ).includes(permission);

export const shiftActions: ShiftActions = {
  open: async (input) => {
    const outcome = await run({ type: "shift.open", ...input });
    if (outcome.ok) update({ closed: null, judgement: null, approvalRequired: false });
    return outcome;
  },
  drop: (amount, reason) => run({ type: "shift.drop", amount, ...(reason ? { reason } : {}) }),
  noSale: (reason) => run({ type: "shift.nosale", reason }),
  loadReport,
  printX: async () => printed(await request({ type: "shift.print" })),
  reprintZ: async () => {
    const last = connectionSnapshot().status?.shift?.last;
    return last
      ? printed(await request({ type: "shift.print", shiftId: last.id }))
      : { status: "failed", message: "There is no closed shift to print." };
  },
  declare: async (counts, card, momo) => {
    const at = epoch;
    const reply = await request({ type: "shift.declare", counts, card, momo });
    if (at !== epoch) return shiftFailure(undefined);
    if (reply?.type !== "result" || reply.kind !== "shiftDeclared") return shiftFailure(reply);
    const { variances, threshold, approvalRequired, closed } = reply;
    update({
      judgement: { variances, threshold },
      approvalRequired,
      report: { status: "idle" },
      closed: closed && { ...closed, approverName: null },
    });
    if (approvalRequired) void loadApprovers();
    return { ok: true };
  },
  close: async (approval) => {
    const at = epoch;
    const reply = await request({ type: "shift.close", ...(approval ? { approval } : {}) });
    if (at !== epoch) return shiftFailure(undefined);
    if (reply?.type === "result" && reply.kind === "shiftClosed") {
      const approverName =
        state.approvers.approvers.find((a) => a.userId === approval?.approverId)?.name ?? null;
      update({ closed: { report: reply.report, printed: reply.printed, approverName } });
      return { ok: true };
    }
    const failure = shiftFailure(reply);
    // A counted shift that was reloaded does not remember its variances; the host says when it needs a manager.
    if (failure.code === "APPROVAL_REQUIRED" && !approval) {
      update({ approvalRequired: true });
      void loadApprovers();
    }
    return failure;
  },
  loadApprovers: () => void loadApprovers(),
  dismissClosed: () => update({ closed: null, judgement: null, approvalRequired: false }),
  reconnect: connectRegister,
};

/** One request that changes the register; on success the host's status broadcast carries the new shift. */
async function run(body: Parameters<typeof request>[0]): Promise<SaleOutcome> {
  const at = epoch;
  const reply = await request(body);
  if (at !== epoch) return shiftFailure(undefined);
  if (reply?.type !== "result") return shiftFailure(reply);
  void loadReport(true);
  return { ok: true };
}

async function loadReport(quiet = false) {
  if (!can("report.read") || connectionSnapshot().status?.shift?.current?.status !== "open") return;
  const requestId = ++reportRequest;
  if (!quiet || state.report.status !== "ready") update({ report: { status: "loading" } });
  const reply = await request({ type: "shift.report" });
  if (requestId !== reportRequest) return;
  if (reply?.type === "result" && reply.kind === "shiftReport")
    update({ report: { status: "ready", report: reply.report } });
  else if (!quiet || state.report.status !== "ready")
    update({ report: { status: "failed", message: shiftFailure(reply).message } });
}

async function loadApprovers() {
  const at = epoch;
  update({ approvers: loadingApprovers("shift.approve") });
  const approvers = await readApprovers("shift.approve");
  if (at === epoch) update({ approvers });
}

function snapshot(): ShiftSnapshot {
  const connection = connectionSnapshot();
  if (composed?.connection === connection && composed.state === state) return composed.value;
  const { host, status } = connection;
  const user = status?.user;
  const value: ShiftSnapshot = {
    ...state,
    host,
    phase: phaseOf(status?.shift),
    current: status?.shift?.current ?? null,
    last: status?.shift?.last ?? null,
    permissions: user?.permissions ?? status?.permissions ?? [],
    user: user ? { userId: user.userId, name: user.name } : null,
    printer: status?.printer.state ?? "unconfigured",
  };
  composed = { connection, state, value };
  return value;
}

function update(change: Partial<State>) {
  state = { ...state, ...change };
  notify();
}
const notify = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
