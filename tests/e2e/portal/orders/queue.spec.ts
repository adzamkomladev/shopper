// Day 34: the store's online order queue. The owner of E2E Mart is signed in; busy answers are replayed to draw every
// stage full, the real API answers the quiet queue.
import { expect, test, type Page } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { expectNoSeriousAxe } from "../../../support/e2e";
import { busyQueue } from "../../../support/orders/busy";

test.describe.configure({ timeout: 180_000 });

const replay = (page: Page, seen: URL[] = []) =>
  page.route(
    (url) => url.pathname.endsWith("/api/orders"),
    (route) => {
      const url = new URL(route.request().url());
      seen.push(url);
      return route.fulfill({
        json: busyQueue((url.searchParams.get("stage") ?? "new") as "new"),
      });
    },
  );
const heading = (page: Page) => page.getByRole("heading", { name: "Online orders", level: 1 });

test("the queue shows each stage with its count, soonest slot first", async ({ page }, info) => {
  const seen: URL[] = [];
  await replay(page, seen);
  await page.goto("/orders");
  await expect(heading(page)).toBeVisible();
  const table = page.getByRole("region", { name: "Online orders" });
  await expect(table.getByRole("row")).toHaveCount(1 + 2);
  await expect(page.getByRole("tab", { name: /New\s*2/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Preparing\s*3/ })).toBeVisible();
  await expect(table.getByRole("row").nth(1)).toContainText("#1001");
  await expect(table.getByRole("row").nth(1)).toContainText("New");
  await shoot(page, info, "orders-queue");

  await page.getByRole("tab", { name: /Preparing/ }).click();
  await expect(table.getByRole("row")).toHaveCount(1 + 3);
  await expect(page).toHaveURL(/stage=preparing/);
  expect(seen.some((url) => url.searchParams.get("stage") === "preparing")).toBe(true);
  await page.getByRole("tab", { name: /Done/ }).click();
  await expect(table.getByRole("row").filter({ hasText: "Refunded" })).toHaveCount(1);
});

test("the keyboard reaches search with / and an order opens from its number", async ({ page }) => {
  await replay(page);
  await page.route(
    (url) => /\/api\/orders\/[^/]+$/.test(url.pathname),
    (route) => route.abort(),
  );
  await page.goto("/orders");
  await expect(heading(page)).toBeVisible();
  await page.keyboard.press("/");
  await expect(page.getByLabel("Search orders")).toBeFocused();
  await page.getByLabel("Search orders").fill("Ama");
  await expect(page).toHaveURL(/q=Ama/);
  const link = page.getByRole("link", { name: "#1001" });
  await link.focus();
  await expect(link).toBeFocused();
  await expect(link).toHaveAttribute("href", /\/orders\/019a0000/);
});

test("a quiet queue says so for the stage and offers nothing to clear", async ({ page }, info) => {
  await page.goto("/orders");
  await expect(heading(page)).toBeVisible();
  await expect(page.getByRole("heading", { name: "No orders waiting" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /New\s*0/ })).toBeVisible();
  await shoot(page, info, "orders-empty");
});

test("a failed load says so and recovers on retry; a search with no match offers to clear it", async ({
  page,
}) => {
  let fail = true;
  await page.route(
    (url) => url.pathname.endsWith("/api/orders"),
    (route) =>
      fail
        ? route.fulfill({ status: 500, json: { error: "The orders could not be read." } })
        : route.fulfill({
            json: { counts: { new: 0, preparing: 0, ready: 0, done: 0 }, orders: [] },
          }),
  );
  await page.goto("/orders");
  await expect(page.getByText(/could not be read|Something went wrong/i).first()).toBeVisible();
  fail = false;
  await page
    .getByRole("button", { name: /try again|retry/i })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "No orders waiting" })).toBeVisible();
  await page.goto("/orders?q=zzz");
  await expect(page.getByRole("heading", { name: "Nothing matches this search" })).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).not.toHaveURL(/q=zzz/);
  await expectNoSeriousAxe(page);
});
