import { expect, test, type Page } from "@playwright/test";
import { OWNER_NAME } from "../../support/e2e";

// Runs on the saved owner session, so it signs nobody in.
const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function pickTheme(page: Page, theme: "Light" | "Dark" | "System") {
  await page.getByRole("button", { name: OWNER_NAME }).click();
  await page.getByRole("menuitem", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: theme }).click();
  await page.keyboard.press("Escape");
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
});

test("Dark switches the tokens and survives a reload", async ({ page }) => {
  const light = await background(page);
  await pickTheme(page, "Dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).not.toBe(light);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).not.toBe(light);
  await pickTheme(page, "Light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe(light);
});

test("the saved theme is on the page before any app script runs, so it never flashes", async ({
  page,
}) => {
  await pickTheme(page, "Dark");
  // With every script file blocked, only the inline head script can set the attribute.
  await page.route("**/*.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const html = await (await page.request.get("/products")).text();
  expect(html.indexOf("shopper.theme")).toBeGreaterThan(-1);
  expect(html.indexOf("shopper.theme")).toBeLessThan(html.indexOf("</head>"));
});

test("System follows the operating system", async ({ page }) => {
  await pickTheme(page, "System");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  const light = await background(page);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect.poll(() => background(page)).not.toBe(light);
  await page.emulateMedia({ colorScheme: "light" });
  await expect.poll(() => background(page)).toBe(light);
});
