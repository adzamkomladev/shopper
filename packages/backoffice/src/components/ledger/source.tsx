import { Link } from "@tanstack/react-router";
import type { JournalSource } from "../../schemas/ledger/views";
import { SOURCE_LABELS } from "./labels";

const LINK = "font-medium underline-offset-4 hover:underline focus-visible:underline";

/** What posted an entry, linked to its record where the back office has one (a sale, a shift, a stock record). */
export function SourceLink({ source, id }: { source: JournalSource; id: string }) {
  const label = SOURCE_LABELS[source];
  if (source === "sale")
    return (
      <Link to="/transactions/$saleId" params={{ saleId: id }} className={LINK}>
        {label}
      </Link>
    );
  if (source === "shift")
    return (
      <Link to="/shifts/$shiftId" params={{ shiftId: id }} className={LINK}>
        {label}
      </Link>
    );
  if (source === "stock")
    return (
      <Link to="/stock/records/$documentId" params={{ documentId: id }} className={LINK}>
        {label}
      </Link>
    );
  return <span>{label}</span>;
}
