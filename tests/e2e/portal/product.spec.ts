import { expect, test } from "@playwright/test";
import { BRANCH_NAME, expectNoSeriousAxe } from "../../support/e2e";
import { card, localDateTime, openProduct, seedPrice, sheet, tagOf } from "../../support/catalogue";

// Runs on the saved owner session; every test seeds its own product through the API.
test.describe("the product page, as the owner of E2E Mart", () => {
  test("editing name and tax class persists after reload", async ({ page, request }) => {
    const product = await openProduct(page, request, "Flour");
    const renamed = `${product.name} renamed`;
    await card(page, "Details").getByLabel("Name", { exact: true }).fill(renamed);
    await card(page, "Details").getByRole("combobox", { name: "Tax class" }).click();
    await page.getByRole("option", { name: /zero.rated/i }).click();
    await page.keyboard.press("ControlOrMeta+S");
    await expect(page.getByText("Changes saved")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: renamed, level: 1 })).toBeVisible();
    await expect(card(page, "Details").getByLabel("Name", { exact: true })).toHaveValue(renamed);
    await expect(card(page, "Details").getByRole("combobox", { name: "Tax class" })).toHaveText(
      /zero.rated/i,
    );
  });

  test("Save changes works with the button too", async ({ page, request }) => {
    const product = await openProduct(page, request, "Oil");
    await card(page, "Details").getByLabel("Name", { exact: true }).fill(`${product.name} bottle`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Changes saved")).toBeVisible();
  });

  test("a pack barcode with quantity 24 is added and removed", async ({ page, request }) => {
    await openProduct(page, request, "Water");
    const code = String(Date.now()).padStart(13, "1");
    const barcodes = card(page, "Barcodes");
    await barcodes.getByLabel("Barcode", { exact: true }).fill(code);
    await barcodes.getByLabel("Pack quantity").fill("24");
    await barcodes.getByRole("button", { name: "Add barcode" }).click();
    const row = barcodes.getByRole("listitem").filter({ hasText: code });
    await expect(row).toContainText("Pack of 24");

    await barcodes.getByRole("button", { name: `Remove barcode ${code}` }).click();
    await expect(barcodes.getByText(code)).toBeHidden();
  });

  test("Undo on the removed-barcode toast puts the pack barcode back", async ({
    page,
    request,
  }) => {
    await openProduct(page, request, "Soap");
    const code = String(Date.now()).padStart(13, "2");
    const barcodes = card(page, "Barcodes");
    await barcodes.getByLabel("Barcode", { exact: true }).fill(code);
    await barcodes.getByLabel("Pack quantity").fill("6");
    await barcodes.getByRole("button", { name: "Add barcode" }).click();
    await barcodes.getByRole("button", { name: `Remove barcode ${code}` }).click();
    await expect(barcodes.getByText(code)).toBeHidden();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(barcodes.getByRole("listitem").filter({ hasText: code })).toContainText(
      "Pack of 6",
    );
  });

  test("setting a price with a reason shows GH₵ 12.50 in the price history", async ({
    page,
    request,
  }) => {
    await openProduct(page, request, "Sugar");
    const prices = card(page, "Prices");
    await expect(prices.getByText("No price yet")).toBeVisible();
    // P is the shortcut for the button; focus is on the page, not in a field.
    await page.keyboard.press("p");
    const dialog = sheet(page);
    await expect(dialog.getByRole("heading", { name: "Set price" })).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Branch" })).toHaveText(/All branches/);
    await dialog.getByLabel("Amount").fill("12.50");
    await dialog.getByLabel("Reason").fill("Supplier raised cost");
    await dialog.getByRole("button", { name: "Set price" }).click();
    await expect(dialog).toBeHidden();

    // 12.50 GHS is 125000 money units; formatGHS prints it as "GH₵ 12.50".
    await expect(prices.getByText("No price yet")).toBeHidden();
    await expect(prices).toContainText("GH₵ 12.50");
    await expect(prices.getByText("Supplier raised cost")).toBeVisible();
  });

  test("a branch override shows against Accra Central", async ({ page, request }) => {
    await openProduct(page, request, "Rice");
    await page.getByRole("button", { name: "Set price" }).click();
    const dialog = sheet(page);
    await dialog.getByRole("combobox", { name: "Branch" }).click();
    await page.getByRole("option", { name: BRANCH_NAME }).click();
    await dialog.getByLabel("Amount").fill("9.00");
    await dialog.getByLabel("Reason").fill("Branch promo");
    await dialog.getByRole("button", { name: "Set price" }).click();
    await expect(dialog).toBeHidden();

    const prices = card(page, "Prices");
    await expect(prices.getByText(BRANCH_NAME)).toBeVisible();
    await expect(prices).toContainText("GH₵ 9.00");
  });

  test("a scheduled price window shows as upcoming", async ({ page, request }) => {
    await openProduct(page, request, "Beans");
    await page.getByRole("button", { name: "Schedule price" }).click();
    const dialog = sheet(page);
    await dialog.getByLabel("Amount").fill("7.25");
    await dialog.getByLabel("Starts").fill(localDateTime(1));
    await dialog.getByLabel("Ends").fill(localDateTime(2));
    await dialog.getByLabel("Reason").fill("Weekend sale");
    await dialog.getByRole("button", { name: "Schedule price" }).click();
    await expect(dialog).toBeHidden();

    const prices = card(page, "Prices");
    await expect(prices.getByText("Upcoming")).toBeVisible();
    await expect(prices).toContainText("GH₵ 7.25");
  });

  test("an unknown product id shows Not found with a way back to products", async ({ page }) => {
    await page.goto("/products/01900000-0000-7000-8000-000000000000");
    await expect(page.getByText("Not found").first()).toBeVisible();
    await page.getByRole("link", { name: "Back to products" }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
  });

  test("the product page has no serious axe violations and renders at two sizes", async ({
    page,
    request,
  }, info) => {
    const product = await openProduct(page, request, `Shea ${tagOf()}`);
    await seedPrice(request, product.id, 125_000);
    await page.reload();
    await expect(card(page, "Prices")).toContainText("GH₵ 12.50");
    await expectNoSeriousAxe(page);
    for (const [width, height] of [
      [1366, 768],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole("heading", { name: product.name, level: 1 })).toBeVisible();
      const path = info.outputPath(`product-${width}x${height}.png`);
      await page.screenshot({ path, fullPage: true });
      await info.attach(`product-${width}x${height}`, { path, contentType: "image/png" });
    }
  });
});
