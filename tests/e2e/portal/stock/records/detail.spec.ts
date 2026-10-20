import { expect, test } from "@playwright/test";
import { captureSizes } from "../../../../support/admin";
import { activeTab, heading, openRecords, rowOf, seedStock } from "../../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../../support/e2e";

// See list.spec.ts for what seedStock() records at Accra Central.

test.describe("as the owner of E2E Mart", () => {
  test("a row opens the record: items with their cost and the summary cards", async ({
    page,
  }, info) => {
    const { supplier, tag, receiptId, rice, tomatoes } = await openRecords(page);
    await rowOf(page, supplier.name).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`/stock/records/${receiptId}`));
    await expect(heading(page, "Goods received")).toBeFocused();
    const main = page.getByRole("main");
    for (const text of [supplier.name, `DN-${tag}`, "E2E Owner", "Accra Central", "GH₵ 522.00"])
      await expect(main).toContainText(text);
    const items = page.getByRole("region", { name: "Items received" });
    const riceRow = items.getByRole("row").filter({ hasText: rice.name });
    await expect(items.getByRole("row")).toHaveCount(3);
    await expect(riceRow).toContainText("24 kg");
    await expect(riceRow).toContainText("GH₵ 9.50");
    await expect(riceRow).toContainText("GH₵ 228.00");
    await expect(items.getByRole("row").filter({ hasText: tomatoes.name })).toContainText(
      "GH₵ 294.00",
    );
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "records-detail", async () => {
      await expect(items).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("link", { name: "Back to records" }).click();
    await expect(activeTab(page, "Records")).toBeVisible();
  });

  test("an adjustment's record shows its cause and the signed change", async ({ page }, info) => {
    const { adjustmentId, branch, rice } = await seedStock();
    await page.goto(`/stock/records/${adjustmentId}?branch=${branch.id}`);
    await expect(heading(page, "Stock adjustment")).toBeFocused();
    await expect(page.getByRole("main")).toContainText("Damaged");
    await expect(page.getByRole("main")).toContainText("Removes stock");
    const line = page.getByRole("region", { name: "Items adjusted" }).getByRole("row").nth(1);
    await expect(line).toContainText(rice.name);
    await expect(line).toContainText("−2.5 kg");
    await captureSizes(page, info, "records-detail-adjusted", async () => {
      await expect(line).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("on a phone the items table fits, with every line total in view", async ({ page }) => {
    const { receiptId, rice } = await seedStock();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/stock/records/${receiptId}`);
    const items = page.getByRole("region", { name: "Items received" });
    const line = items.getByRole("row").filter({ hasText: rice.name });
    await expect(line).toContainText("GH₵ 228.00");
    // Nothing is scrolled out of sight: the table is no wider than its box, and the total is inside it.
    expect(await items.evaluate((box) => box.scrollWidth <= box.clientWidth)).toBe(true);
    const total = await line.getByText("GH₵ 228.00").last().boundingBox();
    expect(total!.x + total!.width).toBeLessThanOrEqual(390);
    // The summary cards sit two to a row.
    const cards = page.getByRole("main").locator("[data-slot=card]");
    const [first, second] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
    expect(second!.y).toBe(first!.y);
  });

  test("a record that does not exist is Not found", async ({ page }) => {
    await page.goto("/stock/records/0198a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b");
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await expectNoSeriousAxe(page);
  });
});
