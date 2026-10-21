import { useState } from "react";
import { CircleCheck, PackageSearch } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@shopper/ui/components/alert";
import { Button } from "@shopper/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@shopper/ui/components/empty";
import { Input } from "@shopper/ui/components/input";
import { Kbd } from "@shopper/ui/components/kbd";
import { Label } from "@shopper/ui/components/label";
import { ApiError } from "../../../api/client";
import { documentLines, lineErrors, quantityId, searchId } from "../../../lib/stock/lines";
import type { DraftLine, Kind } from "../../../lib/stock/types";
import { productSearchQuery } from "../../../queries/stock/products";
import { useQueueStock } from "../../../queries/stock/queue";
import type { StockProduct } from "../../../schemas/stock/queue";
import { DocumentLines } from "./lines";
import { ProductSearch } from "./search";
import type { DocumentCopy } from "./types";

const optional = (key: "supplier" | "reference", value: string) =>
  value.trim() ? { [key]: value.trim() } : {};

/**
 * A stock document being built: scan or search products, enter quantities, queue it on the register.
 * Ctrl+Enter queues from anywhere inside it. Receiving also takes a supplier and a reference.
 */
export function DocumentForm({ kind, copy }: { kind: Kind; copy: DocumentCopy }) {
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [noLines, setNoLines] = useState(false);
  const queue = useQueueStock();

  function add(product: StockProduct) {
    setDone(false);
    setNoLines(false);
    if (lines.some((line) => line.productId === product.productId))
      return document.getElementById(quantityId(kind, product.productId))?.focus();
    setLines([...lines, { ...product, quantity: "" }]);
  }

  function submit() {
    if (queue.isPending) return;
    const found = lineErrors(kind, lines);
    setErrors(found);
    const first = lines.find((line) => found[line.productId]);
    if (first) return document.getElementById(quantityId(kind, first.productId))?.focus();
    if (!lines.length) return setNoLines(true);
    const body = documentLines(kind, lines);
    queue.mutate(
      kind === "count"
        ? { kind, lines: body }
        : {
            kind,
            lines: body,
            ...optional("supplier", supplier),
            ...optional("reference", reference),
          },
      {
        onSuccess: () => {
          setLines([]);
          setSupplier("");
          setReference("");
          setDone(true);
        },
      },
    );
  }

  return (
    <div
      className="flex flex-col gap-5"
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        submit();
      }}
      role="group"
      aria-label={kind === "count" ? "Stock count" : "Stock receiving"}
    >
      <ProductSearch id={searchId(kind)} query={productSearchQuery} onPick={add} />
      {done && (
        <Alert role="status">
          <CircleCheck aria-hidden />
          <AlertTitle>{copy.queued}</AlertTitle>
          <AlertDescription>It uploads when the register is online.</AlertDescription>
        </Alert>
      )}
      {noLines && (
        <Alert variant="destructive">
          <AlertTitle>Add a product first</AlertTitle>
          <AlertDescription>Scan or search for a product to put on this document.</AlertDescription>
        </Alert>
      )}
      {queue.isError && (
        <Alert variant="destructive">
          <AlertTitle>Couldn't queue it</AlertTitle>
          <AlertDescription>
            {queue.error instanceof ApiError && queue.error.status === 403
              ? "Your account can't enter stock."
              : queue.error.message}
          </AlertDescription>
        </Alert>
      )}
      {lines.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearch aria-hidden />
            </EmptyMedia>
            <EmptyTitle>{copy.emptyTitle}</EmptyTitle>
            <EmptyDescription>{copy.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <DocumentLines
            kind={kind}
            errors={errors}
            lines={lines}
            onQuantity={(productId, quantity) => {
              setErrors(({ [productId]: _cleared, ...rest }) => rest);
              setLines(lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)));
            }}
            onRemove={(productId) => setLines(lines.filter((l) => l.productId !== productId))}
            quantityLabel={copy.quantityLabel}
          />
        </div>
      )}
      {kind === "receipt" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock-supplier">Supplier (optional)</Label>
            <Input
              className="bg-card"
              id="stock-supplier"
              maxLength={200}
              onChange={(event) => setSupplier(event.target.value)}
              touch
              value={supplier}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stock-reference">Delivery note or invoice (optional)</Label>
            <Input
              className="bg-card"
              id="stock-reference"
              maxLength={200}
              onChange={(event) => setReference(event.target.value)}
              touch
              value={reference}
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-end gap-3">
        <Button
          aria-keyshortcuts="Control+Enter"
          disabled={queue.isPending}
          onClick={submit}
          size="touch"
        >
          {queue.isPending ? "Queuing" : copy.submit}{" "}
          <Kbd className="max-sm:hidden">Ctrl+Enter</Kbd>
        </Button>
      </div>
    </div>
  );
}
