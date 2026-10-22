import type { CSSProperties, ReactNode } from "react";
import type { StatementDocument } from "@shopper/core/schemas";
import { toDecimal } from "@shopper/money";
import { formatDay } from "@shopper/utils";
import { Stack } from "../receipt/parts";

/** A4 across at 96 dpi. */
export const STATEMENT_WIDTH = 794;

const flex: CSSProperties = { display: "flex" };
const kinds: Record<string, string> = {
  charge: "Purchase on account",
  payment: "Payment",
  credit_note: "Credit note",
  interest: "Interest",
  transfer: "Transfer",
};
const columns = [120, 280, 150, 150] as const;
const line = "1px solid #d4d4d8";

/** A customer's statement as a Satori-safe tree: flexbox and inline styles only, shared by the PDF and any HTML. */
export function StatementView({ statement }: { statement: StatementDocument }) {
  const { shop, customer, period, opening, entries, closing } = statement;
  return (
    <Stack
      style={{
        width: STATEMENT_WIDTH,
        padding: 48,
        background: "#fff",
        color: "#18181b",
        fontFamily: "Geist",
        fontSize: 15,
        lineHeight: "22px",
      }}
    >
      <div style={{ ...flex, fontSize: 28, lineHeight: "34px", fontWeight: 700 }}>{shop.name}</div>
      <div style={{ ...flex, color: "#52525b" }}>Statement of account</div>
      <Stack style={{ margin: "24px 0", gap: 2 }}>
        <div style={{ ...flex, fontWeight: 700 }}>{customer.name}</div>
        <div style={flex}>{customer.phone}</div>
        <div style={flex}>
          {formatDay(`${period.from}T00:00:00Z`)} to {formatDay(`${period.to}T00:00:00Z`)}
        </div>
      </Stack>
      <Cells
        style={{ borderTop: line, borderBottom: line, fontWeight: 700 }}
        cells={["Date", "Entry", "Amount (GHS)", "Balance (GHS)"]}
      />
      <Cells
        style={{ borderBottom: line }}
        cells={["", "Balance before", "", toDecimal(opening)]}
      />
      {entries.map((entry, index) => (
        <Cells
          key={index}
          style={{ borderBottom: line }}
          cells={[
            formatDay(entry.occurredAt, false),
            (kinds[entry.kind] ?? entry.kind) + (entry.method ? ` (${entry.method})` : ""),
            toDecimal(entry.amount),
            toDecimal(entry.balance),
          ]}
        />
      ))}
      <Cells
        style={{ fontWeight: 700, fontSize: 17, borderBottom: line }}
        cells={["", "Balance at end", "", toDecimal(closing)]}
      />
      <div style={{ ...flex, marginTop: 16, color: "#52525b", fontSize: 13 }}>
        A balance below zero is credit held for you.
      </div>
    </Stack>
  );
}

function Cells({ cells, style }: { cells: readonly ReactNode[]; style?: CSSProperties }) {
  return (
    <div style={{ ...flex, padding: "6px 0", ...style }}>
      {cells.map((cell, index) => (
        <div
          key={index}
          style={{
            ...flex,
            width: columns[index],
            justifyContent: index > 1 ? "flex-end" : "flex-start",
          }}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}
