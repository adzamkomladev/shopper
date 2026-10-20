import { expect, test } from "@playwright/test";
import { captureSizes } from "../../../support/admin";
import { dialog, signInAs } from "../../../support/admin/people";
import { heading, nav, seedStock, stockMember } from "../../../support/admin/stock";
import { ANNEX, expectNoSeriousAxe, signInWithKeyboard } from "../../../support/e2e";

test.describe("as the owner of E2E Mart", () => {
  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    const { branch } = await seedStock();
    let failures = 1;
    await page.route("**/api/stock?*", (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto(`/stock?branch=${branch.id}`);
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stock-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(heading(page, "Inventory")).toBeVisible();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    const { branch } = await seedStock();
    await page.goto("/products");
    await expect(heading(page, "Products")).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/stock?*", async (route) => {
      await gate;
      return route.fallback();
    });
    await page.goto(`/stock?branch=${branch.id}`);
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading stock" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "stock-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  test("offline, the list and the product page stay and say writes wait for a connection", async ({
    page,
    context,
  }, info) => {
    const { branch, beans } = await seedStock();
    await page.goto(`/stock/products/${beans.id}?branch=${branch.id}`);
    const edit = page.getByRole("button", { name: /Edit reorder level/ });
    await expect(edit).toBeEnabled();
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await page.keyboard.press("e");
    await expect(dialog(page).getByRole("button", { name: /Save level/ })).toBeDisabled();
    await expect(dialog(page)).toContainText("You're offline");
    await page.keyboard.press("Escape");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stock-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("a shop with no branch", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("asks for a branch first and links to Branches", async ({ page }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await page.goto("/stock");
    await expect(heading(page, "Add a branch first", 2)).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stock-empty", async () => {
      await expect(heading(page, "Add a branch first", 2)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("link", { name: "Go to branches" }).click();
    await expect(heading(page, "Branches")).toBeVisible();
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an accountant can read stock but has no way to change a level", async ({
    page,
    request,
  }, info) => {
    const { branch, beans, tag } = await seedStock();
    const accountant = await stockMember(request, "accountant");
    await page.context().clearCookies();
    await signInAs(page, accountant);
    await nav(page).getByRole("link", { name: "Inventory" }).click();
    await expect(heading(page, "Inventory")).toBeVisible();
    await page.goto(`/stock/products/${beans.id}?branch=${branch.id}`);
    await expect(heading(page, `Beans ${tag}`)).toBeVisible();
    await expect(page.getByRole("button", { name: /Edit reorder level/ })).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText("view");
    await page.keyboard.press("e");
    await expect(dialog(page)).toHaveCount(0);
    await captureSizes(page, info, "stock-product-readonly", async () => {
      await expect(heading(page, `Beans ${tag}`)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("without stock.read there is no link and the page is the no-permission state", async ({
    page,
    request,
  }, info) => {
    const nobody = await stockMember(request, "nobody");
    await page.context().clearCookies();
    await signInAs(page, nobody);
    await expect(nav(page).getByRole("link", { name: "Inventory" })).toHaveCount(0);
    await page.goto("/stock");
    await expect(page.getByText("You don't have permission to view stock")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "stock-no-permission", async () => {
      await expect(page.getByText("You don't have permission to view stock")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("an inventory manager has the Inventory link with its Stock and Suppliers tabs, but not the Users page", async ({
    page,
    request,
  }) => {
    const clerk = await stockMember(request, "inventory");
    await page.context().clearCookies();
    await signInAs(page, clerk);
    await nav(page).getByRole("link", { name: "Inventory" }).click();
    await expect(page.getByRole("tab", { name: "Stock" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Suppliers" })).toBeVisible();
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: "You don't have permission" })).toBeVisible();
  });
});
