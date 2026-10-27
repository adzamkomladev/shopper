/** A refund this register asked a manager to approve from the back office, and where that request stands. */
export type RemoteState = {
  status:
    | "idle"
    | "asking"
    | "pending"
    | "approved"
    | "declined"
    | "expired"
    | "offline"
    | "refused";
  id: string | null;
  /** What was asked: the approval holds only for this sale and refund total. */
  saleId: string | null;
  amount: number | null;
  expiresAt: string | null;
  message: string | null;
};
