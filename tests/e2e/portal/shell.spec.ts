import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe, MART, OWNER_NAME } from "../../support/e2e";

// Runs on the saved owner session, so it signs nobody in.
test.beforeEach(async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
});

test("the shell has no serious axe violations, closed or with its menus open", async ({ page }) => {
  await expectNoSeriousAxe(page);
  await page.getByRole("navigation").getByRole("combobox").click();
  await expect(page.getByRole("option", { name: MART.name })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: OWNER_NAME }).click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("slash focuses search, Mod+K opens the palette and closing returns focus to search", async ({
  page,
}) => {
  const search = page.getByRole("navigation").getByRole("textbox", { name: "Search" });
  await page.keyboard.press("/");
  await expect(search).toBeFocused();
  await page.keyboard.press("Escape");
  await page.locator("main").click();
  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("option", { name: "Products" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(search).toBeFocused();
});

test("picking a page in the palette navigates there", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+K");
  await page.getByRole("option", { name: "Import" }).click();
  await expect(page).toHaveURL(/\/imports$/);
});
