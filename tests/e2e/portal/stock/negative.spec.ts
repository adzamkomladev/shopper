import { expect, test, type Page } from "@playwright/test";
import { v7 } from "uuid";
import { captureSizes, post } from "../../../support/admin";
import {
  asOwner,
  heading,
  lowToggle,
  openStock,
  ownProducts,
  rowOf,
  search,
} from "../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../support/e2e";

const negativeToggle = (page: Page) => page.getByRole("button", { name: /Negative/ });

// Two registers that sold the last bag offline leave on hand under zero: 10 kg received, 12 kg wasted.
test.describe("as the owner of E2E Mart", () => {
  test("stock under zero is marked Negative, and Z filters to it", async ({ page }, info) => {
    const { products, tag } = await ownProducts(["Sugar", "Flour"]);
    const { branch } = await openStock(page);
    await asOwner((request) =>
      post(request, "/stock/adjustments", {
        id: v7(),
        branchId: branch.id,
        cause: "damaged",
        lines: [{ productId: products[0]!.id, quantityThousandths: 12_000 }],
      }),
    );
    await page.reload();
    await search(page).fill(tag);
    await expect(rowOf(page, `Sugar ${tag}`)).toContainText("−2 kg");
    await expect(rowOf(page, `Sugar ${tag}`)).toContainText("Negative");
    await expect(rowOf(page, `Flour ${tag}`)).not.toContainText("Negative");

    // Plain keys are ignored while typing: leave the field, as a click on the page would.
    await heading(page, "Inventory").click();
    await page.keyboard.press("z");
    await expect(page).toHaveURL(/negative=true/);
    await expect(negativeToggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(rowOf(page, `Sugar ${tag}`)).toBeVisible();
    await expect(rowOf(page, `Flour ${tag}`)).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stock-negative", async () => {
      await expect(rowOf(page, `Sugar ${tag}`)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    // One filter at a time: L swaps to low stock.
    await page.keyboard.press("l");
    await expect(lowToggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(negativeToggle(page)).toHaveAttribute("aria-pressed", "false");
  });

  test("the negative filter says so when nothing is under zero", async ({ page }, info) => {
    const { tag } = await openStock(page, "&negative=true");
    await search(page).fill(`Rice ${tag}`);
    await expect(heading(page, "No negative stock", 2)).toBeVisible();
    await captureSizes(page, info, "stock-negative-empty", async () => {
      await expect(heading(page, "No negative stock", 2)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(rowOf(page, `Rice ${tag}`)).toBeVisible();
    await expect(negativeToggle(page)).toHaveAttribute("aria-pressed", "false");
  });
});
