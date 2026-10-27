import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { shoot } from "../../../support/customers/shots";
import {
  busyBranches,
  busyDeadStock,
  busyJournal,
  busyProducts,
  busySales,
} from "../../../support/reports/busy";

// The table reports on the saved owner session: busy answers replayed to draw them full, the real API for the
// quiet states and the exports, whose files hold the report's rows and then its total.
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
const range = "from=2026-10-01&to=2026-10-15";

test("sales by day, a row per day and the total last; ] steps to the next fifteen days", async ({
  page,
}, info) => {
  await replay(page, "sales", busySales);
  await page.goto(`/reports/sales?${range}`);
  const table = page.getByRole("region", { name: "Sales by day" });
  await expect(table.getByRole("row")).toHaveCount(1 + 15 + 1);
  await expect(table.getByRole("row").last()).toContainText("Total");
  await shoot(page, info, "reports-sales-busy", { sizes: SIZES });
  await page.getByRole("heading", { name: "Reports", level: 1 }).click();
  await page.keyboard.press("]");
  await expect(page).toHaveURL(/from=2026-10-16&to=2026-10-30/);
});

test("a quiet range says so, and its CSV still holds every day and the total", async ({ page }) => {
  await page.goto("/reports/sales?from=2020-01-01&to=2020-01-07");
  // The first report the dev server builds can take several seconds.
  await expect(page.getByText("No sales from 2020-01-01 to 2020-01-07")).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("Group by").click();
  await page.getByRole("option", { name: "Tender" }).click();
  await expect(page).toHaveURL(/by=tender/);
  await page.getByLabel("Group by").click();
  await page.getByRole("option", { name: "Day" }).click();
  await page.getByRole("button", { name: /Export/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "CSV" }).click();
  const csv = await readFile((await (await download).path())!, "utf8");
  const lines = csv.trimEnd().split("\n");
  expect(lines).toHaveLength(1 + 7 + 1);
  expect(lines.at(-1)).toMatch(/^Total,0,/);
});

test("products: margin per product, missing costs flagged, / filters by name or SKU", async ({
  page,
}, info) => {
  await replay(page, "products", busyProducts);
  await page.goto(`/reports/products?${range}`);
  await expect(page.getByText("2 products were sold without a receipt cost")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Voltic" })).toContainText("No cost");
  await expect(page.getByRole("row").filter({ hasText: "Milo" })).toContainText("Part costed");
  await shoot(page, info, "reports-products-busy", { sizes: SIZES });
  await page.getByRole("heading", { name: "Reports", level: 1 }).click();
  await page.keyboard.press("/");
  await expect(page.getByLabel("Filter products")).toBeFocused();
  await page.keyboard.type("SKU-1001");
  await expect(page.getByRole("region", { name: "Products" }).getByRole("row")).toHaveCount(2);
  await page.keyboard.type("zzz");
  await expect(page.getByText("No product matches “SKU-1001zzz”.")).toBeVisible();
});

test("dead stock: what sits unsold and its value, in a 30, 60 or 90 day window", async ({
  page,
}, info) => {
  await replay(page, "stock/dead", busyDeadStock);
  await page.goto("/reports/stock/dead?day=2026-10-15");
  await expect(page.getByRole("tab", { name: "Dead stock" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("row").filter({ hasText: "Peak Milk" })).toContainText("Never");
  await expect(page.getByRole("row").filter({ hasText: "Lipton" })).toContainText("No cost");
  await shoot(page, info, "reports-dead-stock-busy", { sizes: SIZES });
  await page.getByLabel("60 days").check();
  await expect(page).toHaveURL(/days=60/);
});

test("branches side by side with their share, and the journal balanced", async ({ page }, info) => {
  await replay(page, "branches", busyBranches);
  await replay(page, "journal", busyJournal);
  await page.goto(`/reports/branches?${range}`);
  const branches = page.getByRole("region", { name: "Branch comparison" });
  await expect(branches.getByRole("row").filter({ hasText: "Accra Central" })).toContainText(
    "62.00%",
  );
  await expect(branches.getByRole("row").last()).toContainText("100.00%");
  await expect(page.getByLabel("Branch", { exact: true })).toHaveCount(0);
  await shoot(page, info, "reports-branches-busy", { sizes: SIZES });

  await page.getByRole("heading", { name: "Reports", level: 1 }).click();
  await page.keyboard.press("6");
  await expect(page.getByText("Balanced")).toBeVisible();
  const journal = page.getByRole("region", { name: "Journal" });
  await expect(journal.getByRole("row")).toHaveCount(1 + 14 + 1);
  await expect(journal.getByRole("row").last()).toContainText("GH₵ 8,630.00");
  await shoot(page, info, "reports-journal-busy", { sizes: SIZES });
});

test("a quiet range on every table report shows its empty state", async ({ page }) => {
  const quiet = "from=2020-01-01&to=2020-01-07";
  for (const [path, text] of [
    ["products", "No products sold from 2020-01-01"],
    ["branches", "No branch sold anything from 2020-01-01"],
    ["journal", "Nothing to post from 2020-01-01"],
  ] as const) {
    await page.goto(`/reports/${path}?${quiet}`);
    await expect(page.getByText(text)).toBeVisible({ timeout: 20_000 });
  }
});

test("a range longer than a year is pulled in to the year the reports answer", async ({ page }) => {
  const answered = page.waitForResponse((response) =>
    response.url().includes("/api/reports/sales?"),
  );
  await page.goto("/reports/sales?from=2024-01-01&to=2026-10-15");
  expect((await answered).status()).toBe(200);
  await expect(page.getByLabel("From")).toHaveValue("2025-10-15");
  await page.getByLabel("From").fill("2023-06-01");
  await expect(page.getByLabel("To")).toHaveValue("2024-05-31");
});
