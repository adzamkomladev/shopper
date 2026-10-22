import { env } from "cloudflare:test";
import { test } from "vitest";
import { cloudflareRenderer } from "@shopper/adapters-cf";
import { rendererConformance } from "@shopper/conformance";
import type { Json } from "@shopper/ports";
import { goldenReceipt } from "@shopper/tests/support/hardware/receipt";
import { goldenStatement } from "@shopper/tests/support/hardware/statement";

// Forwards `quickAction` to the local Chromium stand-in, as Browser Run would answer it.
const browser = {
  quickAction: (action: string, options: unknown) =>
    fetch(`${(env as { BROWSER_FAKE_URL: string }).BROWSER_FAKE_URL}/${action}`, {
      method: "POST",
      body: JSON.stringify(options),
    }),
};

rendererConformance("cloudflare renderer", test, async () => ({
  renderer: cloudflareRenderer(browser as Parameters<typeof cloudflareRenderer>[0]),
  receipt: goldenReceipt() as unknown as Json,
  statement: goldenStatement,
  async close() {},
}));
