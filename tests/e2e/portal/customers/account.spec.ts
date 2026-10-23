import { expect, test, type Page } from "@playwright/test";
import { unique } from "../../../support/admin";
import {
  customerMember,
  enableLoyalty,
  makeCustomer,
  openCustomer,
  settle,
  verify,
} from "../../../support/admin/customers";
import { dialog, signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/admin/shots";

const button = (page: Page, name: string) => page.getByRole("button", { name });
const card = (page: Page, label: string) => page.getByRole("group", { name: label });
const field = (page: Page, name: string) => dialog(page).getByLabel(name, { exact: true });

test.describe("as the owner of E2E Mart", () => {
  test("shows what is available and whether identity is verified", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    await settle(request, customer, { owed: 100 });
    await verify(request, customer, 500);
    await openCustomer(page, customer);
    await expect(card(page, "Credit limit")).toContainText("GH₵ 500.00");
    await expect(card(page, "Available")).toContainText("GH₵ 400.00");
    await expect(page.getByRole("main").getByText("KYC verified")).toBeVisible();
    await shoot(page, info, "customer-account", async () => {
      await expect(card(page, "Available")).toBeVisible();
    });
    const other = await makeCustomer(request);
    await openCustomer(page, other);
    await expect(card(page, "Available")).toContainText("GH₵ 0.00");
    await expect(page.getByRole("main").getByText("Not verified")).toBeVisible();
  });

  test("P records a cash payment with the keyboard and focus returns to the button", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    await settle(request, customer, { owed: 120.5 });
    await openCustomer(page, customer);
    await page.keyboard.press("p");
    await expect(dialog(page).getByRole("heading", { name: "Record a payment" })).toBeVisible();
    await expect(field(page, "Amount")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(field(page, "Amount")).toHaveAttribute("aria-invalid", "true");
    await expect(dialog(page)).toContainText("Enter an amount like 12.50");
    await shoot(page, info, "customer-payment-errors", async () => {
      await expect(dialog(page)).toContainText("Enter an amount like 12.50");
    });
    await field(page, "Amount").fill("20");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Payment recorded")).toBeVisible();
    await expect(card(page, "Owed")).toContainText("GH₵ 100.50");
    await expect(button(page, "Record payment")).toBeFocused();
  });

  test("a payment by mobile money that is more than they owe becomes a deposit", async ({
    page,
    request,
  }) => {
    const customer = await makeCustomer(request);
    await settle(request, customer, { owed: 10 });
    await openCustomer(page, customer);
    await button(page, "Record payment").click();
    await field(page, "Amount").fill("25.50");
    await dialog(page).getByRole("combobox", { name: "Paid by" }).click();
    await page.getByRole("option", { name: "Mobile money" }).click();
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(card(page, "Deposit")).toContainText("GH₵ 15.50");
  });

  test("C adds a credit note and needs a reason", async ({ page, request }, info) => {
    const customer = await makeCustomer(request);
    await settle(request, customer, { owed: 50 });
    await openCustomer(page, customer);
    await page.keyboard.press("c");
    await field(page, "Amount").fill("12.50");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(dialog(page)).toContainText("Give a reason");
    await expect(field(page, "Reason")).toBeFocused();
    await shoot(page, info, "customer-credit-note-errors", async () => {
      await expect(dialog(page)).toContainText("Give a reason");
    });
    await field(page, "Reason").fill("Damaged goods refunded to the account");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Credit note added")).toBeVisible();
    await expect(card(page, "Owed")).toContainText("GH₵ 37.50");
    await expect(button(page, "Credit note")).toBeFocused();
  });

  test("the limit is off with its reason until identity is verified, then L sets it", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    await openCustomer(page, customer);
    await expect(button(page, "Set limit")).toBeDisabled();
    await expect(page.getByText("A credit limit needs a customer whose identity")).toBeVisible();
    await page.keyboard.press("l");
    await expect(dialog(page)).toHaveCount(0);
    await shoot(page, info, "customer-limit-unverified", async () => {
      await expect(button(page, "Set limit")).toBeDisabled();
    });
    await verify(request, customer);
    await openCustomer(page, customer);
    await page.keyboard.press("l");
    await expect(dialog(page).getByRole("heading", { name: "Set the credit limit" })).toBeVisible();
    await field(page, "Credit limit").fill("750");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Credit limit saved")).toBeVisible();
    await expect(card(page, "Credit limit")).toContainText("GH₵ 750.00");
    await expect(card(page, "Available")).toContainText("GH₵ 750.00");
  });

  test("T finds the recipient by name and moves points, with the available count shown", async ({
    page,
    request,
  }, info) => {
    await enableLoyalty(request);
    const tag = unique();
    const giver = await makeCustomer(request, { name: `Giver ${tag}` });
    const getter = await makeCustomer(request, { name: `Getter ${tag}` });
    await settle(request, giver, { points: 120 });
    await openCustomer(page, giver);
    await page.keyboard.press("t");
    const search = dialog(page).getByRole("combobox", { name: "Find who receives the points" });
    await expect(search).toBeFocused();
    await page.keyboard.type(`Getter ${tag}`);
    await expect(dialog(page).getByRole("option", { name: new RegExp(getter.name) })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toContainText("120 available");
    await field(page, "Points").fill("500");
    await field(page, "Reason").fill("Family account");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(dialog(page)).toContainText("They only have 120 points");
    await shoot(page, info, "customer-transfer-errors", async () => {
      await expect(dialog(page)).toContainText("They only have 120 points");
    });
    await field(page, "Points").fill("20");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Points transferred")).toBeVisible();
    await expect(card(page, "Points")).toContainText("100");
    await expect(button(page, "Transfer points")).toBeFocused();
    await openCustomer(page, getter);
    await expect(card(page, "Points")).toContainText("20");
  });

  test("a transfer needs a recipient", async ({ page, request }) => {
    const customer = await makeCustomer(request);
    await settle(request, customer, { points: 10 });
    await openCustomer(page, customer);
    await button(page, "Transfer points").click();
    await field(page, "Points").fill("5");
    await field(page, "Reason").fill("Gift");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(dialog(page)).toContainText("Choose who gets the points");
  });

  test("when the server refuses, the dialog says why and stays open", async ({ page, request }) => {
    const customer = await makeCustomer(request);
    await openCustomer(page, customer);
    await page.route("**/api/customers/*/payments", (route) =>
      route.fulfill({
        status: 409,
        json: { error: "Payment identity already has different content" },
      }),
    );
    await page.keyboard.press("p");
    await field(page, "Amount").fill("5");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(dialog(page)).toContainText("Payment identity already has different content");
    await field(page, "Amount").fill("6");
    await expect(dialog(page)).not.toContainText("Payment identity");
  });

  test("offline, a dialog says so and can't save", async ({ page, request, context }, info) => {
    const customer = await makeCustomer(request);
    await openCustomer(page, customer);
    await page.keyboard.press("p");
    await context.setOffline(true);
    await expect(dialog(page)).toContainText("You're offline");
    await expect(dialog(page).getByRole("button", { name: /Record payment/ })).toBeDisabled();
    await shoot(page, info, "customer-payment-offline", async () => {
      await expect(dialog(page)).toContainText("You're offline");
    });
    await context.setOffline(false);
  });
});

test.describe("a cashier, who can edit customers but not manage their accounts", () => {
  test("sees the account but none of its actions", async ({ page, request }, info) => {
    const customer = await makeCustomer(request);
    await settle(request, customer, { owed: 30 });
    const cashier = await customerMember(request, "cashier");
    await page.context().clearCookies();
    await signInAs(page, cashier);
    await openCustomer(page, customer);
    await expect(card(page, "Owed")).toContainText("GH₵ 30.00");
    await expect(button(page, "Edit")).toBeVisible();
    for (const name of ["Record payment", "Credit note", "Set limit", "Transfer points"])
      await expect(button(page, name)).toHaveCount(0);
    await page.keyboard.press("p");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText("take payments");
    await shoot(page, info, "customer-account-nopermission", async () => {
      await expect(card(page, "Owed")).toBeVisible();
    });
  });
});
