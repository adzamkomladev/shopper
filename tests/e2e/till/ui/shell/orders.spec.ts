// Day 34: the register's sidebar reaches the online order queue (in the back office) for staff who hold order.read, and
// only while the register is connected.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";

const nav = (page: Page) => page.getByRole("navigation", { name: "Register" });
const open = async (page: Page, query: string) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(`/harness/index.html?scenario=lines&${query}`);
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
};

test("staff with order.read get Online orders, which opens the queue in the back office", async ({
  page,
}) => {
  await open(page, "permissions=sale.create,customer.read,order.read");
  const link = nav(page).getByRole("link", { name: "Online orders" });
  await expect(link).toHaveAttribute("href", "/backoffice/orders");
  await expect(link).toHaveAttribute("aria-keyshortcuts", "Alt+W");
  await expectNoSeriousAxe(page);
});

test("without order.read there is no Online orders entry", async ({ page }) => {
  await open(page, "permissions=sale.create,customer.read");
  await expect(nav(page).getByRole("link", { name: "Online orders" })).toHaveCount(0);
});

test("offline, the entry says it needs a connection and does nothing", async ({ page }) => {
  await open(page, "permissions=sale.create,order.read&offline");
  await expect(
    nav(page).getByRole("button", { name: /Online orders \(needs connection\)/ }),
  ).toBeDisabled();
});
