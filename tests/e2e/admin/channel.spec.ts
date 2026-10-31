// A Shopper admin puts a shop on the pilot till channel from the shops list, so its registers get a release first;
// the choice survives a reload because the server holds it. The shop goes back to stable afterwards.
import { expect, test } from "@playwright/test";
import { E2E_STAFF } from "../../../tooling/database/e2e";
import { MART } from "../../support/e2e";

test("an admin moves a shop to pilot updates and back", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_STAFF.email);
  await page.getByLabel("Password").fill(E2E_STAFF.password);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/kyb/);
  await page.goto("/tenants");
  const channel = page.getByRole("combobox", { name: `Till updates for ${MART.name}` });
  await expect(channel).toHaveText("Stable");

  await channel.click();
  await page.getByRole("option", { name: "Pilot" }).click();
  await expect(page.getByText(`${MART.name} now gets pilot updates`)).toBeVisible();
  await page.reload();
  await expect(channel).toHaveText("Pilot");

  // Keyboard path: focus the select, open it, pick Stable.
  await channel.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: "Stable" }).press("Enter");
  await expect(page.getByText(`${MART.name} now gets stable updates`)).toBeVisible();
  await page.reload();
  await expect(channel).toHaveText("Stable");
});
