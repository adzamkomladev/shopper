// Screenshots of a portal screen at the five review sizes, attached to the report. Set SHOPPER_SCREENSHOTS_DIR
// (docs/plans/day17/screenshots/portal) to keep them as files too.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expectNoSeriousAxe } from "../e2e";
import type { Page, TestInfo } from "@playwright/test";

const SIZES = [
  [1920, 1080],
  [1440, 900],
  [768, 1024],
  [390, 844],
] as const;
const kept = process.env.SHOPPER_SCREENSHOTS_DIR;

/** At each size: waits for `ready`, checks axe and horizontal overflow, then takes a full-page shot. */
export async function shoot(
  page: Page,
  info: TestInfo,
  name: string,
  { sizes = SIZES }: { sizes?: readonly (readonly [number, number])[] } = {},
) {
  if (kept) mkdirSync(kept, { recursive: true });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => document.fonts.ready);
    await expectNoSeriousAxe(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) throw new Error(`${name} overflows horizontally at ${width}px`);
    const path = kept
      ? join(kept, `${name}-${width}.png`)
      : info.outputPath(`${name}-${width}.png`);
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    await info.attach(`${name}-${width}`, { path, contentType: "image/png" });
  }
}
