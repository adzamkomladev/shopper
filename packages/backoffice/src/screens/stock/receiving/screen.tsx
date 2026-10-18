import { DocumentForm } from "../../../components/stock/document/form";
import type { DocumentCopy } from "../../../components/stock/document/types";

const copy: DocumentCopy = {
  quantityLabel: "Received",
  submit: "Queue delivery",
  emptyTitle: "No products received yet",
  emptyHint: "Scan or search each product in the delivery, then enter how many arrived.",
  queued: "Delivery queued",
};

/** Receiving: stock that arrived from a supplier, added to what the shop holds. */
export const ReceivingScreen = () => <DocumentForm copy={copy} kind="receipt" />;
