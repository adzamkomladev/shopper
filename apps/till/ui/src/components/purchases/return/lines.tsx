import { Minus, Plus } from "lucide-react";
import { formatGHS } from "@shopper/money";
import { Badge } from "@shopper/ui/components/badge";
import { Button } from "@shopper/ui/components/button";
import { Field, FieldLabel } from "@shopper/ui/components/field";
import { Input } from "@shopper/ui/components/input/control";
import { Textarea } from "@shopper/ui/components/textarea";
import { formatQuantity } from "@shopper/utils";
import type { useReturnLines } from "../../../hooks/purchases/return/lines";
import { previewRefund } from "../../../purchases/preview";
import type { EligibilityView, PurchaseDetails } from "../../../sale/types";

type Line = EligibilityView["lines"][number];

/** One row per sale line, each with a quantity the cashier types or steps, never above what is left. */
export function ReturnLinesCard({
  purchase,
  eligibility,
  lines,
}: {
  purchase: PurchaseDetails;
  eligibility: EligibilityView;
  lines: ReturnType<typeof useReturnLines>;
}) {
  const first = eligibility.lines.find((line) => line.status === "eligible")?.lineId;
  return (
    <section aria-label="Items to return" className="rounded-lg border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Items to return</h3>
        <p className="text-xs text-muted-foreground">
          Type a quantity, or use the Up and Down keys. Tab moves to the next item.
        </p>
      </div>
      <ul>
        {eligibility.lines.map((line) => (
          <ReturnLineRow
            autoFocus={line.lineId === first}
            key={line.lineId}
            line={line}
            lines={lines}
            purchase={purchase}
          />
        ))}
      </ul>
    </section>
  );
}

function ReturnLineRow({
  line,
  lines,
  purchase,
  autoFocus,
}: {
  line: Line;
  lines: ReturnType<typeof useReturnLines>;
  purchase: PurchaseDetails;
  autoFocus: boolean;
}) {
  const { lineId, name } = line;
  const quantity = lines.quantities[lineId] ?? 0;
  const disabled = line.status !== "eligible";
  const share = quantity > 0 ? previewRefund(purchase, { [lineId]: quantity }) : null;
  const unit = lines.unitOf(lineId);
  const note =
    line.status === "final"
      ? "Final sale. This item cannot be returned."
      : line.status === "returned"
        ? "Already returned"
        : `Sold ${formatQuantity(line.soldThousandths)}${unit === "each" ? "" : ` ${unit}`} · ${formatQuantity(line.remainingThousandths)} left`;
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_7rem]"
      data-line={lineId}
    >
      <div className="min-w-0">
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground" id={`note-${lineId}`}>
          {note}
        </p>
        {lines.cappedAt(lineId) && (
          <p className="text-xs font-medium text-foreground" role="status">
            Only {formatQuantity(line.remainingThousandths)} left to return
          </p>
        )}
      </div>
      <div className="flex items-center gap-1">
        {disabled ? (
          <Badge variant="secondary">{line.status === "final" ? "Final sale" : "Returned"}</Badge>
        ) : null}
        <Button
          aria-label={`Return one less, ${name}`}
          disabled={disabled || quantity === 0}
          onClick={() => lines.step(lineId, -1)}
          size="icon-touch"
          tabIndex={-1}
          type="button"
          variant="outline"
        >
          <Minus aria-hidden="true" />
        </Button>
        <Input
          aria-describedby={`note-${lineId}`}
          aria-label={`Quantity to return, ${name}`}
          autoFocus={autoFocus}
          className="w-24 text-center tabular-nums"
          disabled={disabled}
          inputMode={unit === "each" ? "numeric" : "decimal"}
          onChange={(event) => lines.set(lineId, event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              lines.step(lineId, event.key === "ArrowUp" ? 1 : -1);
            }
            // Enter here must not send the whole refund.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder="0"
          touch
          value={lines.textOf(lineId)}
        />
        <Button
          aria-label={`Return one more, ${name}`}
          disabled={disabled || quantity >= line.remainingThousandths}
          onClick={() => lines.step(lineId, 1)}
          size="icon-touch"
          tabIndex={-1}
          type="button"
          variant="outline"
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <p className="hidden text-right text-sm font-semibold tabular-nums sm:block">
        {share ? formatGHS(share.gross) : "—"}
      </p>
    </li>
  );
}

export function ReturnReason({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section aria-label="Reason for the return" className="rounded-lg border bg-card p-4 shadow-sm">
      <Field>
        <FieldLabel htmlFor="return-reason-text">Reason</FieldLabel>
        <Textarea
          className="min-h-20"
          id="return-reason-text"
          maxLength={500}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Why is this being returned?"
          value={value}
        />
      </Field>
    </section>
  );
}
