import type * as v from "valibot";
import type { kybCase, kybStatuses, queueItem, queueSearch, tenants } from "./platform";

export type KybStatus = (typeof kybStatuses)[number];
export type QueueTab = v.InferOutput<typeof queueSearch>["status"];
export type QueueItem = v.InferOutput<typeof queueItem>;
export type KybCase = v.InferOutput<typeof kybCase>;
export type Tenant = v.InferOutput<typeof tenants>[number];
