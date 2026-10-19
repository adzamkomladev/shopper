import { expect, type Locator, type Page } from "@playwright/test";
import { openFromMenu, openSale } from "../sale/harness";

/** Previous purchases with fixture data; `scenario` picks the list, the sale, the host and the permissions. */
export async function openPurchases(page: Page, scenario = "lines") {
  await openSale(page, scenario);
  await openFromMenu(page, "Previous purchases");
  await expect(
    page.getByRole("heading", { name: "Previous purchases", exact: true }),
  ).toBeVisible();
}

/** A row's button is named by its time and its receipt number: "09:30 AM #10482". */
export const receiptRow = (page: Page, number: string) =>
  page.getByRole("button", { name: new RegExp(`[AP]M #${number}$`) });

export async function openDetail(page: Page, scenario = "lines", number = "10482") {
  await openPurchases(page, scenario);
  await receiptRow(page, number).click();
  await expect(page.getByRole("heading", { name: `Purchase #${number}` })).toBeVisible();
}

export const startReturn = (page: Page) =>
  page
    .getByRole("region", { name: "Purchase details" })
    .getByRole("button", { name: /^Start return/ });
export const returnScreen = (page: Page) => page.getByRole("region", { name: "Return items" });
export const quantity = (page: Page, product: string) =>
  page.getByRole("textbox", { name: `Quantity to return, ${product}` });
export const toast = (page: Page) => page.locator("[data-sonner-toast]");
export const refundButton = (page: Page) => page.getByRole("button", { name: /^Refund GH₵/ });

/** Opens the return screen from the detail with Alt+E; `ready` waits for the first quantity to take focus. */
export async function openReturn(page: Page, scenario = "return", ready = true) {
  await openDetail(page, scenario);
  await page.keyboard.press("Alt+E");
  await expect(returnScreen(page)).toBeVisible();
  if (ready) await expect(quantity(page, "Milo 400g tin")).toBeFocused();
}

export async function expectInside(page: Page, target: Locator) {
  const [box, width] = await Promise.all([target.boundingBox(), page.evaluate(() => innerWidth)]);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}
