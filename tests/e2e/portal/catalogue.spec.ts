import { expect, test } from "@playwright/test";
import { ANNEX, expectNoSeriousAxe, signInWithKeyboard } from "../../support/e2e";
import { barcodeOf, fillSheet, openSheet, seed, sheet, tagOf } from "../../support/catalogue";

// Runs on the saved owner session. Earlier runs may have left products behind on a reused server,
// so every test names its products with a tag that is new each time (see support/catalogue.ts).
test.describe("as the owner of E2E Mart", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
  });

  test("log in, create a product and see it in the list", async ({ page }) => {
    const tag = tagOf();
    const draft = { name: `Gari ${tag}`, sku: `GARI-${tag}`, barcode: barcodeOf() };
    await page.keyboard.press("n");
    await expect(sheet(page)).toBeVisible();
    await fillSheet(page, draft);
    await page.getByRole("button", { name: "Save product" }).click();
    await expect(page.getByText(/\bproduct (added|created)\b/i)).toBeVisible();
    await expect(sheet(page)).toBeHidden();
    // Newest first: the header is row 0, so the new product is the first data row.
    const first = page.getByRole("row").nth(1);
    await expect(first).toContainText(draft.name);
    await expect(first).toContainText(draft.sku);
  });

  test("search by name, SKU or barcode filters the list; no match offers to clear the search", async ({
    page,
    request,
  }) => {
    const tag = tagOf();
    const drafts = [
      { name: `Plantain ${tag}`, sku: `PLA-${tag}`, barcode: barcodeOf() },
      { name: `Yam ${tag}`, sku: `YAM-${tag}`, barcode: String(Number(barcodeOf()) + 1) },
      { name: `Rice ${tag}`, sku: `RIC-${tag}`, barcode: String(Number(barcodeOf()) + 2) },
    ];
    for (const draft of drafts) await seed(request, draft);
    await page.reload();
    const search = page.getByRole("textbox", { name: "Search products" });
    const rows = (text: string) => page.getByRole("row").filter({ hasText: text });

    await search.fill(tag);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${tag}`));
    await expect(rows(tag)).toHaveCount(3);
    // The toolbar stays mounted while results change, so typing is never interrupted.
    await expect(search).toBeFocused();

    await search.fill(drafts[1].sku);
    await expect(page).toHaveURL(new RegExp(`[?&]q=${drafts[1].sku}`));
    await expect(rows(tag)).toHaveCount(1);
    await expect(rows(drafts[1].name)).toBeVisible();

    await search.fill(drafts[2].barcode);
    await expect(rows(tag)).toHaveCount(1);
    await expect(rows(drafts[2].name)).toBeVisible();

    await search.fill(`zzz-${tag}`);
    await expect(page.getByText("No products match")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search).toHaveValue("");
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expect(page.getByText("No products match")).toBeHidden();
  });

  test("Mod+K finds a product and opens it", async ({ page, request }) => {
    const tag = tagOf();
    const draft = { name: `Kenkey ${tag}`, sku: `KEN-${tag}` };
    const { id } = await seed(request, draft);
    await page.reload();
    // Keys pressed before the app has rendered go nowhere.
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+K");
    await expect(sheet(page)).toBeVisible();
    await page.keyboard.type(draft.name);
    await expect(page.getByRole("option", { name: new RegExp(draft.name) })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/products/${id}$`));
    await expect(page.getByRole("heading", { name: draft.name })).toBeVisible();
  });

  test("Mod+K finds a product by its barcode", async ({ page, request }) => {
    const tag = tagOf();
    const draft = { name: `Millet ${tag}`, sku: `MIL-${tag}`, barcode: barcodeOf() };
    const { id } = await seed(request, draft);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+K");
    await page.keyboard.type(draft.barcode);
    await expect(page.getByRole("option", { name: new RegExp(draft.name) })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/products/${id}$`));
  });

  test("N opens the new product sheet and Escape closes it", async ({ page }) => {
    await page.keyboard.press("n");
    await expect(sheet(page)).toBeVisible();
    await expect(sheet(page).getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sheet(page)).toBeHidden();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("button", { name: "Add product" })).toBeFocused();
  });

  test("Mod+Enter saves the new product from the sheet", async ({ page }) => {
    await page.keyboard.press("n");
    await fillSheet(page, { name: `Millet ${tagOf()}`, sku: `MIL-${tagOf()}` });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText(/\bproduct (added|created)\b/i)).toBeVisible();
    await expect(sheet(page)).toBeHidden();
  });

  test("a duplicate SKU shows its error on the SKU field", async ({ page, request }) => {
    const tag = tagOf();
    const taken = { name: `Maize ${tag}`, sku: `MAI-${tag}` };
    await seed(request, taken);
    await openSheet(page);
    await fillSheet(page, { name: `Maize again ${tag}`, sku: taken.sku });
    await page.getByRole("button", { name: "Save product" }).click();
    const field = sheet(page).getByLabel("SKU", { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(/\S/);
    await expect(sheet(page)).toBeVisible();
  });

  test("Save stays disabled while the product is being saved, even if you keep typing", async ({
    page,
  }) => {
    // Slow only the save, so it is still in flight; the request itself is untouched.
    await page.route("**/api/products", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return route.continue();
    });
    const tag = tagOf();
    await openSheet(page);
    await fillSheet(page, { name: `Slow ${tag}`, sku: `SLO-${tag}` });
    const save = page.getByRole("button", { name: /^Sav/ });
    await save.click();
    await expect(save).toBeDisabled();
    await sheet(page).getByLabel("Name", { exact: true }).press("x");
    await expect(save).toBeDisabled();
    await expect(sheet(page)).toBeHidden();
  });

  test("offline shows a banner and disables Save with the reason", async ({ page, context }) => {
    await openSheet(page);
    await fillSheet(page, { name: "Offline item", sku: `OFF-${tagOf()}` });
    const save = page.getByRole("button", { name: "Save product" });
    await expect(save).toBeEnabled();
    await context.setOffline(true);
    await expect(page.getByText(/offline/i).first()).toBeVisible();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAccessibleDescription(/offline/i);
    await context.setOffline(false);
    await expect(save).toBeEnabled();
  });

  test("the list skeleton shows while products load", async ({ page, context }) => {
    test.setTimeout(90_000);
    // Warm the dev server first, then slow every request so the skeleton lasts long enough to see.
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 800,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await page.goto("/products", { waitUntil: "commit" });
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("row").nth(1)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  });

  test("the list has no serious axe violations and renders at three sizes", async ({
    page,
    request,
  }, info) => {
    const tag = tagOf();
    await seed(request, { name: `Shea butter ${tag}`, sku: `SHE-${tag}` });
    await page.reload();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expectNoSeriousAxe(page);
    for (const [width, height] of [
      [1366, 768],
      [1440, 900],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
      const path = info.outputPath(`products-${width}x${height}.png`);
      await page.screenshot({ path, fullPage: true });
      await info.attach(`products-${width}x${height}`, { path, contentType: "image/png" });
    }
  });
});

test.describe("a shop with no products", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("an empty catalogue offers Add product and Import spreadsheet", async ({ page }) => {
    await signInWithKeyboard(page, ANNEX);
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    for (const name of ["Add product", "Import spreadsheet"]) {
      const action = page
        .getByRole("button", { name })
        .or(page.getByRole("link", { name }))
        .first();
      await expect(action).toBeVisible();
    }
    await expect(page.getByRole("row").filter({ has: page.getByRole("cell") })).toHaveCount(0);
  });
});
