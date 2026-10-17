import { mkdirSync } from "node:fs";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { calls, openSale } from "../sale/harness";

// Set SHOPPER_SCREENSHOTS_DIR to keep the shots (docs/plans/day12/screenshots/settings).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;

/** The settings screen is rendered with fixture data by apps/till/ui/harness; `scenario` picks the host state. */
export async function openSettings(page: Page, scenario = "settings") {
  await openSale(page, scenario);
  await page.getByRole("button", { name: /^Settings/ }).click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
}

export const devices = (page: Page) => page.getByRole("region", { name: "Connected devices" });
export const save = (page: Page) => page.getByRole("button", { name: /^Save changes/ });
export const savedCall = async (page: Page) => (await calls(page, "saveSettings")).at(-1);

export async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const path = shots ? `${shots}/${name}.png` : testInfo.outputPath(`${name}.png`);
  if (shots) mkdirSync(shots, { recursive: true });
  await page.screenshot({ path });
}

export async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
}
