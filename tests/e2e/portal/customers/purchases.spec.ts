import { expect, test, type Page } from "@playwright/test";
import { unique } from "../../../support/admin";
import {
  makeCustomer,
  openCustomer,
  openCustomers,
  segment,
  settle,
} from "../../../support/admin/customers";
import { shoot } from "../../../support/admin/shots";

const table = (page: Page) => page.getByRole("region", { name: "Purchases" });

test.describe("as the owner of E2E Mart", () => {
  test("a customer who has not bought yet is told where purchases come from", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    await openCustomer(page, customer);
    await expect(page.getByRole("tab", { name: "Purchases" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "No purchases yet", level: 2 })).toBeVisible();
    await shoot(page, info, "customer-purchases-empty", async () => {
      await expect(page.getByRole("heading", { name: "No purchases yet" })).toBeVisible();
      return page.getByRole("heading", { name: "No purchases yet" });
    });
  });

  test("lists their sales newest first with the total right-aligned", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    await page.route(`**/api/customers/${customer.id}/sales`, (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: "1",
              receiptNumber: "R-0002",
              occurredAt: "2026-10-22T14:05:00.000Z",
              total: 450_000,
              status: "completed",
            },
            {
              id: "2",
              receiptNumber: "R-0001",
              occurredAt: "2026-10-01T09:30:00.000Z",
              total: 120_500,
              status: "completed",
            },
          ],
        },
      }),
    );
    await openCustomer(page, customer);
    await expect(table(page).getByRole("row").nth(1)).toContainText("R-0002");
    await expect(table(page).getByRole("row").nth(1)).toContainText("GH₵ 45.00");
    await expect(table(page).getByRole("row").nth(2)).toContainText("GH₵ 12.05");
    await shoot(page, info, "customer-purchases", async () => {
      await expect(table(page)).toBeVisible();
      return table(page);
    });
  });

  test("when purchases can't be read the page says so and Try again recovers", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    let down = true;
    await page.route(`**/api/customers/${customer.id}/sales`, (route) =>
      down ? route.abort("failed") : route.fallback(),
    );
    await openCustomer(page, customer);
    await expect(page.getByText("Couldn't load purchases")).toBeVisible();
    await shoot(page, info, "customer-purchases-error", async () => {
      await expect(page.getByText("Couldn't load purchases")).toBeVisible();
      return page.getByText("Couldn't load purchases");
    });
    down = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: "No purchases yet" })).toBeVisible();
  });

  test("slow purchases show a skeleton the shape of the table", async ({ page, request }, info) => {
    const customer = await makeCustomer(request);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/api/customers/${customer.id}/sales`, async (route) => {
      await gate;
      return route.fallback();
    });
    await page.goto(`/customers/${customer.id}`);
    try {
      await shoot(page, info, "customer-purchases-loading", async () => {
        await expect(page.getByRole("status", { name: "Loading purchases" })).toBeVisible();
        return page.getByRole("status", { name: "Loading purchases" });
      });
    } finally {
      release();
    }
    await expect(page.getByRole("heading", { name: "No purchases yet" })).toBeVisible();
  });
});

test.describe("the customer list", () => {
  test("On account lists only customers who owe, and Last visit says Never before a first sale", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const owing = await makeCustomer(request, { name: `Owes ${tag}` });
    const paid = await makeCustomer(request, { name: `Paid ${tag}` });
    await settle(request, owing, { owed: 80 });
    await settle(request, paid, { owed: -10 });
    await openCustomers(page, `?q=${tag}`);
    await expect(page.getByRole("row", { name: new RegExp(paid.name) })).toBeVisible();
    await segment(page, "On account").click();
    await expect(page).toHaveURL(/segment=account/);
    await expect(page.getByRole("row", { name: new RegExp(owing.name) })).toContainText(
      "GH₵ 80.00",
    );
    await expect(page.getByRole("row", { name: new RegExp(owing.name) })).toContainText("Never");
    await expect(page.getByRole("row", { name: new RegExp(paid.name) })).toHaveCount(0);
    await shoot(page, info, "customers-on-account", async () => {
      await expect(page.getByRole("row", { name: new RegExp(owing.name) })).toBeVisible();
      return page.getByRole("row", { name: new RegExp(owing.name) });
    });
  });
});
