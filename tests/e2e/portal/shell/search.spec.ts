import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe, MART, OWNER_NAME } from "../../../support/e2e";

// Runs on the saved owner session, so it signs nobody in.
test.beforeEach(async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
});

test("the shell has no serious axe violations, closed or with its menus open", async ({ page }) => {
  await expectNoSeriousAxe(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("combobox").click();
  await expect(page.getByRole("option", { name: MART.name })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: OWNER_NAME }).click();
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("slash and Mod+K open the palette, and closing it returns focus to Search", async ({
  page,
}) => {
  // Products has its own search, so "/" belongs to the page there; Import has none.
  await page.goto("/imports");
  await expect(page.getByRole("heading", { name: "Import", level: 1 })).toBeVisible();
  const search = page.getByRole("banner").getByRole("button", { name: "Search" });
  // The middle of Import is its upload field, where "/" is typing; the heading is not.
  const heading = page.getByRole("heading", { name: "Import", level: 1 });
  await heading.click();
  await page.keyboard.press("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(search).toBeFocused();
  await heading.click();
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

test("? lists the shortcuts, from everywhere and from the page's own buttons", async ({ page }) => {
  await page.locator("main").click();
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog.getByRole("region", { name: "Everywhere" })).toContainText("Search");
  await expect(dialog.getByRole("region", { name: "This page" })).toBeVisible();
  await dialog.getByRole("textbox", { name: "Search shortcuts" }).fill("sidebar");
  await expect(dialog.getByRole("region")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("buttons show no key chips; their shortcuts are announced instead", async ({ page }) => {
  await expect(page.locator("main button kbd, main a kbd")).toHaveCount(0);
  await expect(page.locator("main [aria-keyshortcuts]").first()).toBeAttached();
});
