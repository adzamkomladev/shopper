import { expect, test, type Request } from "@playwright/test";
import { createStaff, signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/customers/shots";
import { busyBilling } from "../../../support/payments/manage";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// The owner of E2E Mart is signed in. A read-only subscription is replayed; settings save through a replay too.
test.describe.configure({ timeout: 180_000 });

test("a read-only org sees the banner everywhere and pays the overdue invoice from billing", async ({
  page,
}, info) => {
  await replay(page, "/billing/status", { readOnly: true });
  await replay(page, "/billing", busyBilling);
  await page.goto("/products");
  const banner = page.getByRole("status").filter({ hasText: "back office is read-only" });
  await expect(banner).toBeVisible();
  await banner.getByRole("link", { name: "Go to billing" }).click();
  await expect(heading(page, "Billing")).toBeVisible();
  const invoices = page.getByRole("region", { name: "Invoices" });
  const overdue = invoices.getByRole("row").filter({ hasText: "INV-2026-10" });
  await expect(overdue).toContainText("Overdue");
  await expect(overdue.getByRole("link", { name: "Pay now" })).toHaveAttribute(
    "href",
    "https://checkout.paystack.com/inv-2026-10",
  );
  await expect(invoices.getByRole("row").filter({ hasText: "INV-2026-09" })).toContainText("Paid");
  await expect(page.getByRole("link", { name: "Pay now" })).toHaveAttribute(
    "aria-keyshortcuts",
    "P",
  );
  await shoot(page, info, "billing-read-only", { sizes: SIZES });
});

test("an org with no invoices yet says so", async ({ page }, info) => {
  await replay(page, "/billing", { subscription: null, invoices: [] });
  await page.goto("/products");
  // Billing is an account page: it sits in the user menu, not the bar.
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Billing" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "E2E Owner" }).click();
  await page.getByRole("menuitem", { name: "Billing" }).click();
  await expect(heading(page, "Billing")).toBeVisible();
  await expect(page.getByRole("main")).toContainText("No invoices yet");
  await shoot(page, info, "billing-empty", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});

test("the MoMo provider is chosen per org, and one without keys cannot be picked", async ({
  page,
}, info) => {
  const saved: Request[] = [];
  await page.route(
    (url) => url.pathname.endsWith("/api/settings/payments"),
    (route) => {
      if (route.request().method() === "PUT") saved.push(route.request());
      const provider = (route.request().postDataJSON() as { momoProvider?: string } | null)
        ?.momoProvider;
      return route.fulfill({
        json: { momoProvider: provider ?? "paystack", providers: { paystack: true, hubtel: true } },
      });
    },
  );
  await page.goto("/payments/settings");
  await expect(heading(page, "Payments")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Paystack" })).toBeChecked();
  await shoot(page, info, "payments-settings", { sizes: SIZES });
  await page.getByRole("radio", { name: "Hubtel" }).check();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByText("Payment settings saved")).toBeVisible();
  expect(saved.map((request) => request.postDataJSON())).toEqual([{ momoProvider: "hubtel" }]);

  await page.unrouteAll();
  await page.reload();
  await expect(page.getByRole("radio", { name: "Hubtel" })).toBeDisabled();
  await expect(page.getByRole("main")).toContainText("its API keys are missing");
});

test("a cashier has no billing or payment settings", async ({ page, request }) => {
  const cashier = await createStaff(request, "cashier", "Bill");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await expect(page.getByRole("link", { name: "Billing" })).toHaveCount(0);
  await page.goto("/billing");
  await expect(page.getByRole("main")).toContainText("You don't have permission to view billing");
  await page.goto("/payments/settings");
  await expect(page.getByRole("main")).toContainText(
    "You don't have permission to change payment settings",
  );
});
