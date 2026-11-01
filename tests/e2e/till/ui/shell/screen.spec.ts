import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls } from "../sale/harness";
import { expectTouchTargets } from "../targets";

// Set SHOPPER_SCREENSHOTS_DIR to keep the screenshots (docs/plans/day28/screenshots), in
// SHOPPER_SCREENSHOTS_SCHEME (light or dark).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const scheme = process.env.SHOPPER_SCREENSHOTS_SCHEME === "dark" ? "dark" : "light";
test.use({ colorScheme: scheme });
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1024", width: 1024, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Register" });
const item = (page: Page, name: string) => sidebar(page).getByRole("button", { name, exact: true });
const toggle = (page: Page) =>
  page.getByRole("button", { name: /^(Toggle sidebar|Open navigation)$/ });
const open = (page: Page, query = "") => page.goto(`/harness/index.html?scenario=lines${query}`);
const slot = (page: Page, name: string) => page.locator(`[data-slot="register-${name}"]`);
const current = (page: Page) => sidebar(page).locator('[aria-current="page"]');

async function expectFits(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/till-shell-${name}-${scheme}.png` });
}

for (const size of sizes) {
  test(`at ${size.name}: header, sidebar and Checkout fit, and the sidebar opens`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page);
    await expect(page.getByText("Shopper App", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("banner").getByText("Connected")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
    await expectFits(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `checkout-${size.name}`);

    await toggle(page).click();
    await expect(item(page, "Previous purchases")).toBeVisible();
    await expectFits(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `sidebar-${size.name}`);
  });
}

test("the till starts as a rail, so the sale keeps the width, and Ctrl+M opens it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  // A touch rail: wide enough for 44px buttons, far narrower than the open sidebar.
  await expect.poll(async () => (await sidebar(page).boundingBox())!.width).toBeLessThanOrEqual(64);
  await expect(current(page)).toHaveAccessibleName("Checkout");
  await page.getByRole("heading", { name: "Checkout", exact: true }).click();
  await page.keyboard.press("Control+M");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Ama Mensah · Till 1")).toBeVisible();
  await page.keyboard.press("Control+M");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
});

test("a cashier sees Checkout only and lands on it", async ({ page }) => {
  await open(page, "&permissions=sale.create");
  await expect(item(page, "Checkout")).toBeAttached();
  for (const name of ["Dashboard", "Inventory", "Sales reports"])
    await expect(item(page, name)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
});

test("without sale.create the user lands on Dashboard and sees no Checkout", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "&permissions=report.read,stock.read");
  for (const name of ["Dashboard", "Inventory", "Sales reports"])
    await expect(item(page, name)).toBeAttached();
  await expect(item(page, "Checkout")).toHaveCount(0);
  await expect(current(page)).toHaveAccessibleName("Dashboard");
  await expect(slot(page, "dashboard").getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.keyboard.press("Alt+S");
  await expect(current(page)).toHaveAccessibleName("Dashboard");
  await expectNoSeriousAxe(page);
  await shoot(page, "dashboard-1366");
});

test("a user with no register permission is told so, not shown an empty sidebar", async ({
  page,
}) => {
  await open(page, "&permissions=payment.momo");
  await expect(page.getByText("This account has no register sections")).toBeVisible();
  await expect(item(page, "Checkout")).toHaveCount(0);
  await expectNoSeriousAxe(page);
});

test("Ctrl+1 to Ctrl+4 pick the sections, and Alt+S, Alt+P, Alt+T keep working", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.getByRole("heading", { name: "Checkout", exact: true }).click();
  for (const [key, name, region] of [
    ["Control+1", "Dashboard", "dashboard"],
    ["Control+3", "Inventory", "inventory"],
    ["Control+4", "Sales reports", "reports"],
  ] as const) {
    await page.keyboard.press(key);
    await expect(current(page)).toHaveAccessibleName(name);
    await expect(slot(page, region)).toBeVisible();
  }
  await page.keyboard.press("Control+2");
  await expect(current(page)).toHaveAccessibleName("Checkout");
  await expect(page.getByRole("combobox")).toBeFocused();
  await page.keyboard.press("Alt+T");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(current(page)).toHaveAccessibleName("Register settings");
  await page.keyboard.press("Alt+P");
  await expect(page.getByRole("main", { name: "Purchases" })).toBeVisible();
  await page.keyboard.press("Alt+S");
  await expect(current(page)).toHaveAccessibleName("Checkout");
});

test("the sidebar opens Previous purchases and Settings in the main area", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await expect(sidebar(page).getByRole("link", { name: "Back office" })).toHaveAttribute(
    "href",
    "/backoffice/",
  );
  await item(page, "Previous purchases").click();
  await expect(page.getByRole("main", { name: "Purchases" })).toBeVisible();
  await expect(current(page)).toHaveAccessibleName("Previous purchases");
  await shoot(page, "purchases-1366");
  await item(page, "Register settings").click();
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("offline: the header says Offline and Back office is disabled with the reason", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, "&offline");
  await expect(page.getByRole("banner").getByText("Offline")).toBeVisible();
  await expect(item(page, "Back office (needs connection)")).toBeDisabled();
  await expect(sidebar(page).getByRole("link", { name: "Back office" })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, "sidebar-offline-1366");
});

test("Sign out is one keystroke or two clicks away", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  await page.getByRole("heading", { name: "Checkout", exact: true }).click();
  await page.keyboard.press("Control+Shift+L");
  expect(await calls(page, "signOut")).toHaveLength(1);
  await sidebar(page)
    .getByRole("button", { name: /Ama Mensah/ })
    .click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  expect(await calls(page, "signOut")).toHaveLength(2);
});
