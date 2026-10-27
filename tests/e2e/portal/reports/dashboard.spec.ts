import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createStaff, signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/customers/shots";
import { busyDashboard } from "../../../support/reports/busy";

// The reports dashboard on the saved owner session. A quiet day is the real API's answer; a busy day is a
// recorded answer replayed, so the tiles, best sellers, tender mix and hour bars are all drawn.
const SIZES = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
] as const;
test.describe.configure({ timeout: 180_000 });

const replay = (page: Page, path: string, json: unknown) =>
  page.route(
    (url) => url.pathname.endsWith(`/api/reports/${path}`),
    (route) => route.fulfill({ json }),
  );
const tile = (page: Page, label: string) =>
  page.getByRole("term").filter({ hasText: label }).locator("..");

test("a busy day: six figures against yesterday, best sellers, tender mix and sales by hour", async ({
  page,
}, info) => {
  await replay(page, "dashboard", busyDashboard);
  await page.goto("/reports?day=2026-10-15");
  await expect(page.getByRole("heading", { name: "Reports", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Dashboard" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(tile(page, "Net sales")).toContainText("GH₵ 4,825.00");
  await expect(tile(page, "Net sales")).toContainText("+15.16% vs yesterday");
  await expect(tile(page, "Items per basket")).toContainText("-5.56%");
  await expect(tile(page, "Refunds")).toContainText("Nothing to compare");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Royal Aroma Jasmine Rice" }),
  ).toContainText("GH₵ 980.00");
  await expect(page.getByRole("listitem").filter({ hasText: "MoMo" })).toContainText("37.9%");
  await expect(page.getByRole("list", { name: "Sales by hour" }).getByRole("listitem")).toHaveCount(
    14,
  );
  await shoot(page, info, "reports-dashboard-busy", { sizes: SIZES });
});

test("the keyboard alone: [ and ] step the day, 1–6 switch reports", async ({ page }) => {
  await page.goto("/reports?day=2026-10-15");
  await expect(page.getByLabel("Day", { exact: true })).toHaveValue("2026-10-15", {
    timeout: 20_000,
  });
  await page.keyboard.press("]");
  await expect(page).toHaveURL(/day=2026-10-16/);
  await page.keyboard.press("[");
  await page.keyboard.press("[");
  await expect(page.getByLabel("Day", { exact: true })).toHaveValue("2026-10-14");
  await page.keyboard.press("2");
  await expect(page.getByRole("tab", { name: "Sales" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("6");
  await expect(page.getByRole("tab", { name: "Journal" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("1");
  await expect(page.getByRole("tab", { name: "Dashboard" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("E opens the export menu, and C then Enter downloads the day as CSV", async ({ page }) => {
  await page.goto("/reports?day=2026-10-14");
  await expect(page.getByLabel("Day", { exact: true })).toHaveValue("2026-10-14", {
    timeout: 20_000,
  });
  await page.keyboard.press("e");
  await expect(page.getByRole("menuitem", { name: "CSV" })).toBeVisible();
  await page.keyboard.press("c");
  await expect(page.getByRole("menuitem", { name: "CSV" })).toBeFocused();
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const file = await download;
  expect(file.suggestedFilename()).toBe("dashboard-2026-10-14.csv");
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv.trimEnd().split("\n")).toHaveLength(7);
  // Focus is back on Export, so the report's keys still work after a download.
  await expect(page.getByRole("menu")).toBeHidden();
  await page.keyboard.press("2");
  await expect(page.getByRole("tab", { name: "Sales" })).toHaveAttribute("aria-selected", "true");
});

test("a day without sales reads as zeros with nothing to list", async ({ page }, info) => {
  await page.goto("/reports?day=2020-01-01");
  await expect(tile(page, "Net sales")).toContainText("GH₵ 0.00");
  await expect(page.getByText("Nothing sold yet.")).toBeVisible();
  await expect(page.getByText("No payments yet.")).toBeVisible();
  await expect(page.getByText("No sales on either day.")).toBeVisible();
  await shoot(page, info, "reports-dashboard-quiet", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});

test("offline, the figures stay and Export waits for a connection", async ({ page, context }) => {
  await page.goto("/reports?day=2020-01-01");
  await expect(tile(page, "Net sales")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText("You're seeing figures loaded earlier.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export/ })).toBeDisabled();
  await context.setOffline(false);
});

test("with the server unreachable the page says so and Try again recovers", async ({ page }) => {
  let failures = 1;
  await page.route(
    (url) => url.pathname.endsWith("/api/reports/dashboard"),
    (route) => (failures-- > 0 ? route.abort("failed") : route.fallback()),
  );
  await page.goto("/reports?day=2020-01-01");
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(tile(page, "Net sales")).toBeVisible();
});

test("a cashier is told reports need permission, and the nav has no Reports link", async ({
  page,
  request,
}) => {
  const cashier = await createStaff(request, "cashier", "ReportsDenied");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/reports");
  await expect(page.getByText("You don't have permission to view reports")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export/ })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Reports" }),
  ).toHaveCount(0);
});
