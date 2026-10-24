import { expect, test, type Page } from "@playwright/test";
import {
  customerMember,
  makeCustomer,
  openCustomer,
  settle,
  type CustomerRow,
} from "../../../support/admin/customers";
import { signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/admin/shots";

const button = (page: Page, name: string) => page.getByRole("button", { name });
const table = (page: Page) => page.getByRole("region", { name: "Statement", exact: true });
const links = (page: Page) => page.getByRole("region", { name: "Active links" });
const sent = (page: Page) => page.getByRole("region", { name: "Sent statements" });
const row = (page: Page, name: RegExp) => table(page).getByRole("row", { name });

async function openStatement(page: Page, customer: Pick<CustomerRow, "id" | "name">) {
  await page.goto(`/customers/${customer.id}?tab=statement`);
  await expect(page.getByRole("heading", { name: customer.name, level: 1 })).toBeVisible();
}

/** An account with a sale on it and a part-payment, both dated now. */
async function withHistory(request: Parameters<typeof makeCustomer>[0], email?: string) {
  const customer = await makeCustomer(request, email ? { email } : {});
  await settle(request, customer, { owed: 200 });
  await settle(request, customer, { owed: -50 });
  return customer;
}

test.describe("as the owner of E2E Mart", () => {
  test("shows the opening balance, each entry with the balance after it, and the closing balance", async ({
    page,
    request,
  }, info) => {
    const customer = await withHistory(request, "ama@example.com");
    await openStatement(page, customer);
    await expect(row(page, /Opening balance/)).toContainText("GH₵ 0.00");
    await expect(row(page, /Sale on account/)).toContainText("GH₵ 200.00");
    await expect(row(page, /Payment/)).toContainText("Cash");
    await expect(row(page, /Payment/)).toContainText("GH₵ 150.00");
    await expect(row(page, /Closing balance/)).toContainText("GH₵ 150.00");
    await shoot(page, info, "customer-statement", async () => {
      await expect(table(page)).toBeVisible();
      return table(page);
    });
  });

  test("the tab opens from the keyboard and the dates narrow the statement", async ({
    page,
    request,
  }) => {
    const customer = await withHistory(request);
    await openCustomer(page, customer);
    await page.getByRole("tab", { name: "Statement" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/tab=statement/);
    await expect(table(page)).toContainText("Sale on account");
    await page.getByLabel("To", { exact: true }).fill("2020-01-31");
    await page.getByLabel("From", { exact: true }).fill("2020-01-01");
    await expect(table(page)).not.toContainText("Sale on account");
    await expect(row(page, /Closing balance/)).toContainText("GH₵ 0.00");
  });

  test("a period that ends before it starts is explained and nothing is sent", async ({
    page,
    request,
  }, info) => {
    const customer = await withHistory(request);
    await openStatement(page, customer);
    await page.getByLabel("From", { exact: true }).fill("2999-01-01");
    const explained = page.getByText("Pick a start on or before the end");
    await expect(explained).toBeVisible();
    await expect(table(page)).toHaveCount(0);
    for (const name of ["Send by SMS", "Download PDF", "Copy link"])
      await expect(button(page, name)).toBeDisabled();
    await shoot(page, info, "customer-statement-range", async () => {
      await expect(explained).toBeVisible();
      return explained;
    });
  });

  test("Send by SMS queues the statement and the delivery shows in the history", async ({
    page,
    request,
  }, info) => {
    const customer = await withHistory(request);
    await openStatement(page, customer);
    await expect(sent(page)).toContainText("Nothing has been sent yet");
    await button(page, "Send by SMS").click();
    await expect(page.getByText("Statement on its way by SMS")).toBeVisible();
    const delivery = sent(page).getByRole("listitem");
    await expect(delivery).toContainText(/SMS: .*(Queued|Sent|Failed)/);
    await shoot(page, info, "customer-statement-sent", async () => {
      await expect(delivery).toHaveCount(1);
      return sent(page);
    });
  });

  test("Send by email needs an email address and says so", async ({ page, request }) => {
    const bare = await withHistory(request);
    await openStatement(page, bare);
    await expect(button(page, "Send by email")).toBeDisabled();
    await expect(page.getByText("Add an email address to this customer")).toBeVisible();
    const emailed = await withHistory(request, "kofi@example.com");
    await openStatement(page, emailed);
    await button(page, "Send by email").click();
    await expect(page.getByText("Statement on its way by email")).toBeVisible();
    await expect(sent(page)).toContainText("Email:");
  });

  test("Copy link puts a working link on the clipboard, lists it, and Revoke ends it", async ({
    page,
    request,
    context,
  }, info) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const customer = await withHistory(request);
    await openStatement(page, customer);
    await expect(links(page)).toContainText("No links are open");
    await button(page, "Copy link").click();
    await expect(page.getByText(/Link copied/)).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toMatch(/\/statement\/[\w-]+\.[0-9a-f]+$/);
    const link = links(page).getByRole("listitem");
    await expect(link).toContainText("Not opened");
    await shoot(page, info, "customer-statement-links", async () => {
      await expect(link).toHaveCount(1);
      return links(page);
    });
    await links(page)
      .getByRole("button", { name: /^Revoke/ })
      .click();
    await expect(page.getByText("Link revoked")).toBeVisible();
    await expect(links(page)).toContainText("No links are open");
    const token = copied.replace(/^.*\/statement\//, "");
    expect((await page.request.get(`/api/public/statements/${token}`)).status()).toBe(404);
  });

  test("Download PDF makes a link and saves the statement behind it", async ({ page, request }) => {
    const customer = await withHistory(request);
    // The portal's test server has no PDF renderer (its wasm files load from node_modules): the PDF
    // itself is checked in tests/integration/customers/statements/links.test.ts.
    await page.route("**/api/public/statements/*/pdf", (route) =>
      route.fulfill({ contentType: "application/pdf", body: "%PDF-1.4" }),
    );
    await openStatement(page, customer);
    const download = page.waitForEvent("download");
    await button(page, "Download PDF").click();
    expect((await download).suggestedFilename()).toBe("statement.pdf");
    await expect(links(page).getByRole("listitem")).toHaveCount(1);
  });

  test("when the statement can't be read, the page says so and Try again recovers", async ({
    page,
    request,
  }, info) => {
    const customer = await withHistory(request);
    let down = true;
    await page.route("**/api/customers/*/statement?*", (route) =>
      down ? route.abort("failed") : route.fallback(),
    );
    await openStatement(page, customer);
    const failed = page.getByText("Couldn't load the statement");
    await expect(failed).toBeVisible();
    await shoot(page, info, "customer-statement-error", async () => {
      await expect(failed).toBeVisible();
      return failed;
    });
    down = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(table(page)).toContainText("Sale on account");
  });

  test("a slow statement shows a skeleton the shape of the table", async ({
    page,
    request,
  }, info) => {
    const customer = await withHistory(request);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/customers/*/statement?*", async (route) => {
      await gate;
      return route.fallback();
    });
    await openStatement(page, customer);
    const loading = page.getByRole("status", { name: "Loading the statement" });
    try {
      await shoot(page, info, "customer-statement-loading", async () => {
        await expect(loading).toBeVisible();
        return loading;
      });
    } finally {
      release();
    }
    await expect(table(page)).toContainText("Sale on account");
  });

  test("offline, sharing is off and the statement stays", async ({
    page,
    request,
    context,
  }, info) => {
    const customer = await withHistory(request, "esi@example.com");
    await openStatement(page, customer);
    await context.setOffline(true);
    for (const name of ["Send by SMS", "Send by email", "Download PDF", "Copy link"])
      await expect(button(page, name)).toBeDisabled();
    await expect(table(page)).toBeVisible();
    await shoot(page, info, "customer-statement-offline", async () => {
      await expect(button(page, "Copy link")).toBeDisabled();
    });
    await context.setOffline(false);
  });
});

test.describe("a cashier, who can read customers but not manage their accounts", () => {
  test("reads the statement and its links but cannot send, copy or revoke", async ({
    page,
    request,
  }, info) => {
    const customer = await withHistory(request);
    await openStatement(page, customer);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await button(page, "Copy link").click();
    await expect(links(page).getByRole("listitem")).toHaveCount(1);
    const cashier = await customerMember(request, "cashier");
    await page.context().clearCookies();
    await signInAs(page, cashier);
    await openStatement(page, customer);
    await expect(table(page)).toContainText("Sale on account");
    await expect(links(page).getByRole("listitem")).toHaveCount(1);
    await expect(links(page).getByRole("button")).toHaveCount(0);
    await expect(button(page, "Send by SMS")).toHaveCount(0);
    await shoot(page, info, "customer-statement-nopermission", async () => {
      await expect(table(page)).toBeVisible();
      return table(page);
    });
  });
});
