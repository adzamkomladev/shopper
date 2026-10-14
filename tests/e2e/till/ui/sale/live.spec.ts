// The sale screen against a real register host and till SQLite: scans, search, edits and a reopened basket.
import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { formatGHS, money } from "@shopper/money";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { startSaleScenario } from "../../../../support/till/sale/scenario";

// Set SHOPPER_SCREENSHOTS_DIR to keep the 1366x768 shots (docs/plans/day10/screenshots/till).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
let scenario: Awaited<ReturnType<typeof startSaleScenario>> | undefined;

test.beforeEach(async ({ page }, testInfo) => {
  scenario = await startSaleScenario(appOrigin(testInfo));
  await page.setViewportSize({ width: 1366, height: 768 });
});
test.afterEach(async () => scenario?.stop());

const field = (page: Page) => page.getByRole("combobox");
const lines = (page: Page) =>
  page.getByRole("list", { name: "Basket lines" }).getByRole("listitem");

async function openSale(page: Page) {
  await page.goto(scenario!.url);
  await expect(page.getByRole("region", { name: "Host connection" })).toContainText("Connected");
  await page.keyboard.press("S");
  await expect(page.getByRole("heading", { name: "Sale", exact: true })).toBeVisible();
  await expect(field(page)).toBeFocused();
}

test("thirty keyboard scans land in under a minute and the basket outlives the page", async ({
  page,
}, testInfo) => {
  await openSale(page);
  await expect(page.getByText("Basket is empty")).toBeVisible();
  const products = scenario!.products;
  const started = Date.now();
  for (let scan = 0; scan < 30; scan += 1) {
    await page.keyboard.type(products[scan % products.length]!.barcode, { delay: 5 });
    await page.keyboard.press("Enter");
  }
  await expect(lines(page)).toHaveCount(10);
  for (const product of products)
    await expect(lines(page).filter({ hasText: product.name })).toContainText(
      `3${formatGHS(money(product.amount))}${formatGHS(money(product.amount * 3))}`,
    );
  const total = formatGHS(money(products.reduce((sum, product) => sum + product.amount * 3, 0)));
  await expect(page.getByRole("region", { name: "Basket" })).toContainText(total);
  expect(Date.now() - started).toBeLessThan(60_000);
  await expect(page.getByText("Saved on this register", { exact: true })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "live");

  // The capability stays valid for this host run; reopening the register shows the same basket.
  await page.goto("about:blank");
  await openSale(page);
  await expect(lines(page)).toHaveCount(10);
  await expect(page.getByRole("region", { name: "Basket" })).toContainText(total);
});

test("search adds by name, F4 sets a quantity, Delete removes and an unknown scan explains", async ({
  page,
}) => {
  await openSale(page);
  await field(page).pressSequentially("sardines", { delay: 90 });
  await expect(page.getByRole("option", { name: /Titus sardines 125g/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(lines(page)).toHaveCount(1);
  await expect(field(page)).toHaveValue("");

  await page.keyboard.press("F3");
  await page.keyboard.press("F4");
  const quantity = page.getByRole("textbox", { name: "Quantity of Titus sardines 125g" });
  await expect(quantity).toBeFocused();
  await quantity.fill("4");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Basket" })).toContainText(
    formatGHS(money(180_000 * 4)),
  );

  await page.keyboard.press("F3");
  await page.keyboard.press("Delete");
  await expect(page.getByText("Basket is empty")).toBeVisible();

  await page.keyboard.press("F2");
  await page.keyboard.type("4000000000006", { delay: 5 });
  await page.keyboard.press("Enter");
  await expect(page.getByText("Barcode 4000000000006 was not found")).toBeVisible();
  await page.keyboard.press("F10");
  await expect(page.getByRole("heading", { name: "Register connection" })).toBeVisible();
});

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const path = shots ? `${shots}/${name}.png` : testInfo.outputPath(`${name}.png`);
  if (shots) mkdirSync(shots, { recursive: true });
  await page.screenshot({ path });
}

function appOrigin(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") throw new Error("Playwright baseURL is required");
  return new URL(baseURL).origin;
}
