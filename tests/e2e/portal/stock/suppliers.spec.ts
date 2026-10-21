import { expect, test, type Page } from "@playwright/test";
import { captureSizes, unique } from "../../../support/admin";
import { dialog, row, signInAs } from "../../../support/admin/people";
import { activeTab, heading, nav, seedStock, stockMember } from "../../../support/admin/stock";
import { ANNEX, expectNoSeriousAxe, signInWithKeyboard } from "../../../support/e2e";

// seedStock() adds the supplier "Agyei Wholesale <tag>" with no contact details.
const add = (page: Page) => page.getByRole("button", { name: "Add supplier" });

async function openSuppliers(page: Page) {
  const { supplier } = await seedStock();
  await page.goto("/suppliers");
  await expect(activeTab(page, "Suppliers")).toBeVisible();
  return supplier;
}

test.describe("as the owner of E2E Mart", () => {
  test("lists suppliers by name", async ({ page }, info) => {
    const supplier = await openSuppliers(page);
    await expect(row(page, supplier.name)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "suppliers", async () => {
      await expect(activeTab(page, "Suppliers")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("N adds a supplier with the keyboard, and focus returns to Add supplier", async ({
    page,
  }, info) => {
    await openSuppliers(page);
    const name = `Kasapreko ${unique()}`;
    await page.keyboard.press("n");
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.type(name);
    await page.keyboard.press("Tab");
    await page.keyboard.type("0241234567");
    await page.keyboard.press("Tab");
    await page.keyboard.type("orders@kasapreko.example");
    await page.keyboard.press("Tab");
    await page.keyboard.type("C0012345678");
    await captureSizes(page, info, "suppliers-form", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Supplier added")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row(page, name)).toContainText("0241234567");
    await expect(row(page, name)).toContainText("orders@kasapreko.example");
    await expect(row(page, name)).toContainText("C0012345678");
    await expect(add(page)).toBeFocused();
  });

  test("edit changes a supplier's phone and clearing a field removes it", async ({ page }) => {
    const supplier = await openSuppliers(page);
    await page.getByRole("button", { name: `Edit ${supplier.name}` }).click();
    await expect(dialog(page).getByLabel("Name", { exact: true })).toHaveValue(supplier.name);
    await dialog(page).getByLabel("Phone").fill("0207654321");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Supplier saved")).toBeVisible();
    await expect(row(page, supplier.name)).toContainText("0207654321");
    await page.getByRole("button", { name: `Edit ${supplier.name}` }).click();
    await dialog(page).getByLabel("Phone").fill("");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Supplier saved")).toBeVisible();
    await expect(row(page, supplier.name)).not.toContainText("0207654321");
  });

  test("a blank name is refused on the Name field", async ({ page }) => {
    await openSuppliers(page);
    await add(page).click();
    await dialog(page).getByRole("button", { name: "Save supplier" }).click();
    const field = dialog(page).getByLabel("Name", { exact: true });
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(/\S/);
    await expect(field).toBeFocused();
  });

  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    let failures = 1;
    await page.route("**/api/suppliers", (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto("/suppliers");
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await captureSizes(page, info, "suppliers-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(activeTab(page, "Suppliers")).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    await seedStock();
    await page.goto("/products");
    await expect(heading(page, "Products")).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/suppliers", async (route) => {
      await gate;
      return route.fallback();
    });
    await nav(page).getByRole("link", { name: "Inventory" }).click();
    await expect(activeTab(page, "Stock")).toBeVisible();
    await page.getByRole("tab", { name: "Suppliers" }).click();
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading suppliers" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "suppliers-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(activeTab(page, "Suppliers")).toBeVisible();
  });

  test("offline, the list stays and saving waits for a connection", async ({
    page,
    context,
  }, info) => {
    const supplier = await openSuppliers(page);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await expect(row(page, supplier.name)).toBeVisible();
    await add(page).click();
    await expect(dialog(page).getByRole("button", { name: /Save supplier/ })).toBeDisabled();
    await page.keyboard.press("Escape");
    await captureSizes(page, info, "suppliers-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("a shop with no suppliers", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("explains what suppliers are for and offers Add supplier", async ({ page }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await page.goto("/suppliers");
    await expect(heading(page, "No suppliers yet", 2)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "suppliers-empty", async () => {
      await expect(heading(page, "No suppliers yet", 2)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await add(page).click();
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an accountant can read suppliers but not change them", async ({ page, request }, info) => {
    const { supplier } = await seedStock();
    const accountant = await stockMember(request, "accountant");
    await page.context().clearCookies();
    await signInAs(page, accountant);
    await nav(page).getByRole("link", { name: "Inventory" }).click();
    await page.getByRole("tab", { name: "Suppliers" }).click();
    await expect(row(page, supplier.name)).toBeVisible();
    await expect(add(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Edit ${supplier.name}` })).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText("view");
    await page.keyboard.press("n");
    await expect(dialog(page)).toHaveCount(0);
    await captureSizes(page, info, "suppliers-readonly", async () => {
      await expect(row(page, supplier.name)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("without product.read there is no link and the page is the no-permission state", async ({
    page,
    request,
  }, info) => {
    const staff = await stockMember(request, "nobody");
    await page.context().clearCookies();
    await signInAs(page, staff);
    await expect(nav(page).getByRole("link", { name: "Inventory" })).toHaveCount(0);
    await page.goto("/suppliers");
    await expect(page.getByText("You don't have permission to view suppliers")).toBeVisible();
    await captureSizes(page, info, "suppliers-no-permission", async () => {
      await expect(page.getByText("You don't have permission to view suppliers")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });
});
