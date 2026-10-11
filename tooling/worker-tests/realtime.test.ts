import { env } from "cloudflare:test";
import { test } from "vitest";
import { v7 } from "uuid";
import { cloudflareRealtime } from "@shopper/adapters-cf";
import { realtimeConformance } from "@shopper/conformance";

realtimeConformance("StoreHub Durable Object in workerd", test, async () => ({
  orgId: v7(),
  otherOrgId: v7(),
  storeId: v7(),
  realtime: cloudflareRealtime(
    (
      env as {
        STORE_HUB: DurableObjectNamespace<import("@shopper/adapters-cf/coordination").StoreHub>;
      }
    ).STORE_HUB,
  ),
}));
