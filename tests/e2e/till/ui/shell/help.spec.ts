import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";

const help = (page: Page) => page.getByRole("dialog", { name: "Help" });
const checkout = (page: Page) => page.getByRole("heading", { name: "Checkout", exact: true });

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/harness/index.html?scenario=lines");
  await expect(checkout(page)).toBeVisible();
});

test("F1, Ctrl+/ and the header button open Help, and Escape closes it", async ({ page }) => {
  await checkout(page).click();
  await page.keyboard.press("F1");
  await expect(help(page)).toBeVisible();
  await expect(help(page).getByRole("region", { name: "Navigation" })).toContainText("Checkout");
  await expect(help(page).getByRole("region", { name: "Tender" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Escape");
  await expect(help(page)).toBeHidden();

  await page.keyboard.press("Control+/");
  await expect(help(page)).toBeVisible();
  await page.keyboard.press("Escape");

  const button = page.getByRole("banner").getByRole("button", { name: "Help" });
  await button.click();
  await expect(help(page)).toBeVisible();
  await page.keyboard.press("Escape");
  // On Checkout the scan field takes the cursor back, so the next barcode lands in the search.
  await expect(page.getByRole("combobox")).toBeFocused();
});

test("searching Help narrows it to the matching shortcuts", async ({ page }) => {
  await page.keyboard.press("F1");
  const search = help(page).getByRole("textbox", { name: "Search shortcuts" });
  await expect(search).toBeFocused();
  await search.fill("cash drop");
  await expect(help(page).getByRole("region")).toHaveCount(1);
  await expect(help(page)).toContainText("Alt");
  await search.fill("nothing like this");
  await expect(help(page).getByText("No shortcut matches")).toBeVisible();
});

test("the user menu opens Help too", async ({ page }) => {
  await page
    .getByRole("navigation", { name: "Register" })
    .getByRole("button", { name: /Ama Mensah/ })
    .click();
  await page.getByRole("menuitem", { name: "Keyboard shortcuts" }).click();
  await expect(help(page)).toBeVisible();
});
