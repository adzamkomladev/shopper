import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { captureSizes, post, unique } from "../../../support/admin";
import {
  customersTable,
  makeCustomer,
  openCustomers,
  segment,
  settle,
} from "../../../support/admin/customers";
import { dialog, row } from "../../../support/admin/people";
import { expectNoSeriousAxe } from "../../../support/e2e";

const search = (page: Page) => page.getByRole("textbox", { name: "Search customers" });

test.describe("as the owner of E2E Mart", () => {
  test("lists customers newest first with phone, type, what they owe and points", async ({
    page,
    request,
  }, info) => {
    const customer = await makeCustomer(request, { name: `Efua Owusu ${unique()}` });
    const business = await makeCustomer(request, {
      name: `Yaw Boateng ${unique()}`,
      kind: "business",
      businessName: "Boateng Provisions",
    });
    await settle(request, customer, { owed: 120.5, points: 340 });
    await openCustomers(page);
    await expect(page.getByRole("tab", { name: "Customers", selected: true })).toBeVisible();
    const first = row(page, customer.name);
    await expect(first).toContainText(customer.phone);
    await expect(first).toContainText("GH₵ 120.50");
    await expect(first).toContainText("340");
    await expect(first.getByText("EO", { exact: true })).toBeVisible();
    await expect(row(page, business.name)).toContainText("Business");
    await expect(row(page, business.name)).toContainText("Boateng Provisions");
    // Newest first: the business was made last.
    await expect(customersTable(page).getByRole("row").nth(1)).toContainText(business.name);
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customers-list", async () => {
      await expect(first).toBeVisible();
      await expectNoSeriousAxe(page);
    });
  });

  test("/ jumps to the search, typing narrows the list and Escape clears it", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const ama = await makeCustomer(request, { name: `Zuri ${tag} Amoah` });
    const kofi = await makeCustomer(request, { name: `Zuri ${tag} Kofi` });
    await openCustomers(page);
    await page.getByRole("heading", { name: "Customers", level: 1 }).click();
    await page.keyboard.press("/");
    await expect(search(page)).toBeFocused();
    await page.keyboard.type(`Zuri ${tag} Amoah`);
    await expect(page).toHaveURL(/q=/);
    await expect(row(page, ama.name)).toBeVisible();
    await expect(row(page, kofi.name)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(search(page)).toHaveValue("");
    await expect(row(page, kofi.name)).toBeVisible();
    // A phone number finds them too.
    await search(page).fill(kofi.phone);
    await expect(row(page, kofi.name)).toBeVisible();
    await expect(row(page, ama.name)).toHaveCount(0);
    await search(page).fill(`Nobody ${tag}`);
    await expect(page.getByRole("heading", { name: "No customers match", level: 2 })).toBeVisible();
    await expectNoSeriousAxe(page);
    await captureSizes(page, info, "customers-nomatch", async () => {
      await expect(page.getByRole("heading", { name: "No customers match" })).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(search(page)).toBeFocused();
    await expect(search(page)).toHaveValue("");
  });

  test("segments show business customers and archived ones, and keep focus on the segment", async ({
    page,
    request,
  }, info) => {
    const tag = unique();
    const business = await makeCustomer(request, {
      name: `Seg ${tag} Trader`,
      kind: "business",
      businessName: `Seg ${tag} Ltd`,
    });
    const person = await makeCustomer(request, { name: `Seg ${tag} Person` });
    const gone = await makeCustomer(request, { name: `Seg ${tag} Gone` });
    await post(request, `/customers/${gone.id}/archive`, {});
    await openCustomers(page, `?q=Seg ${tag}`);
    await expect(row(page, person.name)).toBeVisible();
    await segment(page, "Business").focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/segment=business/);
    await expect(segment(page, "Business")).toBeFocused();
    await expect(row(page, business.name)).toBeVisible();
    await expect(row(page, person.name)).toHaveCount(0);
    await segment(page, "Archived").focus();
    await page.keyboard.press("Enter");
    await expect(row(page, gone.name)).toBeVisible();
    await expect(row(page, person.name)).toHaveCount(0);
    await expect(row(page, gone.name)).toContainText("Archived");
    await captureSizes(page, info, "customers-archived", async () => {
      await expect(row(page, gone.name)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await segment(page, "All").click();
    await expect(row(page, person.name)).toBeVisible();
  });

  test("N adds a customer with the keyboard, and focus returns to Add customer", async ({
    page,
  }, info) => {
    await openCustomers(page);
    const name = `Akosua Darko ${unique()}`;
    await page.getByRole("heading", { name: "Customers", level: 1 }).click();
    await page.keyboard.press("n");
    await expect(dialog(page).getByLabel("Name", { exact: true })).toBeFocused();
    await page.keyboard.type(name);
    await page.keyboard.press("Tab");
    await page.keyboard.type("024 555 0199");
    await captureSizes(page, info, "customers-form", async () => {
      await expect(dialog(page)).toBeVisible();
      await expectNoSeriousAxe(page);
    });
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Customer added")).toBeVisible();
    await expect(dialog(page)).toBeHidden();
    await expect(row(page, name)).toContainText("0245550199");
    await expect(page.getByRole("button", { name: "Add customer" })).toBeFocused();
  });

  test("a business needs its name, and a blank name or a bad phone is refused on the field", async ({
    page,
  }) => {
    await openCustomers(page);
    await page.getByRole("button", { name: "Add customer" }).click();
    await dialog(page).getByRole("button", { name: "Save customer" }).click();
    const name = dialog(page).getByLabel("Name", { exact: true });
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toBeFocused();
    await name.fill(`Kwesi Trading ${unique()}`);
    await dialog(page).getByLabel("Phone").fill("12345");
    await dialog(page).getByRole("button", { name: "Save customer" }).click();
    await expect(dialog(page).getByLabel("Phone")).toHaveAttribute("aria-invalid", "true");
    await dialog(page).getByLabel("Phone").fill("0245550123");
    await dialog(page).getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "Business" }).click();
    await dialog(page).getByRole("button", { name: "Save customer" }).click();
    const business = dialog(page).getByLabel("Business name");
    await expect(business).toHaveAttribute("aria-invalid", "true");
    await expect(business).toBeFocused();
    await dialog(page).getByLabel("TIN").fill("bad");
    await business.fill("Kwesi Trading Ltd");
    await dialog(page).getByRole("button", { name: "Save customer" }).click();
    await expect(dialog(page).getByLabel("TIN")).toHaveAttribute("aria-invalid", "true");
    await dialog(page).getByLabel("TIN").fill("c0012345678");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(page.getByText("Customer added")).toBeVisible();
  });

  test("D downloads the customers as a CSV and says so when it can't", async ({
    page,
    request,
  }) => {
    const customer = await makeCustomer(request, { name: `Csv ${unique()} Mensah` });
    await openCustomers(page);
    await page.getByRole("heading", { name: "Customers", level: 1 }).click();
    const download = page.waitForEvent("download");
    await page.keyboard.press("d");
    const file = await download;
    expect(file.suggestedFilename()).toBe("customers.csv");
    const path = await file.path();
    expect(await readFile(path, "utf8")).toContain(customer.name);
    await page.route("**/api/customers/export.csv", (route) => route.fulfill({ status: 500 }));
    await page.getByRole("button", { name: "Download CSV" }).click();
    await expect(page.getByText("The customers couldn't be exported. Try again.")).toBeVisible();
  });

  test("a row opens the customer's page", async ({ page, request }) => {
    const customer = await makeCustomer(request, { name: `Open ${unique()} Addo` });
    await openCustomers(page);
    await page.getByRole("link", { name: customer.name }).click();
    await expect(page).toHaveURL(new RegExp(`/customers/${customer.id}`));
    await expect(page.getByRole("heading", { name: customer.name, level: 1 })).toBeVisible();
  });
});
