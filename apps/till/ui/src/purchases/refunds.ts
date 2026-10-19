import type { BridgeMessage } from "@shopper/sync/bridge";
import type { PurchaseDetails } from "../sale/types";

/** The host names this register's own sale by id; another register's sale only by its receipt number. */
export const refundTarget = (purchase: PurchaseDetails) =>
  purchase.origin === "local" ? { saleId: purchase.id } : { receipt: purchase.receiptNumber ?? "" };

/** A refused or lost refund request in words the return screen shows as they are. */
export function refundFailure(reply: BridgeMessage | undefined) {
  if (reply?.type !== "error")
    return {
      code: "CONNECTION_LOST",
      message: "The register connection ended. Reconnect and check the purchase before retrying.",
    };
  if (reply.code === "permission" || reply.code === "scope")
    return { code: reply.code, message: "Your role cannot refund. Ask a manager." };
  return { code: reply.code, message: reply.message };
}
