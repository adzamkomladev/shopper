import { useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { focusOnMount } from "../../lib/focus";
import { BarcodesCard } from "./barcodes-card";
import { DetailsForm } from "./details-form";
import type { PriceMode } from "./forms";
import { PriceDialog } from "./price-dialog";
import { PricesCard } from "./prices-card";
import { productQuery } from "./queries";
import { useProductShortcuts } from "./use-product-shortcuts";

export function ProductScreen() {
  const { productId } = useParams({ from: "/_shop/products/$productId" });
  const { data: product, dataUpdatedAt } = useSuspenseQuery(productQuery(productId));
  // The mode outlives the dialog, so its content stays put while it fades out.
  const [price, setPrice] = useState<{ mode: PriceMode; open: boolean }>({
    mode: "set",
    open: false,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const setPriceRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<Element | null>(null);
  const openPrice = (mode: PriceMode) => {
    openerRef.current = document.activeElement;
    setPrice({ mode, open: true });
  };
  // Focus goes back to whatever opened the dialog (a key press leaves no trigger for Radix to find).
  const restoreFocus = () => {
    const opener = openerRef.current;
    const usable = opener instanceof HTMLElement && opener.isConnected && opener !== document.body;
    (usable ? opener : setPriceRef.current)?.focus();
  };
  const shortcuts = useProductShortcuts(
    price.open
      ? {}
      : { save: () => formRef.current?.requestSubmit(), setPrice: () => openPrice("set") },
  );
  return (
    <div ref={shortcuts} className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="-ml-3 self-start text-muted-foreground"
        >
          <Link to="/products">
            <ArrowLeftIcon aria-hidden />
            Back to products
          </Link>
        </Button>
        {/* Focused on arrival, so the screen's shortcuts work straight after navigating here. */}
        <h1
          tabIndex={-1}
          ref={focusOnMount}
          className="text-3xl font-bold tracking-tight wrap-break-word outline-none"
        >
          {product.name}
        </h1>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DetailsForm key={product.id} product={product} formRef={formRef} />
          <BarcodesCard product={product} />
        </div>
        <PricesCard
          product={product}
          fetchedAt={dataUpdatedAt}
          setPriceRef={setPriceRef}
          onSetPrice={() => openPrice("set")}
          onSchedule={() => openPrice("schedule")}
        />
      </div>
      <PriceDialog
        productId={product.id}
        mode={price.mode}
        open={price.open}
        onOpenChange={(open) => setPrice({ ...price, open })}
        restoreFocus={restoreFocus}
      />
    </div>
  );
}
