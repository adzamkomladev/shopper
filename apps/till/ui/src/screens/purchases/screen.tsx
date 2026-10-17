import { Button } from "@shopper/ui/components/button";
import { Kbd } from "@shopper/ui/components/kbd";
import { Input } from "@shopper/ui/components/input/control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@shopper/ui/components/select";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import type { PurchaseActions, PurchaseOutput, PurchasesSnapshot } from "../../sale/types";
import { PurchaseRows } from "../../components/purchases/rows";
import { PurchaseStatus } from "../../components/purchases/status";
import { takeFocus } from "../../hooks/focus";
import { PurchaseDetail } from "./detail/screen";

export function PurchasesScreen({
  snapshot,
  actions,
  output,
  active = true,
}: {
  snapshot: PurchasesSnapshot;
  actions: PurchaseActions;
  /** The register's printer, paper and reprint right; null while the host is unreachable. */
  output: PurchaseOutput | null;
  active?: boolean;
}) {
  const registerShortcuts = useShortcuts(active ? { Escape: actions.clear } : {});
  const register = (node: HTMLElement | null) => {
    const cleanup = registerShortcuts(node);
    takeFocus(node, active);
    return cleanup;
  };
  const { filters, selected } = snapshot;
  const pageCount = Math.max(1, Math.ceil(snapshot.total / snapshot.pageSize));
  function changeFilters(change: Partial<typeof filters>) {
    actions.list({ ...filters, ...change, page: change.page ?? 1 });
  }
  return (
    <main
      aria-label="Purchases"
      className="flex h-full min-h-0 flex-col gap-4 outline-none"
      ref={register}
      tabIndex={-1}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">Today’s till records</p>
        </div>
        {selected && (
          <Button
            aria-keyshortcuts="Escape"
            aria-label="Back to purchases"
            onClick={actions.clear}
            size="touch"
            variant="outline"
          >
            Back to purchases <Kbd>Esc</Kbd>
          </Button>
        )}
      </header>
      {selected ? (
        <PurchaseDetail
          actions={actions}
          active={active}
          key={selected.id}
          output={output}
          purchase={selected}
          reprint={snapshot.reprint}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PurchaseStatus
              value={filters.status}
              onChange={(status) => changeFilters({ status, page: 1 })}
            />
            <div className="flex min-w-0 flex-1 flex-wrap justify-end gap-2 sm:flex-nowrap">
              <Input
                aria-label="Search receipts"
                className="w-full sm:max-w-64"
                onChange={(event) => changeFilters({ query: event.target.value, page: 1 })}
                placeholder="Receipt number"
                touch
                type="search"
                value={filters.query}
              />
              <Select
                value={filters.kind}
                onValueChange={(kind: string) =>
                  changeFilters({ kind: kind as typeof filters.kind, page: 1 })
                }
              >
                <SelectTrigger
                  aria-label="Filter by tender"
                  className="w-full sm:w-44"
                  size="touch"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem className="min-h-11" value="all">
                    All tenders
                  </SelectItem>
                  <SelectItem className="min-h-11" value="cash">
                    Cash
                  </SelectItem>
                  <SelectItem className="min-h-11" value="momo">
                    Mobile money
                  </SelectItem>
                  <SelectItem className="min-h-11" value="card">
                    Card
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <PurchaseRows
            snapshot={snapshot}
            actions={actions}
            pageCount={pageCount}
            onPage={(page) => changeFilters({ page })}
          />
        </>
      )}
    </main>
  );
}
