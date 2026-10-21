import { expect, test } from "@playwright/test";
import {
  addEntryProduct,
  entrySearch,
  heading,
  ownProducts,
  seedStock,
} from "../../../../support/admin/stock";

test.describe("as the owner of E2E Mart", () => {
  test("removing a line moves focus to the next line's quantity, then to the search", async ({
    page,
  }) => {
    const { products } = await ownProducts(["Okra", "Pepper", "Garden eggs"]);
    const { branch } = await seedStock();
    await page.goto(`/stock/adjust?branch=${branch.id}`);
    await expect(heading(page, "Adjust stock")).toBeFocused();
    for (const product of products) await addEntryProduct(page, product.name);
    const quantity = (index: number) =>
      page
        .getByRole("row")
        .filter({ hasText: products[index]!.name })
        .getByLabel(/^Quantity/);
    // The first line goes: focus lands on the second line's quantity.
    await page.getByRole("button", { name: `Remove ${products[0]!.name}` }).click();
    await expect(quantity(1)).toBeFocused();
    // The last line goes: focus lands on the one before it, which is now last, then on the search.
    await page.getByRole("button", { name: `Remove ${products[2]!.name}` }).click();
    await expect(entrySearch(page)).toBeFocused();
    await page.getByRole("button", { name: `Remove ${products[1]!.name}` }).click();
    await expect(entrySearch(page)).toBeFocused();
    await expect(page.getByText("No products yet")).toBeVisible();
  });
});
