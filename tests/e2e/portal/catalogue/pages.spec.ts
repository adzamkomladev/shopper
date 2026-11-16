import { expect, test } from "@playwright/test";
import { seed, tagOf } from "../../../support/catalogue";

// Runs on the saved owner session; the tag keeps this run's products apart from earlier ones.
test.describe("as the owner of E2E Mart", () => {
  test("the list shows 20 products a page, with Next and Previous; a new search starts at page 1", async ({
    page,
    request,
  }) => {
    const tag = tagOf();
    for (let n = 1; n <= 21; n++)
      await seed(request, { name: `Paged ${n} ${tag}`, sku: `PG${n}-${tag}` });
    await page.goto(`/products?q=${tag}`);
    const rows = page.getByRole("row").filter({ hasText: tag });
    await expect(rows).toHaveCount(20);
    await expect(page.getByText("1–20 of 21")).toBeVisible();
    await expect(page.getByRole("link", { name: "Previous page" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await page.getByRole("link", { name: "Next page" }).click();
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(`Paged 1 ${tag}`);
    await expect(page.getByText("21–21 of 21")).toBeVisible();
    await expect(page.getByRole("link", { name: "Next page" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    await page.getByRole("link", { name: "Previous page" }).click();
    await expect(rows).toHaveCount(20);
    await page.getByRole("link", { name: "Next page" }).click();
    await page.getByRole("textbox", { name: "Search products" }).fill(`Paged 2 ${tag}`);
    await expect(page).not.toHaveURL(/[?&]page=/);
    await expect(rows).toHaveCount(1);
    // The table is part of the page: no scroll box of its own.
    const table = page.getByRole("region", { name: "Products" });
    expect(await table.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
  });
});
