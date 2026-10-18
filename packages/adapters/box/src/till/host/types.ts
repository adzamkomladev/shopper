import type { TillDatabase } from "@shopper/db-sqlite";
import type { BridgeRequest, HostStatus } from "@shopper/sync/bridge";
import type { HostConfiguration } from "./config";
import type { createDevices } from "./devices";
import type { createHostPayments } from "./payments";
import type { createPeripherals } from "./peripherals";
import type { createHostReceipts } from "./receipts";
import type { createHostSession } from "./session";

export type Basket = Extract<
  BridgeRequest,
  {
    type:
      | "readDraft"
      | "add"
      | "setQuantity"
      | "removeLine"
      | "tender.add"
      | "tender.remove"
      | "discount.set"
      | "sale.complete"
      | "sale.hold"
      | "sale.resume"
      | "sale.listHeld"
      | "sale.void"
      | "sales.list"
      | "sales.read";
  }
>;
export type Host = {
  database: TillDatabase;
  config: HostConfiguration;
  status: () => Promise<HostStatus>;
  publishStatus: () => Promise<void>;
  sync: () => Promise<void>;
  uploadStock: () => Promise<void>;
  close: () => void;
  payments: ReturnType<typeof createHostPayments>;
  devices: ReturnType<typeof createDevices>;
  receipts: ReturnType<typeof createHostReceipts>;
  peripherals: ReturnType<typeof createPeripherals>;
  session: ReturnType<typeof createHostSession>;
};
