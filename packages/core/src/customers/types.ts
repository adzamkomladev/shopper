import type { allocateRefund } from "./credit/refunds";
import type { UploadPrincipal } from "../sales/types";

/** Who is acting from a register: the device, a live session of the cashier and its proof. */
export type Authority = {
  principal: UploadPrincipal;
  sessionId: string;
  cashierId: string;
  proofHash: string;
};

/** How a refund is paid back: to the account, to redeemed points, and the rest in its own tender. */
export type RefundAllocation = ReturnType<typeof allocateRefund>;
