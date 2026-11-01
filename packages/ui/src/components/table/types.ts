import { type ColumnDef, type RowData } from "@tanstack/react-table";
import type { features } from "./data";

export type DataTableColumn<TData extends RowData> = ColumnDef<typeof features, TData>;

export type DataTableSkeletonColumn = {
  /** The column's real header: it is static, so it shows as it will. */
  header: string;
  /** The header is read out but not shown, as on a column of row buttons. */
  srOnly?: boolean;
  /** What the loaded column carries: `hidden md:table-cell` to hide below a width, `text-right` for numbers. */
  className?: string;
  /** The block a cell holds, sized like the text it stands for. */
  cell: React.ReactNode;
};
