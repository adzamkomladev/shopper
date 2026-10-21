import { expect, test } from "@playwright/test";
import { captureSizes, createBranch, createStore, unique } from "../../../../support/admin";
import {
  activeTab,
  heading,
  nav,
  openRecords,
  recordsSegment,
  recordsTable,
  rowOf,
} from "../../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../../support/e2e";

// seedStock() at Accra Central: one receipt from "Agyei Wholesale <tag>" (delivery note DN-<tag>, Rice 24 kg at
// GH₵ 9.50 and Tomatoes 10.5 kg at GH₵ 28.00 = GH₵ 522.00) and one wastage of 2.5 kg of Rice.

test.describe("as the owner of E2E Mart", () => {
  test("lists receipts and adjustments with who, what and the cost of a delivery", async ({
    page,
  }, info) => {
    const { supplier, tag } = await openRecords(page);
    await expect(nav(page).getByRole("link", { name: "Inventory" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(recordsSegment(page, /^All \d+$/)).toHaveAttribute("aria-selected", "true");
    const receipt = rowOf(page, supplier.name);
    await expect(receipt).toContainText("Received");
    await expect(receipt).toContainText(`DN-${tag}`);
    await expect(receipt).toContainText("2 products");
    await expect(receipt).toContainText("E2E Owner");
    await expect(receipt).toContainText("GH₵ 522.00");
    const wastage = recordsTable(page).getByRole("row").filter({ hasText: "Damaged" }).first();
    await expect(wastage).toContainText("Adjusted");
    await expect(wastage).toContainText("−2.5 kg");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "records-list", async () => {
      await expect(receipt).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("segments filter by kind, keep their counts, and live in the URL", async ({ page }) => {
    const { supplier } = await openRecords(page);
    const damaged = recordsTable(page).getByRole("row").filter({ hasText: "Damaged" });
    await recordsSegment(page, /^Adjusted \d+$/).click();
    await expect(page).toHaveURL(/kind=adjusted/);
    await expect(recordsSegment(page, /^Adjusted \d+$/)).toHaveAttribute("aria-selected", "true");
    await expect(damaged.first()).toBeVisible();
    await expect(rowOf(page, supplier.name)).toHaveCount(0);
    await recordsSegment(page, /^Received \d+$/).click();
    await expect(rowOf(page, supplier.name)).toBeVisible();
    await expect(damaged).toHaveCount(0);
    // A kind with nothing says so, and the other segments still show their counts.
    await recordsSegment(page, /^Counted 0$/).click();
    await expect(heading(page, "No counted records", 2)).toBeVisible();
    await expect(recordsSegment(page, /^Received [1-9]/)).toBeVisible();
    await page.getByRole("link", { name: "Show all records" }).click();
    await expect(rowOf(page, supplier.name)).toBeVisible();
  });

  test("R opens Receive and A opens Adjust, each shown on its button", async ({ page }) => {
    await openRecords(page);
    await expect(page.getByRole("link", { name: "Receive goods" })).toContainText("R");
    await expect(page.getByRole("link", { name: "Adjust stock" })).toContainText("A");
    await heading(page, "Inventory").click();
    await page.keyboard.press("r");
    await expect(page).toHaveURL(/\/stock\/receive/);
    await expect(heading(page, "Receive goods")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(activeTab(page, "Records")).toBeVisible();
    await heading(page, "Inventory").click();
    await page.keyboard.press("a");
    await expect(page).toHaveURL(/\/stock\/adjust/);
    await expect(heading(page, "Adjust stock")).toBeVisible();
  });

  test("a branch with no records says so and offers Receive goods", async ({
    page,
    request,
  }, info) => {
    const store = await createStore(request, `Quiet store ${unique()}`);
    const branch = await createBranch(request, `Quiet ${unique()}`, store.id);
    await page.goto(`/stock/records?branch=${branch.id}`);
    await expect(heading(page, "No stock records yet", 2)).toBeVisible();
    await expect(recordsSegment(page, /^All 0$/)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "records-empty", async () => {
      await expect(heading(page, "No stock records yet", 2)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("main").getByRole("link", { name: "Receive goods" }).last().click();
    await expect(page).toHaveURL(new RegExp(`/stock/receive\\?branch=${branch.id}`));
  });
});
