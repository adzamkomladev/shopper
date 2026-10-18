import type { KeyboardEvent, Ref } from "react";
import { Line } from "./line";
import type { Row } from "../../sale/types";

type Props = {
  rows: Row[];
  selectedId: string | undefined;
  disabled: boolean;
  revealSelected: boolean;
  listRef: Ref<HTMLUListElement>;
  onSelect: (lineId: string) => void;
  onRemove: (lineId: string) => void;
};

/** The basket. Focus it with F3: Up and Down move the selection, Delete removes the selected line. */
export function Lines({
  rows,
  selectedId,
  disabled,
  revealSelected,
  listRef,
  onSelect,
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
    <ul
      aria-label="Basket lines"
      className="group/lines flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 outline-none"
      data-zone="basket"
      onKeyDown={onKeyDown}
      ref={listRef}
      // In the tab order so the list can scroll by keyboard even while every line is disabled.
      tabIndex={0}
    >
      {rows.map((row, position) => (
        <Line
          key={row.lineId}
          onSelect={() => onSelect(row.lineId)}
          position={position + 1}
          revealSelected={revealSelected}
          row={row}
          selected={row.lineId === selectedId}
        />
      ))}
    </ul>
  );
}
