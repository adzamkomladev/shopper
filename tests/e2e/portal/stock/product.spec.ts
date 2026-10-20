import { expect, test } from "@playwright/test";
import { captureSizes } from "../../../support/admin";
import { dialog } from "../../../support/admin/people";
import { heading, seedStock } from "../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../support/e2e";

// Rice 21.5 kg (level 5): received 24 kg at GH₵ 9.50, then 2.5 kg damaged. Beans: nothing received, no level.

test.describe("as the owner of E2E Mart", () => {
  test("a product's page shows on hand, the level, the last cost and its movements newest first", async ({
    page,
  }, info) => {
    const { branch, rice, tag } = await seedStock();
    await page.goto(`/stock/products/${rice.id}?branch=${branch.id}`);
    await expect(heading(page, `Rice ${tag}`)).toBeFocused();
    const main = page.getByRole("main");
    await expect(main.getByText("On hand", { exact: true })).toBeVisible();
    await expect(main).toContainText("21.5 kg");
    await expect(main).toContainText("5 kg");
    await expect(main).toContainText("GH₵ 9.50");
    await expect(main).toContainText("Accra Central");
    const movements = page.getByRole("region", { name: "Stock movements" });
    const rows = movements.getByRole("row");
    await expect(rows).toHaveCount(3);
    // Newest first: the wastage, then the delivery it came out of. Each row carries its running balance.
    await expect(rows.nth(1)).toContainText("Adjustment");
    await expect(rows.nth(1)).toContainText("−2.5");
    await expect(rows.nth(1)).toContainText("21.5");
    await expect(rows.nth(2)).toContainText("Received");
    await expect(rows.nth(2)).toContainText("+24");
    await expect(rows.nth(2)).toContainText("GH₵ 9.50");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stock-product", async () => {
      await expect(movements).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("link", { name: "Back to stock" }).focus();
    await page.keyboard.press("Enter");
    await expect(heading(page, "Inventory")).toBeVisible();
  });

  test("E edits the reorder level, and saving it empty removes it", async ({ page }, info) => {
    const { branch, beans, tag } = await seedStock();
    await page.goto(`/stock/products/${beans.id}?branch=${branch.id}`);
    await expect(heading(page, `Beans ${tag}`)).toBeFocused();
    await expect(page.getByRole("main")).toContainText("Not set");
    await page.keyboard.press("e");
    await expect(dialog(page)).toBeVisible();
    const level = dialog(page).getByLabel("Reorder level");
    await expect(level).toBeFocused();
    await page.keyboard.type("3.5");
    await captureSizes(page, info, "stock-reorder-dialog", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Reorder level saved")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(page.getByRole("main")).toContainText("3.5 each");
    // Nothing on hand is under any level, so a new level raises Low at once.
    await expect(page.getByRole("main").getByText("Low", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit reorder level/ })).toBeFocused();

    await page.keyboard.press("e");
    await expect(dialog(page).getByLabel("Reorder level")).toHaveValue("3.5");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Reorder level removed")).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Not set");
  });

  test("a level that is not a quantity is refused on the field", async ({ page }) => {
    const { branch, beans } = await seedStock();
    await page.goto(`/stock/products/${beans.id}?branch=${branch.id}`);
    await page.getByRole("button", { name: /Edit reorder level/ }).click();
    const level = dialog(page).getByLabel("Reorder level");
    await level.fill("lots");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(level).toHaveAttribute("aria-invalid", "true");
    await expect(level).toHaveAccessibleDescription(/quantity/i);
    await expect(level).toBeFocused();
  });

  test("a product that does not exist says so", async ({ page }) => {
    const { branch } = await seedStock();
    await page.goto(`/stock/products/019a0000-0000-7000-8000-0000000000aa?branch=${branch.id}`);
    await expect(heading(page, "Not found")).toBeVisible();
  });

  test("at phone width the movements table fits, with the time on one line and the reason under it", async ({
    page,
  }) => {
    const { branch, rice } = await seedStock();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/stock/products/${rice.id}?branch=${branch.id}`);
    const region = page.getByRole("region", { name: "Stock movements" });
    await expect(region).toBeVisible();
    await expect(region.getByRole("columnheader", { name: "Balance" })).toBeInViewport({
      ratio: 1,
    });
    expect(await region.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(false);
    await expect(region.getByRole("columnheader", { name: "Reason" })).toBeHidden();
    await expect(region.getByRole("columnheader", { name: "Unit cost" })).toBeHidden();
    const time = region.getByRole("row").nth(1).locator("span.md\\:hidden").first();
    await expect(time).toContainText(/^\d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/);
    expect((await time.boundingBox())!.height).toBeLessThan(24);
    await expect(region.getByRole("row").nth(1)).toContainText("Adjustment");
  });
});
