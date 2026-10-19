import { hostTime, saveRegisterSettings, TillError, validateSession } from "@shopper/core/till";
import type { BridgeMessage, BridgeRequest, HostStatus } from "@shopper/sync/bridge";
import type { TillDatabase } from "@shopper/db-sqlite";
import type { HostConfiguration } from "./config";
import { listPrinters } from "./peripherals/printers";
import type { createPeripherals } from "./peripherals";
import { auditContext } from "./context";
import type { createHostReceipts } from "./receipts";

type DeviceRequest = Extract<
  BridgeRequest,
  { type: "settings.save" | "printer.test" | "drawer.test" | "receipt.print" | "printers.list" }
>;

/** Register settings and the printer and drawer actions; every failure is a TillError the dispatcher reports. */
export function createDevices(host: {
  database: TillDatabase;
  config: HostConfiguration;
  receipts: ReturnType<typeof createHostReceipts>;
  peripherals: ReturnType<typeof createPeripherals>;
  status: () => Promise<HostStatus>;
}) {
  const { database, config, receipts } = host;
  const identity = config.identity;
  return async function devices(request: DeviceRequest): Promise<BridgeMessage> {
    if (!config.session) throw new TillError("session", "Sign in on this register first");
    const deviceTime = new Date();
    await validateSession(database, config.session, {
      scope: identity,
      permission: request.type === "receipt.print" ? "sale.create" : "register.settings",
      at: deviceTime,
    });
    switch (request.type) {
      case "settings.save":
        const saved = await saveRegisterSettings(database, auditContext(config), identity, {
          settings: request.settings,
          expectedRevision: request.expectedRevision,
          session: config.session,
          at: await hostTime(database, identity, deviceTime),
        });
        if (JSON.stringify(saved.before.printer) !== JSON.stringify(saved.after.printer))
          receipts.reset();
        await host.peripherals.reload();
        break;
      case "printer.test":
        await receipts.testPrint();
        break;
      case "drawer.test":
        await receipts.openDrawer();
        break;
      case "receipt.print":
        await receipts.print(request.saleId);
        break;
      case "printers.list":
        return { id: request.id, type: "result", kind: "printers", ...(await listPrinters()) };
    }
    return { id: request.id, type: "result", kind: "status", status: await host.status() };
  };
}
