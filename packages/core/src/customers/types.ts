import type { UploadPrincipal } from "../sales/types";

/** Who is acting from a register: the device, a live session of the cashier and its proof. */
export type Authority = {
  principal: UploadPrincipal;
  sessionId: string;
  cashierId: string;
  proofHash: string;
};
