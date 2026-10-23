// Shared by the customer dialog specs: the harness fixtures' ids and the dialog, field and chip locators.
import { mkdirSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

// Set SHOPPER_SCREENSHOTS_DIR to keep the screenshots (docs/plans/day17/screenshots/till).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
export const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

export const ama = "10000000-0000-7000-8000-000000000501";
export const kofiTraders = "10000000-0000-7000-8000-000000000503";
export const dialog = (page: Page, name = "Add customer") => page.getByRole("dialog", { name });
export const phone = (page: Page) => page.getByRole("combobox", { name: "Customer phone" });
export const chip = (page: Page) => page.getByRole("group", { name: "Customer", exact: true });

export async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/${name}.png` });
}

/** Types a number the way a cashier would and looks it up. */
export async function lookup(page: Page, number: string) {
  await expect(phone(page)).toBeFocused();
  await phone(page).pressSequentially(number, { delay: 20 });
  await page.keyboard.press("Enter");
}

export async function expectFits(page: Page, width: number) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}
