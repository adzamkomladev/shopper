import * as v from "valibot";
import { tillFiscalSignature } from "@shopper/core/schemas";
export type { ReferenceSnapshot as Snapshot } from "@shopper/core/schemas";

/** The server's reply to a page of provisional receipts: the signatures it holds for them. */
export const signaturesReply = v.strictObject({ signatures: v.array(tillFiscalSignature) });
