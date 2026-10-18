import type { Page } from "@playwright/test";

/** The sale screen is rendered with fixture data by apps/till/ui/harness, served by the till-ui dev server only. */
export async function openSale(page: Page, scenario: string) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/harness/index.html?scenario=${scenario}`);
  await page.getByRole("heading", { name: "Checkout", exact: true }).waitFor();
}

/** Previous purchases and Settings live in the Menu drawer, not in the tabs. */
export async function openFromMenu(page: Page, item: "Previous purchases" | "Settings") {
  await page.getByRole("button", { name: /^Menu/ }).click();
  await page
    .getByRole("dialog", { name: "Menu" })
    .getByRole("button", { name: new RegExp(`^${item}`) })
    .click();
}

/** Checkout swaps the cart for the tender step; the tender specs start here. */
export async function openCheckout(page: Page) {
  await page.getByRole("button", { name: /^Checkout/ }).click();
  await page.getByRole("region", { name: "Tender" }).waitFor();
}

export type Call = { type: string; args: unknown[] };
export const calls = (page: Page, type?: string) =>
  page.evaluate(
    (wanted) => window.saleCalls.filter((call) => !wanted || call.type === wanted),
    type,
  ) as Promise<Call[]>;

declare global {
  interface Window {
    saleCalls: Call[];
  }
}
