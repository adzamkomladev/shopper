import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";
import {
  emptyReport,
  expectFits,
  mockRegister,
  openShell,
  report,
  shoot,
  sizes,
  today,
} from "./api";

const panel = (page: import("@playwright/test").Page) =>
  page.locator('[data-slot="register-dashboard"]');
const expectTile = async (
  tiles: import("@playwright/test").Locator,
  name: string,
  value: string,
  caption: string,
) => {
  const tile = tiles.locator('[data-slot="card"]').filter({
    has: tiles.page().getByRole("heading", { name, exact: true }),
  });
  await expect(tile).toContainText(value);
  await expect(tile).toContainText(caption);
};
const current = (page: import("@playwright/test").Page) =>
  page.getByRole("tablist", { name: "Register sections" }).locator('[aria-selected="true"]');

for (const size of sizes) {
  test(`at ${size.name}: the tiles, range, Download and quick actions fit`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockRegister(page);
    await openShell(page, "Dashboard");
    const tiles = panel(page);
    await expect(tiles.getByRole("heading", { name: "Total sales" })).toBeVisible();
    await expect(tiles.getByText("GH₵ 124.50", { exact: true })).toBeVisible();
    await expect(tiles.getByText("7 transactions")).toBeVisible();
    await expect(tiles.getByRole("heading", { name: "Total returns" })).toBeVisible();
    await expect(tiles.getByText("0 returns")).toBeVisible();
    await expect(tiles.getByRole("heading", { name: "Products" })).toBeVisible();
    await expect(tiles.getByText("128", { exact: true })).toBeVisible();
    await expect(tiles.getByRole("heading", { name: "Discounted sales" })).toBeVisible();
    await expect(tiles.getByText("GH₵ 2.00 off")).toBeVisible();
    await expectTile(tiles, "Customers", "5", "bought in this range");
    await expectTile(tiles, "Returning customers", "3", "bought here before");
    await expect(tiles.getByLabel("From")).toHaveValue(today);
    await expect(tiles.getByLabel("To")).toHaveValue(today);
    await expect(tiles.getByRole("button", { name: "Download" })).toBeVisible();
    await expect(tiles.getByRole("heading", { name: "Quick Actions" })).toBeVisible();
    await expectFits(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `dashboard-${size.name}`);
  });
}

test("changing the range asks the host for it and updates the tiles", async ({ page }) => {
  const register = await mockRegister(page);
  await openShell(page, "Dashboard");
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
  register.report = { ...report, totals: { ...report.totals, sales: 2_000_000, transactions: 12 } };
  await panel(page).getByLabel("From").fill("2026-10-01");
  await expect(panel(page).getByText("GH₵ 200.00", { exact: true })).toBeVisible();
  await expect(panel(page).getByText("12 transactions")).toBeVisible();
  expect(register.requests).toContain(`/register/report?from=2026-10-01&to=${today}`);
});

test("an end day before the start day is explained, disables Download and asks nothing", async ({
  page,
}) => {
  const register = await mockRegister(page);
  await openShell(page, "Dashboard");
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
  const before = register.requests.filter((r) => r.startsWith("/register/report")).length;
  await panel(page).getByLabel("To").fill("2020-01-01");
  await expect(panel(page).getByRole("alert")).toHaveText("The end day is before the start day");
  await expect(panel(page).getByLabel("To")).toHaveAttribute("aria-invalid", "true");
  await expect(panel(page).getByRole("button", { name: "Download" })).toBeDisabled();
  expect(register.requests.filter((r) => r.startsWith("/register/report")).length).toBe(before);
  await expectNoSeriousAxe(page);
  await shoot(page, "dashboard-range-error");
});

test("Download saves the range as a CSV file", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Dashboard");
  await panel(page).getByLabel("From").fill("2026-10-01");
  const download = page.waitForEvent("download");
  await panel(page).getByRole("button", { name: "Download" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`register-2026-10-01-${today}.csv`);
  expect(await readFile((await file.path())!, "utf8")).toContain("Total sales,124.50");
});

