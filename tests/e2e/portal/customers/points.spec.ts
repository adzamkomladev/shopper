import { expect, test, type Page } from "@playwright/test";
import { v7 } from "uuid";
import {
  enableLoyalty,
  makeCustomer,
  settle,
  type CustomerRow,
} from "../../../support/admin/customers";
import { shoot } from "../../../support/admin/shots";

const table = (page: Page) => page.getByRole("region", { name: "Points history" });
const card = (page: Page, label: string) => page.getByRole("group", { name: label });

async function openPoints(page: Page, customer: Pick<CustomerRow, "id" | "name">) {
  await page.goto(`/customers/${customer.id}?tab=points`);
  await expect(page.getByRole("heading", { name: customer.name, level: 1 })).toBeVisible();
}

test.describe("as the owner of E2E Mart", () => {
  test("lists every change to their points, newest first, with the balance after each", async ({
    page,
    request,
  }, info) => {
    await enableLoyalty(request);
    const customer = await makeCustomer(request);
    await settle(request, customer, { points: 100 });
    await settle(request, customer, { points: -30 });
    await openPoints(page, customer);
    const rows = table(page).getByRole("row");
    await expect(rows.nth(1)).toContainText("Spent");
    await expect(rows.nth(1)).toContainText("-30");
    await expect(rows.nth(1)).toContainText("70");
    await expect(rows.nth(2)).toContainText("Earned");
    await expect(rows.nth(2)).toContainText("+100");
    await shoot(page, info, "customer-points", async () => {
      await expect(table(page)).toBeVisible();
      return table(page);
    });
  });

  test("a customer with no points yet is told how they are earned", async ({
    page,
    request,
  }, info) => {
    await enableLoyalty(request);
    const customer = await makeCustomer(request);
    await openPoints(page, customer);
    await expect(page.getByRole("heading", { name: "No points yet", level: 2 })).toBeVisible();
    await shoot(page, info, "customer-points-empty", async () => {
      await expect(page.getByRole("heading", { name: "No points yet" })).toBeVisible();
      return page.getByRole("heading", { name: "No points yet" });
    });
  });

  test("the tier shows beside the points, with the day it is lost", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    await page.route(`**/api/customers/${customer.id}/loyalty`, (route) =>
      route.fulfill({
        json: {
          customerId: customer.id,
          points: 0,
          enabled: true,
          tier: { id: v7(), name: "Gold", minSpend: 0, earnBps: 300, archivedAt: null },
          projection: { from: "Gold", to: "Silver", on: "2026-11-12T10:00:00.000Z" },
          entries: [],
        },
      }),
    );
    await page.goto(`/customers/${customer.id}`);
    await expect(card(page, "Points")).toContainText("Gold");
    await expect(page.getByText("Moves to Silver on 12 Nov")).toBeVisible();
    await shoot(page, info, "customer-tier", async () => {
      await expect(page.getByText("Moves to Silver on 12 Nov")).toBeVisible();
      return page.getByText("Moves to Silver on 12 Nov");
    });
  });

  test("when loyalty is off the history says so", async ({ page, request }) => {
    const customer = await makeCustomer(request);
    await page.route(`**/api/customers/${customer.id}/loyalty`, (route) =>
      route.fulfill({
        json: {
          customerId: customer.id,
          points: 0,
          enabled: false,
          tier: null,
          projection: null,
          entries: [],
        },
      }),
    );
    await openPoints(page, customer);
    await expect(page.getByRole("note")).toContainText("Loyalty is switched off");
  });

  test("when the history can't be read the page says so and Try again recovers", async ({
    page,
    request,
  }, info) => {
    await enableLoyalty(request);
    const customer = await makeCustomer(request);
    await settle(request, customer, { points: 40 });
    let down = true;
    await page.route(`**/api/customers/${customer.id}/loyalty`, (route) =>
      down ? route.abort("failed") : route.fallback(),
    );
    await openPoints(page, customer);
    await expect(page.getByText("Couldn't load points history")).toBeVisible();
    await shoot(page, info, "customer-points-error", async () => {
      await expect(page.getByText("Couldn't load points history")).toBeVisible();
      return page.getByText("Couldn't load points history");
    });
    down = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(table(page)).toContainText("Earned");
  });

  test("a slow history shows a skeleton the shape of the table", async ({
    page,
    request,
  }, info) => {
    await enableLoyalty(request);
    const customer = await makeCustomer(request);
    await settle(request, customer, { points: 40 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let first = true;
    // The page's own read fails fast so it opens; the tab's read is the slow one.
    await page.route(`**/api/customers/${customer.id}/loyalty`, async (route) => {
      if (first) {
        first = false;
        return route.abort("failed");
      }
      await gate;
      return route.fallback();
    });
    await openPoints(page, customer);
    try {
      await shoot(page, info, "customer-points-loading", async () => {
        await expect(page.getByRole("status", { name: "Loading points history" })).toBeVisible();
        return page.getByRole("status", { name: "Loading points history" });
      });
    } finally {
      release();
    }
    await expect(table(page)).toContainText("Earned");
  });
});
