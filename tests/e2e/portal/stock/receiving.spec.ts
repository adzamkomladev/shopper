import { expect, test, type Page } from "@playwright/test";
import { captureSizes, unique } from "../../../support/admin";
import { dialog } from "../../../support/admin/people";
import {
  addEntryProduct,
  entrySearch as search,
  heading,
  ownProducts,
  seedStock,
} from "../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../support/e2e";

const supplier = (page: Page) => page.getByRole("combobox", { name: "Supplier" });
const save = (page: Page) => page.getByRole("button", { name: /^Receive stock/ });

async function openReceive(page: Page) {
  const { branch } = await seedStock();
  await page.goto(`/stock/receive?branch=${branch.id}`);
  await expect(heading(page, "Receive goods")).toBeFocused();
  return branch;
}

test.describe("as the owner of E2E Mart", () => {
  test("the keyboard path: R, a new supplier, products with quantity and cost, Mod+Enter, the record", async ({
    page,
  }, info) => {
    const { tag, products } = await ownProducts(["Millet", "Sorghum"]);
    const { branch } = await seedStock();
    await page.goto(`/stock/records?branch=${branch.id}`);
    await heading(page, "Inventory").click();
    await page.keyboard.press("r");
    await expect(heading(page, "Receive goods")).toBeFocused();
    await expect(supplier(page)).toContainText("Choose a supplier");

    // S adds a supplier without leaving the page: it is picked when saved, and focus moves on to the products.
    await page.keyboard.press("s");
    const name = `Tema Traders ${unique()}`;
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.type(name);
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Supplier added")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(supplier(page)).toContainText(name);
    await expect(search(page)).toBeFocused();

    await page.getByLabel("Delivery note or invoice").fill(`INV-${tag}`);
    await addEntryProduct(page, products[0]!.name);
    const millet = page.getByRole("row").filter({ hasText: products[0]!.name });
    await page.keyboard.type("10");
    await page.keyboard.press("Tab");
    await expect(millet.getByLabel(/^Unit cost/)).toBeFocused();
    await page.keyboard.type("9.5");
    await expect(millet).toContainText("GH₵ 95.00");
    // Enter in the cost goes back to the search for the next product.
    await page.keyboard.press("Enter");
    await expect(search(page)).toBeFocused();
    await page.keyboard.type(products[1]!.name);
    await page.keyboard.press("Enter");
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: products[1]!.name })
        .getByLabel(/^Quantity/),
    ).toBeFocused();
    await page.keyboard.type("4.5");
    await page.keyboard.press("Tab");
    await page.keyboard.type("28");
    await expect(page.getByRole("row").filter({ hasText: products[1]!.name })).toContainText(
      "GH₵ 126.00",
    );
    // 10 × 9.50 + 4.5 × 28.00
    await expect(page.getByRole("status").filter({ hasText: "Total" })).toContainText("GH₵ 221.00");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "receive-filled", async () => {
      await expect(millet).toBeVisible();
      await expectNoSeriousAxe(page);
    });

    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page).toHaveURL(/\/stock\/records\/[0-9a-f-]{36}/);
    await expect(heading(page, "Goods received")).toBeFocused();
    const main = page.getByRole("main");
    for (const text of [name, `INV-${tag}`, "GH₵ 221.00", products[0]!.name, "4.5 kg"])
      await expect(main).toContainText(text);
  });

  test("Receive goods starts empty with the supplier, reference and search, and says what to do", async ({
    page,
  }, info) => {
    await openReceive(page);
    await expect(supplier(page)).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Branch" })).toContainText("Accra Central");
    await expect(page.getByText("No products yet")).toBeVisible();
    await expect(save(page)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "receive-empty", async () => {
      await expect(page.getByText("No products yet")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("saving without a supplier or a product says what is missing, on the field", async ({
    page,
  }) => {
    await openReceive(page);
    await save(page).click();
    await expect(supplier(page)).toHaveAttribute("aria-invalid", "true");
    await expect(supplier(page)).toBeFocused();
    await expect(page.getByText("Choose who the goods came from")).toBeVisible();
    await supplier(page).click();
    await page.getByRole("option").first().click();
    await save(page).click();
    await expect(page.getByText("Add a product first")).toBeVisible();
  });

  test("a quantity or cost that isn't a number is refused on that line", async ({ page }) => {
    const { products } = await ownProducts(["Maize"]);
    await openReceive(page);
    await supplier(page).click();
    await page.getByRole("option").first().click();
    await addEntryProduct(page, products[0]!.name);
    const line = page.getByRole("row").filter({ hasText: products[0]!.name });
    await line.getByLabel(/^Unit cost/).fill("abc");
    await save(page).click();
    const quantity = line.getByLabel(/^Quantity/);
    await expect(quantity).toHaveAttribute("aria-invalid", "true");
    await expect(quantity).toBeFocused();
    await expect(line.getByLabel(/^Unit cost/)).toHaveAttribute("aria-invalid", "true");
    await expect(line.getByLabel(/^Unit cost/)).toHaveAccessibleDescription(/cost/i);
  });

  test("a field error from the API lands on that field", async ({ page }) => {
    const { products } = await ownProducts(["Cassava"]);
    await openReceive(page);
    await supplier(page).click();
    await page.getByRole("option").first().click();
    await addEntryProduct(page, products[0]!.name);
    await page.keyboard.type("2");
    await page.keyboard.press("Tab");
    await page.keyboard.type("3");
    await page.route("**/api/stock/receipts", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Enter a cost between 0 and 99,999",
          field: "lines.0.unitCost",
        }),
      }),
    );
    await save(page).click();
    const cost = page
      .getByRole("row")
      .filter({ hasText: products[0]!.name })
      .getByLabel(/^Unit cost/);
    await expect(cost).toHaveAttribute("aria-invalid", "true");
    await expect(cost).toBeFocused();
    await expect(cost).toHaveAccessibleDescription("Enter a cost between 0 and 99,999");
  });

  test("a failed save keeps the note, and saving again records it once", async ({ page }) => {
    const { products } = await ownProducts(["Yam"]);
    await openReceive(page);
    await supplier(page).click();
    await page.getByRole("option").first().click();
    await addEntryProduct(page, products[0]!.name);
    await page.keyboard.type("2");
    await page.keyboard.press("Tab");
    await page.keyboard.type("3");
    const sent: string[] = [];
    let failures = 1;
    await page.route("**/api/stock/receipts", (route) => {
      sent.push(JSON.parse(route.request().postData()!).id);
      return failures-- > 0 ? route.abort("failed") : route.fallback();
    });
    await save(page).click();
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await save(page).click();
    await expect(page).toHaveURL(/\/stock\/records\/[0-9a-f-]{36}/);
    // The retry carries the same record id, so a save that did land the first time is not doubled.
    expect(sent).toHaveLength(2);
    expect(sent[0]).toBe(sent[1]);
  });

  test("Escape goes back to the records, but not while a menu or the supplier sheet is open", async ({
    page,
  }) => {
    await openReceive(page);
    await supplier(page).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/stock\/receive/);
    await heading(page, "Receive goods").click();
    await page.keyboard.press("s");
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/stock\/receive/);
    await heading(page, "Receive goods").click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/stock\/records/);
  });

  test("offline, the page stays and Receive stock is disabled with the reason", async ({
    page,
    context,
  }, info) => {
    await openReceive(page);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await expect(save(page)).toBeDisabled();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "receive-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});
