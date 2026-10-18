import type { SaleSnapshot } from "./types";

/** A MoMo payment the customer confirmed that no tender on this sale carries yet. */
export function hasUnappliedConfirmation({ paymentNotice, view }: SaleSnapshot) {
  return (
    paymentNotice?.status === "confirmed" &&
    !view?.draft?.tenders.some((tender) => tender.reference === paymentNotice.reference)
  );
}
