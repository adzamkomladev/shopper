import { X } from "lucide-react";
import { Button } from "@shopper/ui/components/button";
import { Input } from "@shopper/ui/components/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { quantityId, searchId } from "../../../lib/stock/lines";
import type { DraftLine, Kind } from "../../../lib/stock/types";

/** The products on the document, each with its quantity. Enter in a quantity goes back to the search. */
export function DocumentLines({
  kind,
  lines,
  errors,
  quantityLabel,
  onQuantity,
  onRemove,
}: {
  kind: Kind;
  lines: DraftLine[];
  errors: Record<string, string>;
  quantityLabel: string;
  onQuantity: (productId: string, quantity: string) => void;
  onRemove: (productId: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="w-40">{quantityLabel}</TableHead>
          <TableHead className="w-16">
            <span className="sr-only">Remove</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((line) => {
          const error = errors[line.productId];
          return (
            <TableRow key={line.productId}>
              <TableCell className="max-w-0">
                <span className="block truncate font-medium">{line.name}</span>
                <span className="block text-xs text-muted-foreground">{line.sku}</span>
              </TableCell>
              <TableCell className="align-top">
                <Input
                  aria-describedby={error ? `${quantityId(kind, line.productId)}-error` : undefined}
                  aria-invalid={error ? true : undefined}
                  aria-label={`${quantityLabel} for ${line.name}`}
                  autoFocus
                  className="text-right tabular-nums"
                  id={quantityId(kind, line.productId)}
                  inputMode="decimal"
                  onChange={(event) => onQuantity(line.productId, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
                    event.preventDefault();
                    document.getElementById(searchId(kind))?.focus();
                  }}
                  touch
                  value={line.quantity}
                />
                {error && (
                  <p
                    className="mt-1 text-xs text-destructive"
                    id={`${quantityId(kind, line.productId)}-error`}
                  >
                    {error}
                  </p>
                )}
              </TableCell>
              <TableCell className="align-top">
                <Button
                  aria-label={`Remove ${line.name}`}
                  onClick={() => onRemove(line.productId)}
                  size="icon-touch"
                  variant="ghost"
                >
                  <X aria-hidden />
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