test("a failed download says so and the button comes back", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Dashboard");
  await page.route(
    (url) => url.pathname === "/api/register/report.csv",
    (route) => route.fulfill({ status: 500, body: "boom" }),
  );
  await panel(page).getByRole("button", { name: "Download" }).click();
  await expect(page.getByText("The report couldn't be built. Try again.")).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Download" })).toBeEnabled();
});

test("each quick action opens its tab", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Dashboard");
  await panel(page)
    .getByRole("button", { name: /Inventory Management/ })
    .click();
  await expect(current(page)).toHaveText(/Inventory/);
  await expect(page.locator('[data-slot="register-inventory"]')).toBeVisible();
  await page.getByRole("tab", { name: /^Dashboard/ }).click();
  await panel(page)
    .getByRole("button", { name: /Sales Reports/ })
    .click();
  await expect(current(page)).toHaveText(/Sales Reports/);
  await page.getByRole("tab", { name: /^Dashboard/ }).click();
  await panel(page)
    .getByRole("button", { name: /Barcode Scanner/ })
    .click();
  await expect(current(page)).toHaveText(/Checkout/);
  await expect(page.getByRole("combobox")).toBeFocused();
});

test("quick actions leave out tabs this user cannot open", async ({ page }) => {
  await mockRegister(page, { permissions: ["report.read"] });
  await openShell(page, "Dashboard", "&permissions=report.read");
  await expect(panel(page).getByRole("button", { name: /Sales Reports/ })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: /Inventory Management/ })).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: /Barcode Scanner/ })).toHaveCount(0);
});

test("keyboard only: Tab reaches Download and each quick action; Enter opens one", async ({
  page,
}) => {
  await mockRegister(page);
  await openShell(page, "Dashboard");
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
  await panel(page).getByLabel("From").focus();
  // A date field has one stop per day, month and year part.
  const download = panel(page).getByRole("button", { name: "Download" });
  for (
    let stops = 0;
    stops < 8 && !(await download.evaluate((e) => e === document.activeElement));
    stops++
  )
    await page.keyboard.press("Tab");
  await expect(download).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(panel(page).getByRole("button", { name: /Barcode Scanner/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(panel(page).getByRole("button", { name: /Inventory Management/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(current(page)).toHaveText(/Inventory/);
});

test("loading shows a skeleton shaped like the dashboard, then the tiles", async ({ page }) => {
  await mockRegister(page, { reportDelayMs: 1500 });
  await openShell(page, "Dashboard");
  await expect(panel(page).getByRole("status", { name: "Loading totals" })).toBeVisible();
  await expectFits(page);
  await shoot(page, "dashboard-loading");
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
});

test("a day with no sales says so and still shows zero tiles", async ({ page }) => {
  await mockRegister(page, { report: emptyReport });
  await openShell(page, "Dashboard");
  await expect(panel(page).getByText(/No sales on these days yet/)).toBeVisible();
  await expect(panel(page).getByText("GH₵ 0.00", { exact: true }).first()).toBeVisible();
  await expectTile(panel(page), "Customers", "0", "bought in this range");
  await expectTile(panel(page), "Returning customers", "0", "bought here before");
  await expectNoSeriousAxe(page);
  await shoot(page, "dashboard-empty");
});

test("an error says what happened and Try again recovers", async ({ page }) => {
  const register = await mockRegister(page, { reportStatus: 500 });
  await openShell(page, "Dashboard");
  await expect(
    panel(page).getByRole("alert").filter({ hasText: "Couldn't load the dashboard" }),
  ).toBeVisible();
  await expect(panel(page).getByText("The register could not build the report")).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Quick Actions" })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, "dashboard-error");
  register.reportStatus = 200;
  await panel(page).getByRole("button", { name: "Try again" }).click();
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
});

test("offline says the figures are this register's own", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Dashboard", "&offline");
  await expect(panel(page).getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, "dashboard-offline");
});

test("without report.read the host's answer is explained, not shown as an empty page", async ({
  page,
}) => {
  const register = await mockRegister(page, { permissions: ["stock.read"] });
  await openShell(page, "Dashboard");
  await expect(
    panel(page).getByText("You don't have permission to view the dashboard"),
  ).toBeVisible();
  expect(register.requests.some((r) => r.startsWith("/register/report"))).toBe(false);
  await expectNoSeriousAxe(page);
  await shoot(page, "dashboard-nopermission");
});
