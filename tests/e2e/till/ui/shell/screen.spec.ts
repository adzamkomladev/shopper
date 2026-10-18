import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls } from "../sale/harness";
import { expectTouchTargets } from "../targets";

// Set SHOPPER_SCREENSHOTS_DIR to keep the screenshots (docs/plans/day13/screenshots).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

const tabs = (page: Page) => page.getByRole("tablist", { name: "Register sections" });
const menu = (page: Page) => page.getByRole("dialog", { name: "Menu" });
const open = (page: Page, query = "") => page.goto(`/harness/index.html?scenario=lines${query}`);
const slot = (page: Page, name: string) => page.locator(`[data-slot="register-${name}"]`);
const current = (page: Page) => tabs(page).locator('[aria-selected="true"]');

async function expectFits(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/shell-${name}.png` });
}

for (const size of sizes) {
  test(`at ${size.name}: status bar, tabs and Checkout fit, and the Menu opens`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page);
    await expect(page.getByText("Shopper App", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Ama Mensah · Till 1")).toBeVisible();
    await expect(page.getByRole("banner").getByText("Connected")).toBeVisible();
    await expect(current(page)).toHaveText(/Checkout/);
    await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
    await expectFits(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `checkout-${size.name}`);

    await page.getByRole("button", { name: /^Menu/ }).click();
    await expect(menu(page)).toBeVisible();
    await expectFits(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `menu-${size.name}`);
  });
}

test("a cashier sees Checkout only and lands on it", async ({ page }) => {
  await open(page, "&permissions=sale.create");
  await expect(tabs(page).getByRole("tab")).toHaveText([/Checkout/]);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
});

test("without sale.create the user lands on Dashboard and sees no Checkout", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "&permissions=report.read,stock.read");
  await expect(tabs(page).getByRole("tab")).toHaveText([/Dashboard/, /Inventory/, /Sales Reports/]);
  await expect(current(page)).toHaveText(/Dashboard/);
  await expect(slot(page, "dashboard")).toBeVisible();
  await expect(slot(page, "dashboard").getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Checkout" })).toHaveCount(0);
  await page.keyboard.press("Alt+S");
  await expect(current(page)).toHaveText(/Dashboard/);
  await expectNoSeriousAxe(page);
  await shoot(page, "dashboard-1366");
});

test("stock.read alone shows Inventory, and report.read alone shows both report tabs", async ({
  page,
}) => {
  await open(page, "&permissions=stock.read");
  await expect(tabs(page).getByRole("tab")).toHaveText([/Inventory/]);
  await open(page, "&permissions=report.read");
  await expect(tabs(page).getByRole("tab")).toHaveText([/Dashboard/, /Sales Reports/]);
});

test("a user with no register permission is told so, not shown an empty strip", async ({
  page,
}) => {
  await open(page, "&permissions=payment.momo");
  await expect(page.getByText("This account has no register sections")).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);
  await expectNoSeriousAxe(page);
});

test("Ctrl+1 to Ctrl+4 pick the tabs, and Alt+S, Alt+P, Alt+T keep working", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.getByRole("heading", { name: "Checkout", exact: true }).click();
  for (const [key, name, region] of [
    ["Control+1", /Dashboard/, "dashboard"],
    ["Control+3", /Inventory/, "inventory"],
    ["Control+4", /Sales Reports/, "reports"],
  ] as const) {
    await page.keyboard.press(key);
    await expect(current(page)).toHaveText(name);
    await expect(slot(page, region)).toBeVisible();
  }
  await page.keyboard.press("Control+2");
  await expect(current(page)).toHaveText(/Checkout/);
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Alt+T");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(current(page)).toHaveCount(0);
  await page.keyboard.press("Alt+P");
  await expect(page.getByRole("main", { name: "Purchases" })).toBeVisible();
  await page.keyboard.press("Alt+S");
  await expect(current(page)).toHaveText(/Checkout/);
});

test("Ctrl+M opens the Menu drawer and Escape closes it, back to the Menu button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.getByRole("heading", { name: "Checkout", exact: true }).click();
  await page.keyboard.press("Control+M");
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("link", { name: "Back office" })).toHaveAttribute(
    "href",
    "/backoffice/",
  );
  for (const name of ["Previous purchases", "Settings", "Sign out"])
    await expect(menu(page).getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
  await expect(page.getByRole("button", { name: /^Menu/ })).toBeFocused();
});

test("the Menu opens Previous purchases and Settings in the main area", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.getByRole("button", { name: /^Menu/ }).click();
  await menu(page)
    .getByRole("button", { name: /^Previous purchases/ })
    .click();
  await expect(menu(page)).toBeHidden();
  await expect(page.getByRole("main", { name: "Purchases" })).toBeVisible();
  await expect(current(page)).toHaveCount(0);
  await shoot(page, "purchases-1366");
  await page.keyboard.press("Control+M");
  await menu(page)
    .getByRole("button", { name: /^Settings/ })
    .click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("offline: the status bar says Offline and Back office is disabled with the reason", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "&offline");
  await expect(page.getByRole("banner").getByText("Offline")).toBeVisible();
  await page.keyboard.press("Control+M");
  const backOffice = menu(page).getByRole("button", { name: "Back office" });
  await expect(backOffice).toBeDisabled();
  await expect(backOffice).toHaveAccessibleDescription("Needs connection");
  await expect(menu(page).getByRole("link", { name: "Back office" })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, "menu-offline-1366");
});

test("Sign out is one keystroke or one click away", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.getByRole("heading", { name: "Checkout", exact: true }).click();
  await page.keyboard.press("Control+Shift+L");
  expect(await calls(page, "signOut")).toHaveLength(1);
  await page.keyboard.press("Control+M");
  await menu(page)
    .getByRole("button", { name: /^Sign out/ })
    .click();
  expect(await calls(page, "signOut")).toHaveLength(2);
});
