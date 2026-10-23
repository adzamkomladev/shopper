import { expect, test, type Page } from "@playwright/test";
import { v7 } from "uuid";
import { captureSizes, unique } from "../../../support/admin";
import {
  customerMember,
  makeCustomer,
  openCustomer,
  openCustomers,
  settle,
} from "../../../support/admin/customers";
import { dialog, signInAs } from "../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../support/e2e";

const button = (page: Page, name: string) => page.getByRole("button", { name });
const card = (page: Page, label: string) => page.getByRole("group", { name: label });

test.describe("as the owner of E2E Mart", () => {
  test("shows what they owe, their limit and points, and their identity", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request, {
      name: `Kojo Appiah ${unique()}`,
      kind: "business",
      businessName: "Appiah Chop Bar",
      tin: "C0012345678",
      email: "kojo@appiah.example",
    });
    await settle(request, customer, { owed: 120.5, points: 340 });
    await openCustomer(page, customer);
    await expect(card(page, "Owed")).toContainText("GH₵ 120.50");
    await expect(card(page, "Credit limit")).toContainText("No credit");
    await expect(card(page, "Points")).toContainText("340");
    await expect(page.getByRole("main")).toContainText("Appiah Chop Bar");
    await expect(page.getByRole("main")).toContainText("C0012345678");
    await expect(page.getByRole("main")).toContainText("kojo@appiah.example");
    await expect(page.getByRole("main")).toContainText(customer.phone);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customer-detail", async () => {
      await expect(card(page, "Owed")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("a deposit is shown as money held for them, not as a debt", async ({ page, request }) => {
    const customer = await makeCustomer(request);
    await settle(request, customer, { owed: -45 });
    await openCustomer(page, customer);
    await expect(card(page, "Deposit")).toContainText("GH₵ 45.00");
    await expect(card(page, "Owed")).toHaveCount(0);
  });

  test("E edits with the keyboard, and focus returns to Edit", async ({ page, request }, info) => {
    const customer = await makeCustomer(request, { email: "old@example.com" });
    await openCustomer(page, customer);
    await page.keyboard.press("e");
    await expect(dialog(page).getByLabel("Name", { exact: true })).toHaveValue(customer.name);
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
    await captureSizes(page, info, "customer-edit", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    const renamed = `Ama Serwaa ${unique()}`;
    await dialog(page).getByLabel("Name", { exact: true }).fill(renamed);
    await dialog(page).getByLabel("Email").fill("");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Customer saved")).toBeVisible();
    await expect(page.getByRole("heading", { name: renamed, level: 1 })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("old@example.com");
    await expect(button(page, "Edit")).toBeFocused();
  });

  test("Alt+A archives a settled customer and brings them back", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    await openCustomer(page, customer);
    await page.keyboard.press("Alt+A");
    await expect(
      dialog(page).getByRole("heading", { name: `Archive ${customer.name}?` }),
    ).toBeVisible();
    await captureSizes(page, info, "customer-archive", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Customer archived")).toBeVisible();
    await expect(page.getByRole("main").getByText("Archived", { exact: true })).toBeVisible();
    await expect(button(page, "Restore")).toBeFocused();
    await page.keyboard.press("Alt+A");
    await expect(page.getByText("Customer restored")).toBeVisible();
    await expect(button(page, "Archive")).toBeVisible();
    await expect(page.getByRole("main").getByText("Archived", { exact: true })).toHaveCount(0);
  });

  test("archiving is refused while they owe or hold points, and says why in the dialog", async ({
    page,
    request,
  }, info) => {
    const owing = await makeCustomer(request);
    await settle(request, owing, { owed: 10 });
    await openCustomer(page, owing);
    await button(page, "Archive").click();
    await dialog(page)
      .getByRole("button", { name: /^Archive/ })
      .click();
    await expect(dialog(page)).toContainText("The customer's account is not settled");
    await captureSizes(page, info, "customer-archive-refused", async () => {
      await expect(dialog(page)).toContainText("not settled");
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("Escape");
    await expect(button(page, "Archive")).toBeFocused();
    const holding = await makeCustomer(request);
    await settle(request, holding, { points: 50 });
    await openCustomer(page, holding);
    await page.keyboard.press("Alt+A");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(dialog(page)).toContainText("The customer still holds points");
  });

  test("a customer that does not exist says so", async ({ page }) => {
    await page.goto(`/customers/${v7()}`);
    await expect(page.getByRole("heading", { name: "Not found", level: 1 })).toBeVisible();
  });

  test("when the server can't be reached the page says so and Try again recovers", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    let failures = 1;
    await page.route(`**/api/customers/${customer.id}`, (route) =>
      failures-- > 0 ? route.abort("failed") : route.fallback(),
    );
    await page.goto(`/customers/${customer.id}`);
    await expect(page.getByText("Can't reach the server")).toBeVisible();
    await captureSizes(page, info, "customer-unavailable", async () => {
      await expect(page.getByText("Can't reach the server")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { name: customer.name, level: 1 })).toBeVisible();
  });

  test("a slow page shows a skeleton shaped like the page", async ({ page, request }, info) => {
    const customer = await makeCustomer(request);
    await openCustomers(page, `?q=${customer.name}`);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`**/api/customers/${customer.id}`, async (route) => {
      await gate;
      return route.fallback();
    });
    await page.getByRole("link", { name: customer.name }).click();
    try {
      const loading = page.getByRole("main").getByRole("status", { name: "Loading customer" });
      await expect(loading).toBeVisible();
      await captureSizes(page, info, "customer-loading", async () => {
        await expect(loading).toBeVisible();
        await expectNoSeriousAxe(page);
      });
    } finally {
      release();
    }
    await expect(page.getByRole("heading", { name: customer.name, level: 1 })).toBeVisible();
  });

  test("offline, the page stays and saving says it needs a connection", async ({
    page,
    request,
    context,
  }, info) => {
    const customer = await makeCustomer(request);
    await openCustomer(page, customer);
    await context.setOffline(true);
    const note = page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /offline/i });
    await expect(note).toBeVisible();
    await page.keyboard.press("e");
    await expect(dialog(page).getByRole("button", { name: /Save customer/ })).toBeDisabled();
    await expect(dialog(page)).toContainText("You're offline");
    await page.keyboard.press("Escape");
    await captureSizes(page, info, "customer-offline", async () => {
      await expect(note).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await context.setOffline(false);
  });
});

test.describe("members of E2E Mart without the owner role", () => {
  test("an accountant can archive but not edit; a cashier can edit but not archive or merge", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request);
    const accountant = await customerMember(request, "accountant");
    const cashier = await customerMember(request, "cashier");
    await page.context().clearCookies();
    await signInAs(page, accountant);
    await openCustomer(page, customer);
    await expect(button(page, "Edit")).toHaveCount(0);
    await expect(button(page, "Archive")).toBeVisible();
    await expect(button(page, "Merge")).toBeVisible();
    await expect(page.getByRole("note")).toContainText("edit");
    await page.keyboard.press("e");
    await expect(dialog(page)).toHaveCount(0);
    await captureSizes(page, info, "customer-accountant", async () => {
      await expect(button(page, "Archive")).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.context().clearCookies();
    await signInAs(page, cashier);
    await openCustomer(page, customer);
    await expect(button(page, "Edit")).toBeVisible();
    await expect(button(page, "Archive")).toHaveCount(0);
    await expect(button(page, "Merge")).toHaveCount(0);
    await expect(page.getByRole("note")).toContainText("archive or merge");
    await page.keyboard.press("Alt+A");
    await expect(dialog(page)).toHaveCount(0);
  });
});
