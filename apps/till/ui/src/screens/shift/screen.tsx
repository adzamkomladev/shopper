import { useRef, useState } from "react";
import { ShiftReport } from "@shopper/backoffice/shifts";
import { toast } from "@shopper/ui/components/sonner";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { ClosedView } from "../../components/shift/close/done";
import { CloseFlow } from "../../components/shift/close/flow";
import { CloseResult } from "../../components/shift/close/result";
import { ShiftDetails } from "../../components/shift/details";
import { LastShift } from "../../components/shift/last";
import {
  HostLost,
  NoShift,
  PrinterNote,
  ReportFailed,
  ReportRestricted,
  ReportSkeleton,
} from "../../components/shift/states";
import { takeFocus } from "../../hooks/focus";
import { useCloseForm } from "../../hooks/shift/close";
import type { ReprintFeedback } from "../../sale/types";
import type { ShiftActions, ShiftSnapshot } from "../../shift/types";

const say = (feedback: ReprintFeedback, done: string) =>
  feedback.status === "done"
    ? toast.success(done)
    : toast.error(feedback.message ?? "Printing failed");

/**
 * The register's shift: when it opened, the X report for managers, the blind close, and the last Z. It draws one
 * snapshot and reports intent through `actions`; `onOpen` shows the float dialog the shell owns.
 */
export function ShiftScreen({
  snapshot,
  actions,
  active = true,
  onOpen,
}: {
  snapshot: ShiftSnapshot;
  actions: ShiftActions;
  active?: boolean;
  onOpen: () => void;
}) {
  const { phase, current, last, report, closed, host, permissions } = snapshot;
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const can = (permission: string) => permissions.includes(permission);
  const connected = host === "connected";
  const canWrite = can("shift.write");
  const canPrintX = can("report.read");
  const canReprint = can("shift.read") && last !== null;
  const open = phase === "open";
  const counting = phase === "counting" && !closed;

  const printX = async () =>
    open && !closing && canPrintX && connected && say(await actions.printX(), "X report printed");
  const reprint = async () =>
    connected && (canReprint || closed) && say(await actions.reprintZ(), "Z report printed");
  const startClose = () => {
    if (open && canWrite && connected && !closing) setClosing(true);
  };
  function leaveClose() {
    setClosing(false);
    // The flow's last focused control is gone; the button that began it is the way back in.
    requestAnimationFrame(() => closeRef.current?.focus());
  }
  // A flow that is open owns Alt+Z and Escape; two maps with one combo would let this screen win.
  const register = useShortcuts(
    active
      ? {
          "Alt+X": () => void printX(),
          "Alt+R": () => void reprint(),
          "Alt+O": () => !current && canWrite && onOpen(),
          F9: actions.reconnect,
          ...(open && !closing && { "Alt+Z": startClose }),
          ...(closed && { Escape: actions.dismissClosed }),
        }
      : {},
  );
  const openedBy =
    (report.status === "ready" &&
      report.report.cashiers.find((c) => c.userId === current?.openedBy)?.name) ||
    (snapshot.user?.userId === current?.openedBy ? snapshot.user?.name : null) ||
    null;

  return (
    <main
      aria-label="Shift"
      className="flex h-full min-h-0 flex-col gap-4 pt-3 outline-none"
      ref={(node) => {
        const cleanup = register(node);
        takeFocus(node, active);
        return cleanup;
      }}
      tabIndex={-1}
    >
      <header className="shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">Shift</h1>
        <p className="text-sm text-muted-foreground">
          Open the drawer's shift, read the X report and close it with a blind count.
        </p>
      </header>
      <div className="scroll-fade-y -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        <div className="grid content-start gap-4 lg:grid-cols-3">
          {!connected && (
            <div className="lg:col-span-3">
              <HostLost onReconnect={actions.reconnect} />
            </div>
          )}
          {!closed && <PrinterNote state={snapshot.printer} />}
          {closed ? (
            <div className="lg:col-span-3">
              <ClosedView
                closed={closed}
                onDone={actions.dismissClosed}
                offline={!connected}
                onReprint={() => void reprint()}
              />
            </div>
          ) : !current ? (
            <>
              <NoShift canOpen={canWrite} onOpen={onOpen} />
              {last && (
                <LastShift
                  canReprint={canReprint}
                  last={last}
                  offline={!connected}
                  onReprint={() => void reprint()}
                />
              )}
            </>
          ) : (
            <>
              {/* While the count is open nothing else is on the page, so the total and its button stay in view. */}
              {!closing && (
                <>
                  <ShiftDetails
                    canClose={canWrite}
                    canPrintX={canPrintX}
                    closeRef={closeRef}
                    offline={!connected}
                    onClose={startClose}
                    onPrintX={() => void printX()}
                    openedBy={openedBy}
                    shift={current}
                  />
                  {last && (
                    <LastShift
                      canReprint={canReprint}
                      last={last}
                      offline={!connected}
                      onReprint={() => void reprint()}
                    />
                  )}
                </>
              )}
              <div className="grid min-w-0 gap-4 lg:col-span-3">
                {counting ? (
                  <CloseResult actions={actions} active={active} snapshot={snapshot} />
                ) : closing ? (
                  <Closing actions={actions} active={active} onCancel={leaveClose} />
                ) : canPrintX ? (
                  <XReport actions={actions} snapshot={snapshot} />
                ) : (
                  <ReportRestricted />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/** Mounted only while the close is open, so cancelling drops the count. */
function Closing({
  actions,
  active,
  onCancel,
}: {
  actions: ShiftActions;
  active: boolean;
  onCancel: () => void;
}) {
  return <CloseFlow active={active} form={useCloseForm(actions)} onCancel={onCancel} />;
}

function XReport({ snapshot, actions }: { snapshot: ShiftSnapshot; actions: ShiftActions }) {
  const { report } = snapshot;
  if (report.status === "ready") return <ShiftReport report={report.report} />;
  if (report.status === "failed")
    return <ReportFailed message={report.message} onRetry={() => actions.loadReport()} />;
  return snapshot.host === "connected" ? <ReportSkeleton /> : null;
}
