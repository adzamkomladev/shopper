import type { BridgeMessage } from "@shopper/sync/bridge";
import { request } from "../connection/store";
import type { ReprintFeedback } from "../sale/types";
import { printFailure } from "./delivery";

/** Asks the host to print a stored receipt again; the outcome is in words the screen can show as is. */
export async function sendReprint(saleId: string): Promise<ReprintFeedback> {
  const reply = await request({ type: "receipt.print", saleId });
  if (reply?.type === "result") return { status: "done", message: null };
  return { status: "failed", message: failureText(reply) };
}

function failureText(reply: BridgeMessage | undefined) {
  if (reply?.type !== "error") return "The register connection ended. Reconnect and try again.";
  if (reply.code === "permission" || reply.code === "scope")
    return "Your role cannot reprint receipts.";
  if (reply.code === "PRINTER_UNCONFIGURED") return "Add a printer in Settings.";
  if (reply.code === "PRINTER_OFFLINE") return printFailure(reply.message);
  return reply.message;
}
