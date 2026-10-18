import { expect, test, type Page } from "@playwright/test";
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

const panel = (page: Page) => page.locator('[data-slot="register-reports"]');

for (const size of sizes) {
  test(`at ${size.name}: totals, payment methods, hours and top products fit`, async ({ page }) => {
    await page.setViewportSize(size);
    await mockRegister(page);
    await openShell(page, "Sales Reports");
    const sales = panel(page);
    await expect(sales.getByRole("heading", { name: "Total sales" })).toBeVisible();
    await expect(sales.getByText("GH₵ 124.50", { exact: true })).toBeVisible();
    await expect(sales.getByRole("heading", { name: "Net sales" })).toBeVisible();
    await expect(sales.getByText("GH₵ 109.50", { exact: true })).toBeVisible();
    const tenders = sales.getByRole("region", { name: "By payment method" });
    await expect(tenders.getByRole("row", { name: /Cash\s+GH₵ 74.50/ })).toBeVisible();
    await expect(tenders.getByRole("row", { name: /Mobile money\s+GH₵ 50.00/ })).toBeVisible();
    const hours = sales.getByRole("region", { name: "Sales by hour" });
    await expect(hours.getByText("09:00")).toBeVisible();
    await expect(hours.getByText("14:00")).toBeVisible();
    await expect(hours.getByText("03:00")).toHaveCount(0);
    const products = sales.getByRole("region", { name: "Top products" });
    await expect(
      products.getByRole("row", { name: /Milo 400g tin\s+3\s+GH₵ 54.00/ }),
    ).toBeVisible();
    await expect(
      products.getByRole("row", { name: /Loose rice \(kg\)\s+4.5\s+GH₵ 33.00/ }),
    ).toBeVisible();
    await expectFits(page);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `reports-${size.name}`);
  });
}

test("the date range reloads the report and Download keeps the range", async ({ page }) => {
  const register = await mockRegister(page);
  await openShell(page, "Sales Reports");
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
  register.report = { ...report, totals: { ...report.totals, sales: 3_000_000 } };
  await panel(page).getByLabel("From").fill("2026-09-01");
  await expect(panel(page).getByText("GH₵ 300.00", { exact: true })).toBeVisible();
  expect(register.requests).toContain(`/register/report?from=2026-09-01&to=${today}`);
  const download = page.waitForEvent("download");
  await panel(page).getByRole("button", { name: "Download" }).click();
  expect((await download).suggestedFilename()).toBe(`register-2026-09-01-${today}.csv`);
});

test("a day with no sales says so in each section", async ({ page }) => {
  await mockRegister(page, { report: emptyReport });
  await openShell(page, "Sales Reports");
  await expect(panel(page).getByText("No payments on these days.")).toBeVisible();
  await expect(panel(page).getByText("No sales on these days yet.")).toBeVisible();
  await expect(panel(page).getByText("No products sold on these days.")).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, "reports-empty");
});

test("loading shows a skeleton, then the report", async ({ page }) => {
  await mockRegister(page, { reportDelayMs: 1500 });
  await openShell(page, "Sales Reports");
  await expect(panel(page).getByRole("status", { name: "Loading the report" })).toBeVisible();
  await shoot(page, "reports-loading");
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
});

test("an error explains itself and Try again recovers", async ({ page }) => {
  const register = await mockRegister(page, { reportStatus: 500 });
  await openShell(page, "Sales Reports");
  await expect(panel(page).getByText("Couldn't load the report")).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, "reports-error");
  register.reportStatus = 200;
  await panel(page).getByRole("button", { name: "Try again" }).click();
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
});

test("offline says these are this register's own sales", async ({ page }) => {
  await mockRegister(page);
  await openShell(page, "Sales Reports", "&offline");
  await expect(panel(page).getByRole("status").filter({ hasText: "Offline" })).toBeVisible();
  await expect(panel(page).getByText("GH₵ 124.50", { exact: true })).toBeVisible();
  await shoot(page, "reports-offline");
});

test("a 403 from the host is the no-permission state", async ({ page }) => {
  await mockRegister(page, { reportStatus: 403 });
  await openShell(page, "Sales Reports");
  await expect(panel(page).getByText("You don't have permission to view the report")).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("without report.read nothing is requested and the user is told why", async ({ page }) => {
  const register = await mockRegister(page, { permissions: ["stock.read"] });
  await openShell(page, "Sales Reports");
  await expect(
    panel(page).getByText("You don't have permission to view sales reports"),
  ).toBeVisible();
  expect(register.requests.some((r) => r.startsWith("/register/report"))).toBe(false);
  await shoot(page, "reports-nopermission");
});
