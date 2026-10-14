import { type ColumnDef, type RowData } from "@tanstack/react-table";
import type { features } from "./data";

export type DataTableColumn<TData extends RowData> = ColumnDef<typeof features, TData>;
