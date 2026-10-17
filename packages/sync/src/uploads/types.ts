import type { PushOptions } from "../push/types";

export type ReceiptUploadOptions = Pick<
  PushOptions,
  "database" | "config" | "now" | "random" | "timeoutMs"
> & { onChange?: () => void };

export type StockUploadOptions = ReceiptUploadOptions;
