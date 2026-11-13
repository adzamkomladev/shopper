import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { verifyArchive } from "@shopper/export/verify";
import { createStaff, signInAs } from "../../../support/admin/people";
import { openProduct } from "../../../support/catalogue";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// The Data export screen as E2E Mart's owner: a real archive made, downloaded and verified with the real verifier,
// a real CSV, the keyboard path, and every state (the failed, empty and refused ones are replayed).
test.describe.configure({ timeout: 180_000 });

const archive = {
  id: "0197a000-0000-7000-8000-000000000001",
  status: "ready",
  requestedBy: "E2E Owner",
  createdAt: "2026-11-13T09:30:00.000Z",
  completedAt: "2026-11-13T09:30:20.000Z",
  files: 14,
  rows: 1_204,
  bytes: 4_600_000,
  missingBlobs: 0,
  error: null,
};
const entities = [
  "products",
  "prices",
  "customers",
  "sales",
  "lines",
  "tenders",
  "stock",
  "tax",
  "audit",
].map((name) => ({ name, ranged: ["sales", "lines", "tenders", "audit"].includes(name) }));

async function open(
  page: Page,
  archives: unknown[],
  fingerprint: string | null = "1A2B-3C4D-5E6F-7A8B",
) {
  await replay(page, "/export/entities", entities);
  await replay(page, "/export/archives", { archives, fingerprint });
  await page.goto("/export");
  await expect(heading(page, "Data export")).toBeVisible();
}

test("an owner creates a full archive with the keyboard, downloads it, and it verifies", async ({
  page,
}, info) => {
  await page.goto("/export");
  await expect(heading(page, "Data export")).toBeVisible();
  // A is the page's shortcut for Create archive; the button is there once the permission check has answered.
  await expect(page.getByRole("button", { name: "Create archive" })).toBeVisible();
  await page.keyboard.press("a");
  const first = page.getByRole("list", { name: "Archives" }).getByRole("listitem").first();
  await expect(first.getByText("Ready")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/Signed with key [0-9A-F]{4}(-[0-9A-F]{4}){3}/)).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    first.getByRole("button", { name: "Download" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^shopper-archive-\d{4}-\d{2}-\d{2}\.shopper$/);
  const result = await verifyArchive(new Uint8Array(readFileSync((await download.path())!)));
  if (!result.ok) throw new Error(result.message);
  expect(result.manifest.org.slug).toBe("e2e-mart");
  expect(result.manifest.tables.branch!.rows).toBeGreaterThan(0);
  await shoot(page, info, "export-ready");
  // Deleting it takes it off the list.
  await first.getByRole("button", { name: /Delete the archive/ }).click();
  await expect(page.getByText("Archive deleted.")).toBeVisible();
});

test("a spreadsheet downloads as CSV with the shop's products, and sales ask for dates", async ({
  page,
  request,
}, info) => {
  const product = await openProduct(page, request, "Sugar");
  await page.goto("/export");
  await expect(page.getByLabel("What to export")).toBeVisible();
  await expect(page.locator("#export-from")).toHaveCount(0);
  const [csv] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("c")]);
  expect(csv.suggestedFilename()).toBe("products.csv");
  const lines = readFileSync((await csv.path())!, "utf8")
    .trim()
    .split("\n");
  expect(lines[0]).toBe("SKU,Name,Category,Supplier,Tax class,Unit,Sold online,Archived");
  expect(lines.some((line) => line.startsWith(`${product.sku},Sugar`))).toBe(true);
  await page.keyboard.press("e");
  await page.getByLabel("What to export").click();
  await page.getByRole("option", { name: "Sales" }).click();
  await expect(page.locator("#export-from")).toBeVisible();
  await expect(page.locator("#export-to")).toBeVisible();
  await shoot(page, info, "export-ranged");
  const [excel] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Excel" }).click(),
  ]);
  expect(excel.suggestedFilename()).toMatch(/^sales-\d{4}-\d{2}-01-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test("every state: none yet, preparing, ready, failed, the list unreachable, Excel too long", async ({
  page,
}, info) => {
  await open(page, [], null);
  await expect(page.getByText("No archives yet")).toBeVisible();
  await expect(page.getByText(/Signed with key/)).toHaveCount(0);
  await shoot(page, info, "export-empty", { sizes: SIZES });

  await page.unrouteAll();
  await open(page, [{ ...archive, id: "r", status: "running", bytes: 0, rows: 0 }]);
  await expect(page.getByText("Preparing", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Preparing…" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Delete the archive/ })).toHaveCount(0);
  await shoot(page, info, "export-running", { sizes: SIZES });

  await page.unrouteAll();
  await open(page, [
    archive,
    {
      ...archive,
      id: "f",
      status: "failed",
      error: "R2 is unavailable",
      bytes: 0,
      rows: 0,
      createdAt: "2026-11-12T09:30:00.000Z",
    },
    { ...archive, id: "m", missingBlobs: 2, createdAt: "2026-11-11T09:30:00.000Z" },
  ]);
  await expect(page.getByText("4.6 MB · 1,204 rows")).toHaveCount(2);
  await expect(page.getByText("R2 is unavailable")).toBeVisible();
  await expect(page.getByText("2 uploaded files no longer in storage, left out.")).toBeVisible();
  await shoot(page, info, "export-list", { sizes: SIZES });

  await page.unrouteAll();
  await replay(page, "/export/entities", entities);
  await page.route(
    (url) => url.pathname === "/api/export/archives",
    (route) => route.fulfill({ status: 500, json: { error: "boom" } }),
  );
  await page.goto("/export");
  // The query retries a failing read a few times before it gives up.
  await expect(page.getByText("Your archives could not be loaded")).toBeVisible({
    timeout: 20_000,
  });

  await page.unrouteAll();
  await open(page, []);
  await page.route(
    (url) => url.pathname.startsWith("/api/export/entities/"),
    (route) =>
      route.fulfill({
        status: 413,
        json: { error: "Too many rows for Excel. Use CSV, or the full archive." },
      }),
  );
  await page.getByRole("button", { name: "Excel" }).click();
  await expect(
    page.getByText("Too many rows for Excel. Use CSV, or the full archive."),
  ).toBeVisible();
});

test("a second archive while one is preparing says so, in words", async ({ page }) => {
  await open(page, []);
  await page.route(
    (url) => url.pathname === "/api/export/archives" && url.search === "",
    (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 409,
            json: { error: "An archive is already being prepared.", code: "busy" },
          })
        : route.fulfill({ json: { archives: [], fingerprint: null } }),
  );
  await page.getByRole("button", { name: "Create archive" }).click();
  await expect(page.getByText("An archive is already being prepared.")).toBeVisible();
});

test("a cashier has no Data export in the sidebar and is told why by the page", async ({
  page,
  request,
}) => {
  const cashier = await createStaff(request, "cashier", "Efua");
  await signInAs(page, cashier);
  await expect(page.getByRole("link", { name: "Data export" })).toHaveCount(0);
  await page.goto("/export");
  await expect(heading(page, "Data export")).toBeVisible();
  await expect(
    page.getByText(/don.t have permission|can.t view|not allowed/i).first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Create archive" })).toHaveCount(0);
});
