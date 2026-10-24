import type { storeChangeEntities } from "@shopper/db-pg";

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
  entity: (typeof storeChangeEntities)[number];
  entityId: string;
  op: "upsert" | "delete";
  payload: unknown;
};

export type ProductBarcode = { code: string; quantityThousandths: number };
