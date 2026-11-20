import { expect, test, type ConsoleMessage } from "@playwright/test";
import { makeCustomer, openCustomer } from "../../../support/admin/customers";
import { shoot } from "../../../support/customers/shots";
import { SIZES, replay } from "../../../support/payments/screens";
import { expectNoSeriousAxe } from "../../../support/e2e";

// v1.5 Day 51: on a box selling online, staff record that a customer agreed to see their receipts and points in the
// online store. The box answer of `/settings/online` is replayed (the e2e server is not a box); the switch itself is
// saved by the real API.
test.describe.configure({ timeout: 180_000 });

const box = { box: true, onlineOrders: true, buffer: 0, publishedAt: null, error: null };
const toggle = (page: import("@playwright/test").Page) =>
  page.getByRole("switch", { name: "Show receipts and points online" });

test("staff switch a customer's online receipts and points from the keyboard, and it stays", async ({
  page,
  request,
}, info) => {
  const errors: ConsoleMessage[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message));
  const customer = await makeCustomer(request);
  await replay(page, "/settings/online", box);
  await openCustomer(page, customer);
  await expect(toggle(page)).not.toBeChecked();
  await expect(page.getByText("Their receipts and points stay on this box.")).toBeVisible();

  await toggle(page).focus();
  await page.keyboard.press("Space");
  await expect(page.getByText(`${customer.name} can see receipts and points online`)).toBeVisible();
  await expect(toggle(page)).toBeChecked();
  await expect(
    page.getByText("Their receipts and points show in your online store's account page."),
  ).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, info, "customer-online-on", { sizes: SIZES });

  await page.reload();
  await expect(toggle(page)).toBeChecked();
  await toggle(page).focus();
  await page.keyboard.press("Space");
  await expect(toggle(page)).not.toBeChecked();
  expect(errors.map((message) => message.text())).toEqual([]);
});

test("a shop that does not sell online from a box has no such switch", async ({
  page,
  request,
}) => {
  const customer = await makeCustomer(request);
  await openCustomer(page, customer);
  await expect(page.getByRole("main")).toContainText(customer.phone);
  await expect(toggle(page)).toHaveCount(0);
});
