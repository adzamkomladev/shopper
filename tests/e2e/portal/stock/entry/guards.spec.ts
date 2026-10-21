import { expect, test, type Page } from "@playwright/test";
import { captureSizes } from "../../../../support/admin";
import { signInAs } from "../../../../support/admin/people";
import {
  addEntryProduct,
  entrySearch,
  heading,
  ownProducts,
  seedStock,
  stockMember,
} from "../../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../../support/e2e";

async function openReceive(page: Page) {
  const { branch } = await seedStock();
  await page.goto(`/stock/receive?branch=${branch.id}`);
  await expect(heading(page, "Receive goods")).toBeFocused();
}

test.describe("as the owner of E2E Mart", () => {
  test("Escape or Back with products asks before discarding, and Keep editing returns to the form", async ({
    page,
  }, info) => {
    const { products } = await ownProducts(["Cowpeas"]);
    await openReceive(page);
    await addEntryProduct(page, products[0]!.name);
    const discard = page.getByRole("alertdialog", { name: "Discard this delivery?" });
    await page.keyboard.press("Escape");
    await expect(discard).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "receive-discard", async () => {
      await expect(discard).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect(discard).toBeHidden();
    await expect(page).toHaveURL(/\/stock\/receive/);
    await expect(entrySearch(page)).toBeFocused();
    await expect(page.getByRole("row").filter({ hasText: products[0]!.name })).toBeVisible();
    // The Back link asks too, and Discard leaves with nothing saved.
    await page.getByRole("link", { name: "Back to records" }).click();
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard" }).click();
    await expect(page).toHaveURL(/\/stock\/records/);
    await page.goBack();
    await expect(page.getByText("No products yet")).toBeVisible();
  });

  test("a form with no products leaves without asking", async ({ page }) => {
    await openReceive(page);
    await page.getByRole("link", { name: "Back to records" }).click();
    await expect(page).toHaveURL(/\/stock\/records/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });
});

test.describe("a member who can receive stock but not view products", () => {
  test("Receive is the no-permission state for suppliers, not the route error", async ({
    page,
    request,
  }, info) => {
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "receiver"));
    await page.goto("/stock/receive");
    await expect(page.getByText("You don't have permission to view suppliers")).toBeVisible();
    await expect(page.getByText("Something went wrong")).toHaveCount(0);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "receive-no-suppliers", async () => {
      await expect(page.getByText("You don't have permission to view suppliers")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
