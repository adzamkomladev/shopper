import { boxRenderer } from "@shopper/adapters-box";
import { goldenReceipt } from "./receipt";

// Run under Bun by tests/integration/hardware/render/bun.test.ts.
const png = await boxRenderer().receipt(
  JSON.parse(JSON.stringify(goldenReceipt())),
  { paperMm: 80, reprint: false },
  "png",
);
const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
console.log(
  JSON.stringify({
    signature: [...png.subarray(0, 8)],
    width: view.getUint32(16),
    length: png.length,
  }),
);
