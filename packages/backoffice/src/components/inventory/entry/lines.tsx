import { XIcon } from "lucide-react";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Money } from "@shopper/ui/components/money";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@shopper/ui/components/table/primitive";
import { lineId, lineTotal, SEARCH_ID } from "../../../lib/inventory/entry";
import type { DraftLine, Effect, LineErrors, LineField } from "../../../lib/inventory/types";

type Props = {
  lines: DraftLine[];
  errors: LineErrors;
  /** A receipt also takes each product's unit cost and shows the line total. */
  costed: boolean;
  /** What a line does to stock, like "removes 2.5 kg". An adjustment shows it under the quantity. */
  effect?: (line: DraftLine) => Effect | undefined;
  onEdit: (productId: string, field: LineField, value: string) => void;
  onRemove: (productId: string) => void;
};

/** The products on the document. Enter in a field goes to the cost, then back to the search for the next product. */
export function EntryLines({ lines, errors, costed, effect, onEdit, onRemove }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <Table>
        <TableHeader className="max-sm:hidden">
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground">
              Product
            </TableHead>
            <TableHead className="h-10 w-32 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground sm:w-40">
              Quantity
            </TableHead>
            {costed && (
              <>
                <TableHead className="h-10 w-28 bg-muted/50 px-4 text-xs font-semibold text-muted-foreground sm:w-44">
                  Unit cost
                </TableHead>
                <TableHead className="hidden h-10 w-32 bg-muted/50 px-4 text-right text-xs font-semibold text-muted-foreground lg:table-cell">
                  Line total
                </TableHead>
              </>
            )}
            <TableHead className="h-10 w-14 bg-muted/50 px-4">
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => {
            const { quantity, cost } = errors[line.productId] ?? {};
            const total = costed ? lineTotal(line) : null;
            return (
              <TableRow
                key={line.productId}
                className="hover:bg-transparent max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:px-3 max-sm:pb-3"
              >
                <TableCell className="max-w-0 px-4 align-top max-sm:col-start-1 max-sm:row-start-1 max-sm:max-w-none max-sm:px-1">
                  <span title={line.name} className="line-clamp-2 font-medium wrap-break-word">
                    {line.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">{line.sku}</span>
                </TableCell>
                <TableCell
                  className={`px-4 align-top max-sm:px-1 ${costed ? "" : "max-sm:col-span-2"}`}
                >
                  <MobileLabel>Quantity</MobileLabel>
                  <InputGroup>
                    <InputGroupInput
                      id={lineId(line.productId, "quantity")}
                      aria-label={`Quantity for ${line.name}`}
                      aria-invalid={quantity ? true : undefined}
                      aria-describedby={
                        quantity ? `${lineId(line.productId, "quantity")}-error` : undefined
                      }
                      autoFocus
                      inputMode="decimal"
                      className="text-right tabular-nums"
                      value={line.quantity}
                      onChange={(event) => onEdit(line.productId, "quantity", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
                        event.preventDefault();
                        document
                          .getElementById(costed ? lineId(line.productId, "cost") : SEARCH_ID)
                          ?.focus();
                      }}
                    />
                    <InputGroupAddon align="inline-end">{line.baseUnit}</InputGroupAddon>
                  </InputGroup>
                  {quantity && (
                    <FieldMessage id={`${lineId(line.productId, "quantity")}-error`}>
                      {quantity}
                    </FieldMessage>
                  )}
                  {effect?.(line) && <EffectNote effect={effect(line)!} />}
                </TableCell>
                {costed && (
                  <>
                    <TableCell className="px-4 align-top max-sm:px-1">
                      <MobileLabel>Unit cost</MobileLabel>
                      <InputGroup>
                        <InputGroupAddon className="max-sm:hidden">GH₵</InputGroupAddon>
                        <InputGroupInput
                          id={lineId(line.productId, "cost")}
                          aria-label={`Unit cost for ${line.name}`}
                          aria-invalid={cost ? true : undefined}
                          aria-describedby={
                            cost ? `${lineId(line.productId, "cost")}-error` : undefined
                          }
                          inputMode="decimal"
                          className="text-right tabular-nums"
                          value={line.cost}
                          onChange={(event) => onEdit(line.productId, "cost", event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
                            event.preventDefault();
                            document.getElementById(SEARCH_ID)?.focus();
                          }}
                        />
                      </InputGroup>
                      {cost && (
                        <FieldMessage id={`${lineId(line.productId, "cost")}-error`}>
                          {cost}
                        </FieldMessage>
                      )}
                    </TableCell>
                    <TableCell className="hidden px-4 align-top lg:table-cell">
                      <div className="pt-1.5">
                        {total === null ? (
                          <span className="block text-right text-muted-foreground">—</span>
                        ) : (
                          <Money amount={total} />
                        )}
                      </div>
                    </TableCell>
                  </>
                )}
                <TableCell className="px-4 align-top max-sm:col-start-2 max-sm:row-start-1 max-sm:justify-self-end max-sm:px-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${line.name}`}
                    onClick={() => onRemove(line.productId)}
                  >
                    <XIcon aria-hidden />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function FieldMessage({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {children}
    </p>
  );
}

function EffectNote({ effect: { text, tone } }: { effect: Effect }) {
  return tone === "unset" ? (
    <p className="mt-1 text-xs text-muted-foreground">{text}</p>
  ) : (
    <Badge variant={tone === "remove" ? "destructive" : "default"} className="mt-1">
      {text}
    </Badge>
  );
}

/** Phones have no column headers, so each field names itself. */
function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span aria-hidden className="mb-1 block text-xs text-muted-foreground sm:hidden">
      {children}
    </span>
  );
}
