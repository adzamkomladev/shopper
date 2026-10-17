import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { expect, test } from "vite-plus/test";
import type { Json } from "@shopper/ports";
import { boxRenderer } from "@shopper/adapters-box/renderer";
import { goldenReceipt } from "../../../support/hardware/receipt";
import { electronRenderer } from "../../../support/hardware/electron";

// Calibration knobs: the two renderers use different text engines (Satori + resvg vs Chromium),
// so equivalence is a tolerance, not equality. Tighten when measured numbers allow; record any
// loosening in docs/plans/day12/progress.md.
const WIDTH = 576;
const MAX_HEIGHT_DELTA_PX = 8;
const PIXELMATCH_THRESHOLD = 0.2;
const MAX_DIFF_RATIO = 0.0175; // measured 1.16% on the golden receipt
const OUTPUT = process.env.SHOPPER_RENDER_DIFF_DIR;

test("electron and box renderers draw the golden receipt within the calibrated tolerance", async () => {
  const receipt = goldenReceipt() as unknown as Json;
  const options = { paperMm: 80, reprint: false } as const;
  const electron = await electronRenderer(receipt);
  try {
    const [chromium, satori] = await Promise.all([
      electron.renderer.receipt(receipt, options, "png"),
      boxRenderer().receipt(receipt, options, "png"),
    ]);
    const a = PNG.sync.read(Buffer.from(chromium));
    const b = PNG.sync.read(Buffer.from(satori));
    expect([a.width, b.width]).toEqual([WIDTH, WIDTH]);
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(MAX_HEIGHT_DELTA_PX);

    const height = Math.min(a.height, b.height);
    const diff = new PNG({ width: WIDTH, height });
    const different = pixelmatch(
      a.data.subarray(0, WIDTH * height * 4),
      b.data.subarray(0, WIDTH * height * 4),
      diff.data,
      WIDTH,
      height,
      { threshold: PIXELMATCH_THRESHOLD },
    );
    const ratio = different / (WIDTH * height);
    console.log(
      `receipt equivalence: heights ${a.height}/${b.height}, different ${different} px (${(ratio * 100).toFixed(2)}%)`,
    );
    if (OUTPUT) {
      await mkdir(OUTPUT, { recursive: true });
      await writeFile(join(OUTPUT, "electron.png"), chromium);
      await writeFile(join(OUTPUT, "box.png"), satori);
      await writeFile(join(OUTPUT, "diff.png"), PNG.sync.write(diff));
    }
    expect(ratio).toBeLessThanOrEqual(MAX_DIFF_RATIO);
  } finally {
    await electron.close();
  }
}, 90_000);

test("electron renders a receipt taller than the display at its full height", async () => {
  // Xvfb is 1280x1024; a hidden window must not clamp a long receipt to the screen.
  const tall = goldenReceipt(Array.from({ length: 40 }, (_, index) => `Item ${index}`));
  const receipt = tall as unknown as Json;
  const options = { paperMm: 80, reprint: false } as const;
  const electron = await electronRenderer(receipt);
  try {
    const [chromium, satori] = await Promise.all([
      electron.renderer.receipt(receipt, options, "png"),
      boxRenderer().receipt(receipt, options, "png"),
    ]);
    const [a, b] = [PNG.sync.read(Buffer.from(chromium)), PNG.sync.read(Buffer.from(satori))];
    expect(b.height).toBeGreaterThan(2000);
    expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(MAX_HEIGHT_DELTA_PX);
  } finally {
    await electron.close();
  }
}, 90_000);
