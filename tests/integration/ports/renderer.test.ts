import { test } from "vite-plus/test";
import type { Json } from "@shopper/ports";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { rendererConformance } from "@shopper/conformance";
import { goldenReceipt } from "../../support/hardware/receipt";

rendererConformance("box renderer", test, async () => ({
  renderer: boxRenderer(),
  receipt: goldenReceipt() as unknown as Json,
  async close() {},
}));
