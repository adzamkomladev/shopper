import { DisplayLines } from "../../components/display/lines";
import { DisplayClosed, DisplayIdle, DisplayPaid } from "../../components/display/notice";
import { DisplayTotal } from "../../components/display/total";
import type { DisplaySnapshot } from "../../display/types";
import { isPriced, rowsOf } from "../../sale/rows";

/**
 * The customer-facing screen on the second monitor. Read-only: it shows the basket, the sale just paid, or
 * that the register is closed. Everything is sized in rem and the root font size follows the window, so the
 * 1920x1080 design scales to any display.
 */
export function DisplayScreen({ snapshot }: { snapshot: DisplaySnapshot }) {
  const { closed, storeName, view, sold } = snapshot;
  const rows = view?.draft?.status === "open" ? rowsOf(view).filter(isPriced) : [];
  const total = view?.settlement?.total ?? view?.quote.totals.gross ?? 0;
  return (
    <>
      <style>{":root{font-size:min(calc(100vw / 120), calc(100vh / 67.5))}"}</style>
      <main className="flex h-screen cursor-none flex-col overflow-hidden bg-muted/50 text-foreground select-none">
        {closed ? (
          <DisplayClosed storeName={storeName} />
        ) : sold ? (
          <DisplayPaid total={sold.total} change={sold.change} />
        ) : rows.length ? (
          <div className="flex min-h-0 flex-1 gap-12 p-20">
            <DisplayLines rows={rows} storeName={storeName} />
            <DisplayTotal total={total} count={rows.length} />
          </div>
        ) : (
          <DisplayIdle storeName={storeName} />
        )}
      </main>
    </>
  );
}
