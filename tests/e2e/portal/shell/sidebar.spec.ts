import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe, OWNER_NAME } from "../../../support/e2e";

// Runs on the saved owner session, so it signs nobody in. SHOPPER_SCREENSHOTS_DIR keeps the screenshots, in
// SHOPPER_SCREENSHOTS_SCHEME (light or dark).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const scheme = process.env.SHOPPER_SCREENSHOTS_SCHEME === "dark" ? "dark" : "light";
test.use({ colorScheme: scheme });
const sidebar = (page: Page) => page.getByRole("navigation", { name: "Main" });
const toggle = (page: Page) => page.getByRole("button", { name: "Toggle sidebar" });
const sizes = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

async function expectFits(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/stock");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("the section holding the page is open and its page is current", async ({ page }) => {
  const current = sidebar(page).getByRole("link", { name: "Stock" });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(sidebar(page).getByRole("link", { name: "Suppliers" })).toBeVisible();
  // Other sections stay closed until opened.
  await expect(sidebar(page).getByRole("link", { name: "Barcodes" })).toBeHidden();
  await sidebar(page).getByRole("button", { name: "Catalogue" }).click();
  await sidebar(page).getByRole("link", { name: "Barcodes" }).click();
  await expect(page).toHaveURL(/\/barcodes$/);
  await expect(page.getByRole("banner")).toContainText("Barcodes");
});

test("the toggle and Ctrl+B collapse it to a rail with tooltips, kept over a reload", async ({
  page,
}) => {
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect.poll(async () => (await sidebar(page).boundingBox())!.width).toBeLessThan(64);
  await sidebar(page).getByRole("link", { name: "Reports" }).hover();
  await expect(page.getByRole("tooltip", { name: "Reports" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await page.reload();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await page.locator("main").click();
  await page.keyboard.press("ControlOrMeta+B");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect.poll(async () => (await sidebar(page).boundingBox())!.width).toBeGreaterThan(200);
});

test("a section in the rail expands the sidebar and opens itself", async ({ page }) => {
  await toggle(page).click();
  await sidebar(page).getByRole("button", { name: "Organisation" }).click();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(sidebar(page).getByRole("link", { name: "Users" })).toBeVisible();
});

test("the keyboard reaches every page link and the user menu", async ({ page }) => {
  await sidebar(page).getByRole("combobox").focus();
  await page.keyboard.press("Tab");
  await expect(sidebar(page).getByRole("link", { name: "Reports" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sidebar(page).getByRole("button", { name: "Sales" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(sidebar(page).getByRole("link", { name: "Transactions" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(sidebar(page).getByRole("link", { name: "Transactions" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/transactions$/);
  await page.getByRole("button", { name: OWNER_NAME }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
});

test("on a phone it is a sheet that opens, holds focus and closes after a pick", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sidebar(page)).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  const sheet = page.getByRole("dialog", { name: "Main" });
  await expect(sheet).toBeVisible();
  for (let step = 0; step < 30; step++) await page.keyboard.press("Tab");
  expect(await sheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await expectNoSeriousAxe(page);
  await sheet.getByRole("link", { name: "Reports" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(sheet).toBeHidden();
});

for (const size of sizes) {
  test(`at ${size.width}x${size.height} nothing overflows, expanded or collapsed`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    await expectFits(page);
    await shoot(page, `products-${size.width}`);
    if (size.width < 768) return;
    await toggle(page).click();
    await expectFits(page);
    await shoot(page, `products-rail-${size.width}`);
  });
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/portal-${name}-${scheme}.png` });
}
