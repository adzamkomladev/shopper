import { useRef } from "react";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { useShortcuts } from "@shopper/ui/hooks/shortcuts";
import { useOnline } from "@shopper/ui/hooks/use-online";
import { ReadOnlyNote } from "../../../../components/admin/states";
import { NoBranch } from "../../../../components/inventory/stock/list/states";
import { MovementsTable } from "../../../../components/inventory/stock/product/movements";
import { ReorderDialog } from "../../../../components/inventory/stock/product/reorder";
import { StockProductSkeleton } from "../../../../components/inventory/stock/product/states";
import { StockSummary } from "../../../../components/inventory/stock/product/summary";
import { Gate, OfflineNote } from "../../../../components/register/states";
import { usePanel } from "../../../../hooks/admin/panel";
import { pickBranch } from "../../../../lib/inventory/format";
import { focusOnMount } from "../../../../lib/focus";
import { stockBranchesQuery, stockProductQuery } from "../../../../queries/inventory/stock";
import { usePermissions } from "../../../../queries/session/permissions";

/** One product at one branch: what is on hand, its reorder level and last cost, and every movement. */
export function StockProductScreen() {
  return (
    <Gate need="stock.read" what="stock" fallback={<StockProductSkeleton />}>
      <ProductBody />
    </Gate>
  );
}

const ROUTE = "/_shop/stock/products/$productId";

function ProductBody() {
  const { productId } = useParams({ from: ROUTE });
  const { branch: requested } = useSearch({ from: ROUTE });
  const { data: branches } = useSuspenseQuery(stockBranchesQuery());
  const branch = pickBranch(branches.branches, requested);
  if (!branch) return <NoBranch />;
  return <Product productId={productId} branch={branch} />;
}

function Product({
  productId,
  branch,
}: {
  productId: string;
  branch: { id: string; name: string };
}) {
  const { data: product } = useSuspenseQuery(stockProductQuery(productId, branch.id));
  const online = useOnline();
  const canWrite = usePermissions()?.includes("stock.write");
  const editRef = useRef<HTMLButtonElement>(null);
  const reorder = usePanel(editRef);
  const edit = () => reorder.show();
  const shortcuts = useShortcuts(canWrite && !reorder.open ? { E: edit } : {});
  const lastCost =
    product.movements.find((movement) => movement.unitCost !== null)?.unitCost ?? null;
  return (
    <div ref={shortcuts} className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 self-start text-muted-foreground"
        >
          <Link to="/stock" search={{ branch: branch.id }}>
            <ArrowLeftIcon aria-hidden />
            Back to stock
          </Link>
        </Button>
        {/* Focused on arrival, so the screen's shortcut works straight after navigating here. */}
        <div className="flex flex-col gap-1">
          <h1
            tabIndex={-1}
            ref={focusOnMount}
            className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
          >
            {product.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {product.sku} · {branch.name}
          </p>
        </div>
      </div>
      {!online && (
        <OfflineNote>
          You're seeing the stock loaded earlier. Changes to the reorder level need a connection.
        </OfflineNote>
      )}
      {!canWrite && (
        <ReadOnlyNote>
          You can view this product's stock. Ask a manager for permission to change reorder levels.
        </ReadOnlyNote>
      )}
      <StockSummary
        product={product}
        lastCost={lastCost}
        onEdit={canWrite ? edit : undefined}
        editRef={editRef}
      />
      <MovementsTable movements={product.movements} unit={product.baseUnit} />
      {product.truncated && (
        <p className="text-sm text-muted-foreground">
          Showing the newest {product.movements.length} movements.
        </p>
      )}
      <ReorderDialog
        product={product}
        branchId={branch.id}
        open={reorder.open}
        onOpenChange={reorder.setOpen}
        restoreFocus={reorder.restoreFocus}
      />
    </div>
  );
}
