import { expect, test } from "@playwright/test";
import { createBranch, createStore, unique } from "../../../../support/admin";
import { heading, openRecords, recordsSegment } from "../../../../support/admin/stock";

test.describe("as the owner of E2E Mart", () => {
  test("switching the kind with the keyboard keeps focus on the segment", async ({ page }) => {
    await openRecords(page);
    const received = recordsSegment(page, /^Received \d+$/);
    await received.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/kind=received/);
    await expect(received).toBeFocused();
    const adjusted = recordsSegment(page, /^Adjusted \d+$/);
    await adjusted.focus();
    await page.keyboard.press("Enter");
    await expect(adjusted).toBeFocused();
    await expect(heading(page, "Inventory")).toBeVisible();
  });

  test("Show all records leaves focus on the All segment", async ({ page, request }) => {
    const store = await createStore(request, `Quiet store ${unique()}`);
    const branch = await createBranch(request, `Quiet ${unique()}`, store.id);
    await page.goto(`/stock/records?branch=${branch.id}&kind=counted`);
    await expect(heading(page, "No counted records", 2)).toBeVisible();
    await page.getByRole("link", { name: "Show all records" }).click();
    await expect(heading(page, "No stock records yet", 2)).toBeVisible();
    await expect(recordsSegment(page, /^All 0$/)).toBeFocused();
  });
});
