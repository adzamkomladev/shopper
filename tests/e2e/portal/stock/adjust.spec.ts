import { expect, test, type Page } from "@playwright/test";
import { captureSizes } from "../../../support/admin";
import { heading, ownProducts, seedStock } from "../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../support/e2e";

// ownProducts() receives 10 kg of each product, so every number below starts from 10 kg on hand.

const search = (page: Page) =>
  page.getByRole("textbox", { name: "Scan barcode or search products" });
const cause = (page: Page) => page.getByRole("combobox", { name: "Cause" });
const direction = (page: Page) => page.getByRole("combobox", { name: "Direction" });
const save = (page: Page) => page.getByRole("button", { name: /^Adjust stock/ });

async function openAdjust(page: Page) {
  const { branch } = await seedStock();
  await page.goto(`/stock/adjust?branch=${branch.id}`);
  await expect(heading(page, "Adjust stock")).toBeFocused();
  return branch;
}

async function addLine(page: Page, name: string, quantity: string) {
  await search(page).fill(name);
  await search(page).press("Enter");
  await expect(page.getByLabel(/^Quantity/)).toBeFocused();
  await page.keyboard.type(quantity);
}

test.describe("as the owner of E2E Mart", () => {
  test("wastage: damaged stock removes from on hand, and the record shows the cause and the loss", async ({
    page,
  }, info) => {
    const { products } = await ownProducts(["Plantain"]);
    const branch = await openAdjust(page);
    await cause(page).click();
    await page.getByRole("option", { name: "Damaged" }).click();
    await expect(direction(page)).toHaveCount(0);
    await addLine(page, products[0]!.name, "2.5");
    const line = page.getByRole("row").filter({ hasText: products[0]!.name });
    await expect(line).toContainText("removes 2.5 kg");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "adjust-damaged", async () => {
      await expect(line).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page).toHaveURL(/\/stock\/records\/[0-9a-f-]{36}/);
    await expect(heading(page, "Stock adjustment")).toBeFocused();
    await expect(page.getByRole("main")).toContainText("Damaged");
    await expect(page.getByRole("region", { name: "Items adjusted" })).toContainText("−2.5 kg");
    await page.goto(`/stock/products/${products[0]!.id}?branch=${branch.id}`);
    await expect(page.getByRole("main")).toContainText("7.5 kg");
  });

  test("found stock adds, and Other needs a direction before it can be saved", async ({ page }) => {
    const { products } = await ownProducts(["Groundnuts"]);
    const branch = await openAdjust(page);
    await cause(page).click();
    await page.getByRole("option", { name: "Found" }).click();
    await addLine(page, products[0]!.name, "1");
    await expect(page.getByRole("row").filter({ hasText: products[0]!.name })).toContainText(
      "adds 1 kg",
    );
    await cause(page).click();
    await page.getByRole("option", { name: "Other" }).click();
    await expect(direction(page)).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: products[0]!.name })).toContainText(
      "Choose a direction",
    );
    await save(page).click();
    await expect(direction(page)).toHaveAttribute("aria-invalid", "true");
    await expect(direction(page)).toBeFocused();
    await direction(page).click();
    await page.getByRole("option", { name: "Remove stock" }).click();
    await expect(page.getByRole("row").filter({ hasText: products[0]!.name })).toContainText(
      "removes 1 kg",
    );
    await save(page).click();
    await expect(page).toHaveURL(/\/stock\/records\/[0-9a-f-]{36}/);
    await page.goto(`/stock/products/${products[0]!.id}?branch=${branch.id}`);
    await expect(page.getByRole("main")).toContainText("9 kg");
  });

  test("saving without a cause or a product says what is missing", async ({ page }) => {
    await openAdjust(page);
    await save(page).click();
    await expect(cause(page)).toHaveAttribute("aria-invalid", "true");
    await expect(cause(page)).toBeFocused();
    await expect(page.getByText("Choose why stock is changing")).toBeVisible();
    await cause(page).click();
    await page.getByRole("option", { name: "Theft" }).click();
    await save(page).click();
    await expect(page.getByText("Add a product first")).toBeVisible();
    await expect(page.getByText("No products yet")).toBeVisible();
  });

  test("a quantity that isn't a number is refused on that line", async ({ page }) => {
    const { products } = await ownProducts(["Onions"]);
    await openAdjust(page);
    await cause(page).click();
    await page.getByRole("option", { name: "Expired" }).click();
    await addLine(page, products[0]!.name, "lots");
    await save(page).click();
    const quantity = page.getByLabel(/^Quantity/);
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await expect(quantity).toHaveAccessibleDescription(/quantity/i);
  });

  test("Escape or Back with products asks before discarding, and Keep editing returns to the form", async ({
    page,
  }) => {
    const { products } = await ownProducts(["Lentils"]);
    await openAdjust(page);
    await cause(page).click();
    await page.getByRole("option", { name: "Damaged" }).click();
    await addLine(page, products[0]!.name, "1");
    const discard = page.getByRole("alertdialog", { name: "Discard this adjustment?" });
    await page.keyboard.press("Escape");
    await expect(discard).toBeVisible();
    await expectNoSeriousAxe(page);
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect(discard).toBeHidden();
    await expect(search(page)).toBeFocused();
    await expect(page.getByRole("row").filter({ hasText: products[0]!.name })).toBeVisible();
    await page.getByRole("link", { name: "Back to records" }).click();
    await expect(discard).toBeVisible();
    await discard.getByRole("button", { name: "Discard" }).click();
    await expect(page).toHaveURL(/\/stock\/records/);
  });

  test("a form with no products leaves without asking", async ({ page }) => {
    await openAdjust(page);
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/stock\/records/);
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
  });

  test("offline, Adjust stock is disabled with the reason", async ({ page, context }, info) => {
    await openAdjust(page);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await expect(save(page)).toBeDisabled();
    await captureSizes(page, info, "adjust-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});
