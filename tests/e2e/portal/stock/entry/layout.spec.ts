import { expect, test } from "@playwright/test";
import {
  addEntryProduct,
  entrySearch,
  heading,
  ownProducts,
  seedStock,
} from "../../../../support/admin/stock";

async function openReceive(page: import("@playwright/test").Page) {
  const { branch } = await seedStock();
  await page.goto(`/stock/receive?branch=${branch.id}`);
  await expect(heading(page, "Receive goods")).toBeFocused();
}

const total = (page: import("@playwright/test").Page) =>
  page.getByRole("status").filter({ hasText: "Total" });

test.describe("as the owner of E2E Mart", () => {
  test("each line is rounded to the pesewa and the total adds the rounded lines", async ({
    page,
  }) => {
    const { products } = await ownProducts(["Cocoa", "Shea"]);
    await openReceive(page);
    await addEntryProduct(page, products[0]!.name);
    await page.keyboard.type("125.5");
    await page.keyboard.press("Tab");
    await page.keyboard.type("12.3456");
    await page.keyboard.press("Enter");
    await addEntryProduct(page, products[1]!.name);
    await page.keyboard.type("3.333");
    await page.keyboard.press("Tab");
    await page.keyboard.type("9.5");
    await expect(page.getByRole("row").filter({ hasText: products[0]!.name })).toContainText(
      "GH₵ 1,549.37",
    );
    await expect(page.getByRole("row").filter({ hasText: products[1]!.name })).toContainText(
      "GH₵ 31.66",
    );
    await expect(total(page)).toContainText("GH₵ 1,581.03");
  });

  test("lines with no valid cost are left out of the total, and the total says so", async ({
    page,
  }) => {
    const { products } = await ownProducts(["Kenkey", "Banku"]);
    await openReceive(page);
    await addEntryProduct(page, products[0]!.name);
    await page.keyboard.type("2");
    await page.keyboard.press("Tab");
    await page.keyboard.type("5");
    await page.keyboard.press("Enter");
    await expect(total(page)).not.toContainText("excludes");
    await addEntryProduct(page, products[1]!.name);
    await page.keyboard.type("4");
    await expect(total(page)).toContainText("GH₵ 10.00");
    await expect(total(page)).toContainText("excludes 1 line");
    await page.keyboard.press("Tab");
    await page.keyboard.type("abc");
    await expect(total(page)).toContainText("excludes 1 line");
    await page.keyboard.press("Control+a");
    await page.keyboard.type("1");
    await expect(total(page)).not.toContainText("excludes");
    await expect(total(page)).toContainText("GH₵ 14.00");
  });

  test("the product search shows its / key", async ({ page }) => {
    await openReceive(page);
    await expect(
      entrySearch(page).locator("xpath=..").getByText("/", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("/");
    await expect(entrySearch(page)).toBeFocused();
  });

  test("on a phone Add supplier sits under the supplier, and a long name wraps with its full text on hover", async ({
    page,
  }) => {
    const { products } = await ownProducts([
      "Extra long product name for the narrow screen of a phone",
    ]);
    await page.setViewportSize({ width: 390, height: 844 });
    await openReceive(page);
    const select = await page.getByRole("combobox", { name: "Supplier" }).boundingBox();
    const add = await page.getByRole("button", { name: "Add supplier" }).boundingBox();
    expect(add!.y).toBeGreaterThan(select!.y + select!.height - 1);
    expect(select!.width).toBeGreaterThan(250);
    await addEntryProduct(page, products[0]!.name);
    const name = page.getByTitle(products[0]!.name);
    await expect(name).toBeVisible();
    expect(await name.evaluate((node) => getComputedStyle(node).webkitLineClamp)).toBe("2");
  });
});
