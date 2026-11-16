import type * as v from "valibot";
import type { kybCase, kybStatuses, queueItem, queueSearch, tenants } from "./platform";
import type { tenantDetail, tenantSearch } from "./tenant";

export type KybStatus = (typeof kybStatuses)[number];
export type QueueTab = v.InferOutput<typeof queueSearch>["status"];
export type QueueItem = v.InferOutput<typeof queueItem>;
export type KybCase = v.InferOutput<typeof kybCase>;
export type Tenant = v.InferOutput<typeof tenants>[number];
export type TenantDetail = v.InferOutput<typeof tenantDetail>;
export type TenantTab = v.InferOutput<typeof tenantSearch>["tab"];
