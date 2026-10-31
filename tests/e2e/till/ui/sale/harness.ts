import type { Page } from "@playwright/test";

/** The sale screen is rendered with fixture data by apps/till/ui/harness, served by the till-ui dev server only. */
export async function openSale(page: Page, scenario: string) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/harness/index.html?scenario=${scenario}`);
  await page.getByRole("heading", { name: "Checkout", exact: true }).waitFor();
}

/** The register's sidebar entry: its sections, then the register's own screens and cash actions. */
export const sidebarItem = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Register" }).getByRole("button", { name, exact: true });

/** Opens a sidebar entry; the till's sidebar is an icon rail whose buttons keep their names. */
export async function openFromSidebar(
  page: Page,
  item: "Previous purchases" | "Register settings" | "Account payment",
) {
  await sidebarItem(page, item).click();
}

/** Checkout swaps the cart for the tender step; the tender specs start here. */
export async function openCheckout(page: Page) {
  // The sidebar's Checkout section is a button too; the cart's carries Ctrl+Enter.
  await page
    .getByRole("button", { name: /^Checkout/ })
    .and(page.locator("[aria-keyshortcuts='Control+Enter']"))
    .click();
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
