import { DocumentForm } from "../../../components/stock/document/form";
import type { DocumentCopy } from "../../../components/stock/document/types";

const copy: DocumentCopy = {
  quantityLabel: "Counted",
  submit: "Queue count",
  emptyTitle: "No products counted yet",
  emptyHint: "Scan or search a product, then enter how many are on the shelf.",
  queued: "Count queued",
};

/** Stock count: the quantity on the shelf per product, which sets what the shop holds. */
export const CountScreen = () => <DocumentForm copy={copy} kind="count" />;
