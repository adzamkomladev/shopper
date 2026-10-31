import { expect, test, type Page } from "@playwright/test";

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const themeColor = (page: Page) => page.locator('meta[name="theme-color"]').getAttribute("content");

async function pickTheme(page: Page, theme: "Light" | "Dark" | "System") {
  await page
    .getByRole("navigation", { name: "Register" })
    .getByRole("button", { name: /Ama Mensah/ })
    .click();
  await page.getByRole("menuitem", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: theme }).click();
  await page.keyboard.press("Escape");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/harness/index.html?scenario=lines");
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
});

test("Dark repaints the till and its title bar colour, and survives a reload", async ({ page }) => {
  const light = await background(page);
  await pickTheme(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).not.toBe(light);
  // Electron reads this to set nativeTheme, so the window frame follows the till.
  await expect.poll(() => themeColor(page)).toBe("#0b1220");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await pickTheme(page, "Light");
  await expect.poll(() => themeColor(page)).toBe("#ffffff");
  expect(await background(page)).toBe(light);
});

test("the saved theme is set by the page's head before the app loads", async ({ page }) => {
  await pickTheme(page, "Dark");
  await page.route("**/*.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("System follows the operating system", async ({ page }) => {
  await pickTheme(page, "System");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  const light = await background(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page)).not.toBe(light);
});
