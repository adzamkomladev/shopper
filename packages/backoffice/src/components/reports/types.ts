/** One report column: what it shows of a row, right-aligned for figures, and from which width it shows. */
export type ReportColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  figure?: boolean;
  from?: "sm" | "md" | "lg";
  /** Shown on phones only, standing in for columns that start at `sm`. */
  phone?: boolean;
};
