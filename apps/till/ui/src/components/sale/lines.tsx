import type { KeyboardEvent, Ref } from "react";
import { Line } from "./line";
import type { Row } from "../../sale/types";

type Props = {
  rows: Row[];
  selectedId: string | undefined;
  editingId: string | null;
  disabled: boolean;
  listRef: Ref<HTMLUListElement>;
  onSelect: (lineId: string) => void;
  onQuantity: (lineId: string, thousandths: number) => void;
  onEditDone: () => void;
  onRemove: (lineId: string) => void;
};

/** The basket. Focus it with F3: Up and Down move the selection, Delete removes the selected line. */
export function Lines({
  rows,
  selectedId,
  editingId,
  disabled,
  listRef,
  onSelect,
  onQuantity,
  onEditDone,
  onRemove,
}: Props) {
  const index = rows.findIndex((row) => row.lineId === selectedId);
  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = Math.min(
        rows.length - 1,
        Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)),
      );
      onSelect(rows[next]!.lineId);
    } else if (event.key === "Delete" && !disabled && rows[index]) {
      event.preventDefault();
      onRemove(rows[index].lineId);
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        aria-hidden="true"
        className="flex h-7 items-center gap-3 bg-muted px-4 text-xs font-bold text-kbd-foreground"
      >
        <span className="flex-1 pl-1">Item</span>
        <span className="w-36 text-center">Qty</span>
        <span className="w-24 text-right">Price</span>
        <span className="w-28 text-right">Total</span>
        <span className="w-11" />
      </div>
      <ul
        aria-label="Basket lines"
        className="group/lines min-h-0 flex-1 overflow-y-auto outline-none"
        data-zone="basket"
        onKeyDown={onKeyDown}
        ref={listRef}
        // In the tab order so the list can scroll by keyboard even while every line is disabled.
        tabIndex={0}
      >
        {rows.map((row) => (
          <Line
            disabled={disabled}
            editing={editingId === row.lineId}
            key={row.lineId}
            onEditDone={onEditDone}
            onQuantity={(thousandths) => onQuantity(row.lineId, thousandths)}
            onRemove={() => onRemove(row.lineId)}
            onSelect={() => onSelect(row.lineId)}
            row={row}
            selected={row.lineId === selectedId}
          />
        ))}
      </ul>
    </div>
  );
}
