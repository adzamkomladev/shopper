import { expect, test, type Page } from "@playwright/test";
import { captureSizes } from "../../../support/admin";
import { customerMember, makeCustomer, openCustomers } from "../../../support/admin/customers";
import { dialog, signInAs } from "../../../support/admin/people";
import { ANNEX, expectNoSeriousAxe, signInWithKeyboard } from "../../../support/e2e";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

test.describe("as the owner of E2E Mart", () => {
  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    let failures = 1;
    await page.route("**/api/customers?*", (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto("/customers");
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customers-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/customers?*", async (route) => {
      await gate;
      return route.fallback();
    });
    await nav(page).getByRole("link", { name: "Customers" }).click();
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading customers" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "customers-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(page.getByRole("row").nth(1)).toBeVisible();
  });

  test("offline, the list stays and Add customer says it needs a connection", async ({
    page,
    request,
    context,
  }, info) => {
    await makeCustomer(request);
    await openCustomers(page);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await page.getByRole("button", { name: "Add customer" }).click();
    await expect(dialog(page).getByRole("button", { name: /Save customer/ })).toBeDisabled();
    await expect(dialog(page)).toContainText("You're offline");
    await page.keyboard.press("Escape");
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customers-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("a shop with no customers", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("asks you to add the first one, and each segment says what is missing", async ({
    page,
  }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await page.goto("/customers");
    await expect(page.getByRole("heading", { name: "No customers yet", level: 2 })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customers-empty", async () => {
      await expect(page.getByRole("heading", { name: "No customers yet" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("tab", { name: "Business", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "No business customers", level: 2 }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "Archived", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "No archived customers", level: 2 }),
    ).toBeVisible();
    await page.getByRole("tab", { name: "All", exact: true }).click();
    await page.getByRole("button", { name: "Add customer" }).last().click();
    await expect(dialog(page)).toBeVisible();
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an inventory clerk has no Customers link and is told so at the address", async ({
    page,
    request,
  }, info) => {
    const clerk = await customerMember(request, "inventory");
    await page.context().clearCookies();
    await signInAs(page, clerk);
    await expect(nav(page).getByRole("link", { name: "Customers" })).toHaveCount(0);
    await page.goto("/customers");
    await expect(page.getByText("You don't have permission to view customers")).toBeVisible();
    await captureSizes(page, info, "customers-nopermission", async () => {
      await expect(page.getByText("You don't have permission to view customers")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("an accountant can read customers but has no way to add one", async ({ page, request }) => {
    const accountant = await customerMember(request, "accountant");
    await page.context().clearCookies();
    await signInAs(page, accountant);
    await nav(page).getByRole("link", { name: "Customers" }).click();
    await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add customer" })).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText("view");
    await page.keyboard.press("n");
    await expect(dialog(page)).toHaveCount(0);
  });
});
