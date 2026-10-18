type Line = { productId: string } & (
  | { countedThousandths: number }
  | { quantityThousandths: number }
);
export type StockDraft =
  | { kind: "count"; lines: Line[] }
  | { kind: "receipt"; supplier?: string; reference?: string; lines: Line[] };
