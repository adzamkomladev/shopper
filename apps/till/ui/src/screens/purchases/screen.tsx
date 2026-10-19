import { Search } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input/group";
import { Kbd } from "@shopper/ui/components/kbd";
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
import { ReturnScreen } from "./return/screen";

export function PurchasesScreen({
  snapshot,
  actions,
  output,
  online = true,
  active = true,
}: {
  snapshot: PurchasesSnapshot;
  actions: PurchaseActions;
  /** The register's printer, paper and what the cashier may do; null while the host is unreachable. */
  output: PurchaseOutput | null;
  /** The register can reach the server, so sales from other registers can be found. */
  online?: boolean;
  active?: boolean;
}) {
  const { filters, selected, returning } = snapshot;
  // The return screen has its own Escape, which goes back to the detail.
  const registerShortcuts = useShortcuts(active && !returning ? { Escape: actions.clear } : {});
  const register = (node: HTMLElement | null) => {
    const cleanup = registerShortcuts(node);
    takeFocus(node, active);
    return cleanup;
  };
  const pageCount = Math.max(1, Math.ceil(snapshot.total / snapshot.pageSize));
  const searching = filters.query.trim() !== "";
  function changeFilters(change: Partial<typeof filters>) {
    actions.list({ ...filters, ...change, page: change.page ?? 1 });
  }
  function findOnServer(event: React.KeyboardEvent<HTMLInputElement>) {
    // Enter on a search nothing local answers asks the server, as the row under it says.
    if (event.key !== "Enter" || snapshot.status !== "empty" || !searching || !online) return;
    event.preventDefault();
    if (snapshot.lookup.status !== "loading") actions.lookup(filters.query.trim());
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
          <h1 className="text-3xl font-bold tracking-tight">Previous purchases</h1>
          <p className="text-sm text-muted-foreground">
            Today’s till records. Search to look through every day.
          </p>
        </div>
        {selected && !returning && (
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
        returning ? (
          <ReturnScreen
            actions={actions}
            active={active}
            approvers={snapshot.approvers}
            key={selected.id}
            purchase={selected}
            state={returning}
          />
        ) : (
          <PurchaseDetail
            actions={actions}
            active={active}
            key={selected.id}
            output={output}
            purchase={selected}
            reprint={snapshot.reprint}
          />
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="h-11 min-w-0 flex-1 sm:max-w-md">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search receipts"
                className="h-11"
                onChange={(event) => changeFilters({ query: event.target.value, page: 1 })}
                onKeyDown={findOnServer}
                placeholder="Search receipt number"
                type="search"
                value={filters.query}
              />
            </InputGroup>
            <Select
              value={filters.kind}
              onValueChange={(kind: string) =>
                changeFilters({ kind: kind as typeof filters.kind, page: 1 })
              }
            >
              <SelectTrigger aria-label="Filter by tender" className="w-full sm:w-44" size="touch">
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
          <div className="flex flex-wrap items-end justify-between gap-x-4 border-b">
            <PurchaseStatus
              counts={snapshot.counts}
              onChange={(status) => changeFilters({ status, page: 1 })}
              value={filters.status}
            />
            <p className="pb-2 text-xs font-medium text-muted-foreground">
              {snapshot.total} {snapshot.total === 1 ? "purchase" : "purchases"} ·{" "}
              {searching ? "All days" : "Today"}
            </p>
          </div>
          <PurchaseRows
            actions={actions}
            online={online}
            onPage={(page) => changeFilters({ page })}
            pageCount={pageCount}
            snapshot={snapshot}
          />
        </>
      )}
    </main>
  );
}
