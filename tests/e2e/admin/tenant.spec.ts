// A Shopper admin opens one shop from the shops list to debug it: the overview names its owner and counts, and the
// tabs, each kept in the address, show its stores and registers, catalogue, staff, verification, billing and
// activity. The keyboard moves between tabs.
import { expect, test } from "@playwright/test";
import { E2E_STAFF } from "../../../tooling/database/e2e";
import { MART } from "../../support/e2e";

test("an admin opens a shop and reads every tab", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/kyb/);
  await page.goto("/tenants");
  await page.getByRole("link", { name: MART.name }).click();

  await expect(page.getByRole("heading", { level: 1, name: MART.name })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Overview", selected: true })).toBeVisible();
  await expect(page.getByText(MART.email)).toBeVisible();

  for (const [tab, shows] of [
    ["Stores", /register/i],
    ["Products", /active/i],
    ["Staff", MART.email],
    ["Verification", /workflows/i],
    ["Billing", /invoices/i],
    ["Activity", /org\.provision|auth\./],
  ] as const) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page).toHaveURL(new RegExp(`tab=${tab.toLowerCase()}`));
    await expect(page.getByRole("tabpanel").getByText(shows).first()).toBeVisible();
  }

  // The address keeps the tab, and arrows walk the tab list.
  await page.reload();
  await expect(page.getByRole("tab", { name: "Activity", selected: true })).toBeVisible();
  await page.getByRole("tab", { name: "Activity" }).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/tab=billing/);
});
