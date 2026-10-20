import { createContext, use } from "react";
import { CheckIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@shopper/ui/components/data-table";
import { FieldError } from "@shopper/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@shopper/ui/components/input-group";
import {
  countId,
  countText,
  isCounted,
  isUnsaved,
  SHEET_HEADING_ID,
} from "../../../../lib/inventory/takes";
import type { TakeLine } from "../../../../queries/inventory/types";

type Props = {
  lines: TakeLine[];
  drafts: Record<string, string>;
  invalid: Record<string, true>;
  /** The line a till counted after this sheet did. */
  recount?: string;
  focus: { id?: string; ref?: (node: HTMLElement | null) => void };
  disabled: boolean;
  onEdit: (productId: string, text: string) => void;
  onSave: (line: TakeLine) => void;
};

// The cells read the sheet's state from here, so the columns below never change. Columns made on each
// render would be new cell components each time, and every box would be replaced (and lose focus) on each key.
const SheetContext = createContext<Props | null>(null);

function useSheet() {
  const sheet = use(SheetContext);
  if (!sheet) throw new Error("A count cell needs its CountTable");
  return sheet;
}

/** Where a line stands, in words: the status never rests on colour or an icon alone. */
function LineStatus({ line }: { line: TakeLine }) {
  const { drafts, recount } = useSheet();
  if (recount === line.productId)
    return <span className="text-sm font-medium text-destructive">Recount needed</span>;
  if (isUnsaved(line, drafts))
    return <span className="text-sm text-muted-foreground">Press Enter to save</span>;
  return isCounted(line) ? (
    <span className="flex items-center gap-1 text-sm">
      <CheckIcon aria-hidden className="size-4 text-success" />
      Counted
    </span>
  ) : (
    <span className="text-sm text-muted-foreground">Not counted</span>
  );
}

function CountBox({ line }: { line: TakeLine }) {
  const { drafts, invalid, focus, disabled, onEdit, onSave } = useSheet();
  const id = countId(line.productId);
  return (
    <div className="ml-auto flex w-28 flex-col gap-1 text-left sm:w-40">
      <InputGroup>
        <InputGroupInput
          id={id}
          ref={focus.id === line.productId ? focus.ref : undefined}
          aria-label={`Counted ${line.name}`}
          aria-invalid={invalid[line.productId] ? true : undefined}
          aria-describedby={invalid[line.productId] ? `${id}-error` : undefined}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          className="text-right tabular-nums"
          value={countText(line, drafts)}
          onChange={(event) => onEdit(line.productId, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.ctrlKey && !event.metaKey) {
              event.preventDefault();
              onSave(line);
            } else if (event.key === "Escape") {
              // Leaves the box, so the sheet's keys (U, Mod+Enter) work again.
              document.getElementById(SHEET_HEADING_ID)?.focus();
            }
          }}
        />
        <InputGroupAddon align="inline-end">{line.baseUnit}</InputGroupAddon>
      </InputGroup>
      {invalid[line.productId] && (
        <FieldError id={`${id}-error`}>Enter a count like 12 or 2.5, or 0 for none</FieldError>
      )}
    </div>
  );
}

const columns: DataTableColumn<TakeLine>[] = [
  {
    id: "product",
    header: "Product",
    meta: { className: "whitespace-normal" },
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-medium wrap-break-word">{row.original.name}</span>
        <span className="text-xs text-muted-foreground">{row.original.sku}</span>
        {/* A phone has no Status column: the status sits under the name. */}
        <span className="md:hidden">
          <LineStatus line={row.original} />
        </span>
      </div>
    ),
  },
  {
    id: "count",
    header: "Count",
    meta: { align: "right", className: "w-36 sm:w-48" },
    cell: ({ row }) => <CountBox line={row.original} />,
  },
  {
    id: "status",
    header: "Status",
    meta: { className: "hidden md:table-cell" },
    cell: ({ row }) => <LineStatus line={row.original} />,
  },
];

/** The sheet a person counts on: product, then a box for the count in the product's own unit. */
export function CountTable(props: Props) {
  return (
    <SheetContext value={props}>
      <DataTable
        label="Count sheet"
        columns={columns}
        data={props.lines}
        getRowId={(line) => line.productId}
        className="min-h-48"
      />
    </SheetContext>
  );
}
