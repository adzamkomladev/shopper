import { expect, test } from "@playwright/test";
import { captureSizes } from "../../../../support/admin";
import { signInAs } from "../../../../support/admin/people";
import {
  heading,
  nav,
  openRecords,
  recordsTable,
  rowOf,
  seedStock,
  stockMember,
} from "../../../../support/admin/stock";
import { expectNoSeriousAxe } from "../../../../support/e2e";

test.describe("as the owner of E2E Mart", () => {
  test("when the server can't be reached the list says so and Try again recovers", async ({
    page,
  }, info) => {
    const { branch } = await seedStock();
    let failures = 1;
    await page.route("**/api/stock/documents?*", (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto(`/stock/records?branch=${branch.id}`);
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "records-error", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(recordsTable(page)).toBeVisible();
  });

  test("a slow list shows a skeleton shaped like the page", async ({ page }, info) => {
    const { branch } = await seedStock();
    await page.goto("/products");
    await expect(heading(page, "Products")).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/stock/documents?*", async (route) => {
      await gate;
      return route.fallback();
    });
    await page.goto(`/stock/records?branch=${branch.id}`);
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading stock records" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "records-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(recordsTable(page)).toBeVisible();
  });

  test("offline, the list stays and says writes wait for a connection", async ({
    page,
    context,
  }, info) => {
    await openRecords(page);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "records-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an accountant reads the records but has no Receive or Adjust, and R does nothing", async ({
    page,
    request,
  }, info) => {
    const { supplier, receiptId, branch } = await seedStock();
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "accountant"));
    await page.goto(`/stock/records?branch=${branch.id}`);
    await expect(rowOf(page, supplier.name)).toBeVisible();
    await expect(page.getByRole("link", { name: "Receive goods" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Adjust stock" })).toHaveCount(0);
    await heading(page, "Inventory").click();
    await page.keyboard.press("r");
    await expect(page).toHaveURL(/\/stock\/records/);
    await page.goto(`/stock/records/${receiptId}`);
    await expect(heading(page, "Goods received")).toBeVisible();
    await page.goto("/stock/receive");
    await expect(page.getByText("You don't have permission to receive goods")).toBeVisible();
    await page.goto("/stock/adjust");
    await expect(page.getByText("You don't have permission to adjust stock")).toBeVisible();
    await captureSizes(page, info, "records-no-permission-write", async () => {
      await expect(page.getByText("You don't have permission to adjust stock")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("without stock.read the Records page is the no-permission state", async ({
    page,
    request,
  }) => {
    const { receiptId } = await seedStock();
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "nobody"));
    await page.goto("/stock/records");
    await expect(page.getByText("You don't have permission to view stock records")).toBeVisible();
    await expectNoSeriousAxe(page);
    await page.goto(`/stock/records/${receiptId}`);
    await expect(page.getByText("You don't have permission to view stock records")).toBeVisible();
  });

  test("an inventory manager has the Stock, Records, Stock takes, Valuation and Suppliers tabs", async ({
    page,
    request,
  }) => {
    await page.context().clearCookies();
    await signInAs(page, await stockMember(request, "inventory"));
    await nav(page).getByRole("link", { name: "Inventory" }).click();
    for (const name of ["Stock", "Records", "Stock takes", "Valuation", "Suppliers"])
      await expect(page.getByRole("tab", { name, exact: true })).toBeVisible();
  });
});
