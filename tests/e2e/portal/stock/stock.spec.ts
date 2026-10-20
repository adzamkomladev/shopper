import { expect, test } from "@playwright/test";
import { captureSizes } from "../../../support/admin";
import { heading, lowToggle, openStock, rowOf, search } from "../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../support/e2e";

// The owner of E2E Mart is signed in. seedStock() gives Accra Central:
//   Rice 21.5 kg (level 5, not low), Tomatoes 10.5 kg (level 12, low), Beans 0 each (no level).

test.describe("as the owner of E2E Mart", () => {
  test("lists on hand with the unit and marks products at their reorder level as Low", async ({
    page,
  }, info) => {
    const { tag } = await openStock(page);
    await search(page).fill(tag);
    await expect(rowOf(page, `Rice ${tag}`)).toContainText("21.5 kg");
    await expect(rowOf(page, `Rice ${tag}`)).not.toContainText("Low");
    await expect(rowOf(page, `Tomatoes ${tag}`)).toContainText("10.5 kg");
    await expect(rowOf(page, `Tomatoes ${tag}`)).toContainText("12 kg");
    await expect(rowOf(page, `Tomatoes ${tag}`)).toContainText("Low");
    await expect(rowOf(page, `Beans ${tag}`)).toContainText("0 each");
    await expect(page.getByRole("combobox", { name: "Branch" })).toContainText("Accra Central");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stock-list", async () => {
      await expect(heading(page, "Stock")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("search narrows the list, and a search with no match offers Clear search", async ({
    page,
  }) => {
    const { tag } = await openStock(page);
    await search(page).fill(`Tomatoes ${tag}`);
    await expect(page).toHaveURL(/q=Tomatoes/);
    await expect(rowOf(page, `Tomatoes ${tag}`)).toBeVisible();
    await expect(rowOf(page, `Rice ${tag}`)).toHaveCount(0);
    await search(page).fill("zzz-nothing-like-this");
    await expect(heading(page, "No stock matches", 2)).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(heading(page, "No stock matches", 2)).toHaveCount(0);
    await expect(search(page)).toHaveValue("");
  });

  test("the keyboard path: / searches, L filters low stock, Enter opens the product", async ({
    page,
  }, info) => {
    const { tag } = await openStock(page);
    await page.keyboard.press("/");
    await expect(search(page)).toBeFocused();
    await page.keyboard.type(tag);
    await expect(rowOf(page, `Rice ${tag}`)).toBeVisible();
    // Plain keys are ignored while typing: leave the field, as a click on the page would.
    await heading(page, "Stock").click();

    await expect(lowToggle(page)).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("l");
    await expect(lowToggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(page).toHaveURL(/low=true/);
    await expect(rowOf(page, `Tomatoes ${tag}`)).toBeVisible();
    await expect(rowOf(page, `Rice ${tag}`)).toHaveCount(0);
    await expect(heading(page, "No low stock", 2)).toHaveCount(0);
    await captureSizes(page, info, "stock-low", async () => {
      await expect(lowToggle(page)).toHaveAttribute("aria-pressed", "true");
      await expectNoSeriousAxe(page);
    });

    await page.keyboard.press("b");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("combobox", { name: "Branch" })).toBeFocused();

    await rowOf(page, `Tomatoes ${tag}`).getByRole("link").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/stock\/products\/[0-9a-f-]{36}/);
    await expect(heading(page, `Tomatoes ${tag}`)).toBeFocused();
    await page.goBack();
    await expect(lowToggle(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("the low filter says so when nothing is low", async ({ page }) => {
    const { tag } = await openStock(page, "&low=true");
    await search(page).fill(`Rice ${tag}`);
    await expect(heading(page, "No low stock", 2)).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(rowOf(page, `Rice ${tag}`)).toBeVisible();
    await expect(lowToggle(page)).toHaveAttribute("aria-pressed", "false");
  });
});
