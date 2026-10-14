export type PullPage =
  | { snapshot: true; head: string }
  | {
      changes: {
        seq: string;
        id: string;
        entity: string;
        entityId: string;
        op: string;
        v: number;
        payload: unknown;
      }[];
      cursor: string;
      head: string;
      hasMore: boolean;
    };

export type Change = {
  entity: "product" | "price" | "tax-rule" | "barcode-mapping";
  entityId: string;
  op: "upsert" | "delete";
  payload: unknown;
};
