import {
  closeShift,
  declareShift,
  dropCash,
  openShift,
  printShiftReport,
  readApprovers,
  readShiftReport,
  recordNoSale,
  TillError,
} from "@shopper/core/till";
import type { XReport, ZReport } from "@shopper/core/schemas";
import type { BridgeMessage, BridgeRequest } from "@shopper/sync/bridge";
import type { Host } from "./types";

type Request = Extract<BridgeRequest, { type: `shift.${string}` }>;
type LocalConfig = Parameters<typeof openShift>[1];

/**
 * The register's shift: float, drops and no-sales (the drawer opens after each commits), the X, the blind count
 * and the close, which prints the Z and queues its upload. A printer fault never undoes a record.
 */
export function createShifts(host: Host, localConfig: LocalConfig) {
  const { database, config, receipts } = host;
  const session = () => {
    if (!config.session) throw new TillError("session", "Sign in on this register first");
    return config.session;
  };
  /** After a committed cash movement: publish, then open the drawer; a drawer fault shows on the printer status. */
  const moved = async (id: string): Promise<BridgeMessage> => {
    await host.publishStatus();
    void receipts.openDrawer().catch(() => undefined);
    return { id, type: "result", kind: "status", status: await host.status() };
  };

  async function closed(id: string, report: ZReport) {
    void host.uploadShifts();
    const printed = await print(report);
    await host.publishStatus();
    return { id, type: "result" as const, kind: "shiftClosed" as const, report, printed };
  }
  /** Prints an X or a Z, naming a Z's approver from the register's approver list; false when it failed. */
  async function print(report: XReport | ZReport) {
    try {
      const { approvers } =
        report.kind === "z" && report.approverId
          ? await readApprovers(database, config.identity.orgId, "shift.approve", new Date())
          : { approvers: [] };
      await receipts.printReport(
        report,
        Object.fromEntries(approvers.map((a) => [a.userId, a.name])),
      );
      return true;
    } catch {
      return false;
    }
  }

  return async function shifts(request: Request): Promise<BridgeMessage> {
    const at = new Date();
    switch (request.type) {
      case "shift.open":
        await openShift(database, localConfig, session(), {
          at,
          ...(request.counts ? { counts: request.counts } : { float: request.float }),
        });
        return moved(request.id);
      case "shift.drop":
        await dropCash(database, localConfig, session(), {
          at,
          amount: request.amount,
          ...(request.reason ? { reason: request.reason } : {}),
        });
        return moved(request.id);
      case "shift.nosale":
        await recordNoSale(database, localConfig, session(), { at, reason: request.reason });
        return moved(request.id);
      case "shift.report":
        return {
          id: request.id,
          type: "result",
          kind: "shiftReport",
          report: await readShiftReport(database, localConfig, session(), { at }),
        };
      case "shift.declare": {
        const { counts, card, momo } = request;
        const judged = await declareShift(database, localConfig, session(), {
          at,
          counts,
          card,
          momo,
        });
        // The count is final now, whatever the close does next.
        await host.publishStatus();
        // A count within the threshold closes at once: selling has stopped and no one needs to approve.
        const report = judged.approvalRequired
          ? null
          : await closeShift(database, localConfig, session(), { at });
        const close = report && (await closed(request.id, report));
        return {
          id: request.id,
          type: "result",
          kind: "shiftDeclared",
          variances: judged.variances,
          threshold: judged.threshold,
          approvalRequired: judged.approvalRequired,
          closed: close && { report: close.report, printed: close.printed },
        };
      }
      case "shift.close": {
        const approverId = await host.approvals.verify(request.approval, "shift.approve");
        const report = await closeShift(database, localConfig, session(), {
          at,
          ...(approverId ? { approverId } : {}),
        });
        return closed(request.id, report);
      }
      case "shift.print": {
        const report = await printShiftReport(database, localConfig, session(), {
          at,
          ...(request.shiftId ? { shiftId: request.shiftId } : {}),
        });
        if (!(await print(report)))
          throw new TillError("PRINTER_OFFLINE", "The printer did not print the report");
        return { id: request.id, type: "result", kind: "status", status: await host.status() };
      }
    }
  };
}
