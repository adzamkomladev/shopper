// Screenshots of one state at the five sizes the portal is checked at, each with an axe pass and no horizontal scroll.
//   shoot(page, info, "customer-payment", ready)  ready waits for the state and may answer what to scroll into view
// Set SHOPPER_SCREENSHOTS_DIR to keep the PNGs (docs/plans/day17/screenshots/portal); otherwise they are report attachments.
import { mkdirSync } from "node:fs";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../e2e";

const kept = process.env.SHOPPER_SCREENSHOTS_DIR;
const SIZES = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
] as const;

export async function shoot(
  page: Page,
  info: TestInfo,
  name: string,
  ready: () => Promise<void | Locator>,
) {
  if (kept) mkdirSync(kept, { recursive: true });
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    const target = await ready();
    // The page scrolls inside the shell, so a state below the fold is brought up before the picture.
    await target?.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `${name} overflows at ${width}`,
    ).toBeLessThanOrEqual(width);
    await expectNoSeriousAxe(page);
    const path = kept ? `${kept}/${name}-${width}.png` : info.outputPath(`${name}-${width}.png`);
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    await info.attach(`${name}-${width}`, { path, contentType: "image/png" });
  }
}
