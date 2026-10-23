import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { unique } from "../../../support/admin";
import {
  customerMember,
  makeCustomer,
  openCustomers,
  owedSince,
  settle,
} from "../../../support/admin/customers";
import { signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/admin/shots";
import { ANNEX, signInWithKeyboard } from "../../../support/e2e";

const table = (page: Page) => page.getByRole("region", { name: "Ageing" });
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

async function openAgeing(page: Page) {
  await page.goto("/customers/ageing");
  await expect(page.getByRole("heading", { name: "Customers", level: 1 })).toBeVisible();
}

test.describe("as the owner of E2E Mart", () => {
  test("puts each customer who owes in the bucket their oldest debt falls in", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const late = await makeCustomer(request, { name: `Late ${tag}` });
    const fresh = await makeCustomer(request, { name: `Fresh ${tag}` });
    const clear = await makeCustomer(request, { name: `Clear ${tag}` });
    await owedSince(request, late, 300, 80);
    await owedSince(request, late, 20, 0);
    await settle(request, fresh, { owed: 45 });
    await settle(request, clear, { owed: -5 });
    await openAgeing(page);
    const lateRow = table(page).getByRole("row", { name: new RegExp(late.name) });
    await expect(lateRow).toContainText("GH₵ 300.00");
    await expect(lateRow).toContainText("GH₵ 20.00");
    await expect(lateRow).toContainText("GH₵ 320.00");
    await expect(table(page).getByRole("row", { name: new RegExp(fresh.name) })).toContainText(
      "GH₵ 45.00",
    );
    await expect(table(page).getByRole("row", { name: new RegExp(clear.name) })).toHaveCount(0);
    await expect(table(page).getByRole("row", { name: /All customers/ })).toBeVisible();
    await shoot(page, info, "customers-ageing", async () => {
      await expect(lateRow).toBeVisible();
    });
  });

  test("the Ageing tab is reached by keyboard, a customer opens from it, and D downloads the CSV", async ({
    page,
    request,
  }) => {
    const customer = await makeCustomer(request, { name: `Debtor ${unique()}` });
    await owedSince(request, customer, 99, 40);
    await openCustomers(page);
    await page.getByRole("tab", { name: "Ageing", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/customers\/ageing$/);
    await expect(page.getByRole("tab", { name: "Ageing", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(table(page)).toContainText(customer.name);
    const download = page.waitForEvent("download");
    await page.keyboard.press("d");
    const file = await download;
    expect(file.suggestedFilename()).toBe("ageing.csv");
    const csv = readFileSync(await file.path(), "utf8");
    expect(csv).toContain("Name,Phone,Current,1-30,31-60,61-90,90+,Total");
    expect(csv).toContain(`${customer.name},${customer.phone},0.00,99.00,0.00,0.00,0.00,99.00`);
    await table(page).getByRole("link", { name: customer.name }).click();
    await expect(page.getByRole("heading", { name: customer.name, level: 1 })).toBeVisible();
  });

  test("when the report can't be read the page says so and Try again recovers", async ({
    page,
  }, info) => {
    let down = true;
    await page.route("**/api/customers/ageing", (route) =>
      down ? route.abort("failed") : route.fallback(),
    );
    await openAgeing(page);
    await expect(page.getByText("Couldn't load ageing")).toBeVisible();
    await shoot(page, info, "customers-ageing-error", async () => {
      await expect(page.getByText("Couldn't load ageing")).toBeVisible();
    });
    down = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(table(page)).toBeVisible();
  });

  test("a slow report shows a skeleton the shape of the table", async ({ page }, info) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/customers/ageing", async (route) => {
      await gate;
      return route.fallback();
    });
    await nav(page).getByRole("link", { name: "Customers" }).click();
    await page.getByRole("tab", { name: "Ageing", exact: true }).click();
    try {
      await shoot(page, info, "customers-ageing-loading", async () => {
        await expect(page.getByRole("status", { name: "Loading ageing" })).toBeVisible();
      });
    } finally {
      release();
    }
    await expect(table(page)).toBeVisible();
  });

  test("offline, the report stays and says so", async ({ page, context }, info) => {
    await openAgeing(page);
    await expect(table(page)).toBeVisible();
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await shoot(page, info, "customers-ageing-offline", async () => {
      await expect(note).toBeVisible();
    });
    await context.setOffline(false);
  });
});

test.describe("a shop where nobody owes anything", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("says so", async ({ page }, info) => {
    await signInWithKeyboard(page, ANNEX);
    await openAgeing(page);
    await expect(page.getByRole("heading", { name: "Nobody owes you", level: 2 })).toBeVisible();
    await shoot(page, info, "customers-ageing-empty", async () => {
      await expect(page.getByRole("heading", { name: "Nobody owes you" })).toBeVisible();
    });
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an inventory clerk is told they can't view ageing", async ({ page, request }, info) => {
    const clerk = await customerMember(request, "inventory");
    await page.context().clearCookies();
    await signInAs(page, clerk);
    await page.goto("/customers/ageing");
    await expect(page.getByText("You don't have permission to view ageing")).toBeVisible();
    await shoot(page, info, "customers-ageing-nopermission", async () => {
      await expect(page.getByText("You don't have permission to view ageing")).toBeVisible();
    });
  });
});
