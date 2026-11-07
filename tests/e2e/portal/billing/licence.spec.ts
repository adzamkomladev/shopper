import { expect, test, type Request } from "@playwright/test";
import { shoot } from "../../../support/customers/shots";
import { SIZES, heading, replay } from "../../../support/payments/screens";

// On a box the Billing page is the licence. Its states are replayed; the owner of E2E Mart is signed in.
test.describe.configure({ timeout: 180_000 });

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();
const request = "eyJtYWNoaW5lIjoiYWJjZGVmIiwia2V5IjoiQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVoifQ";
const terms = {
  id: "019a5e2c-7d1b-7c3e-9f2a-8b4d6e1f0a37",
  site: "E2E Mart, Osu",
  terminals: 5,
  maintenanceUntil: "2027-11-01",
};
const billing = (licence: object) => ({ subscription: null, invoices: [], licence });

test("an expired licence locks the back office; Check in now reopens it", async ({
  page,
}, info) => {
  await replay(page, "/billing/status", {
    readOnly: false,
    licence: { state: "locked", reason: "expired", locksAt: at(-1) },
  });
  await replay(
    page,
    "/billing",
    billing({
      state: "locked",
      reason: "expired",
      locksAt: at(-1),
      checkedInAt: at(-61),
      licence: terms,
      request,
    }),
  );
  const checks: Request[] = [];
  await replay(
    page,
    "/licence/checks",
    { state: "valid", locksAt: at(60), checkedInAt: at(0), licence: terms, request },
    checks,
  );
  await page.goto("/products");
  const banner = page.getByRole("status").filter({ hasText: "60 days" });
  await expect(banner).toContainText("Tills keep selling.");
  await banner.getByRole("link", { name: "See the licence" }).click();
  await expect(heading(page, "Billing")).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("E2E Mart, Osu");
  await expect(main).toContainText("Read-only");
  await expect(main).toContainText("1 Nov 2027");
  // No subscription card or invoices on a box.
  await expect(main).not.toContainText("No invoices yet");
  await shoot(page, info, "licence-locked", { sizes: SIZES });

  // C checks in from the keyboard.
  await page.locator("main").focus();
  await page.keyboard.press("c");
  await expect(page.getByText(/^Checked in\. Next check-in due by/)).toBeVisible();
  expect(checks).toHaveLength(1);
});

test("in the last 30 days every page warns, and the licence says when it locks", async ({
  page,
}, info) => {
  await replay(page, "/billing/status", {
    readOnly: false,
    licence: { state: "grace", locksAt: at(12) },
  });
  await replay(
    page,
    "/billing",
    billing({ state: "grace", locksAt: at(12), checkedInAt: at(-48), licence: terms, request }),
  );
  await page.goto("/products");
  const banner = page.getByRole("status").filter({ hasText: "Check the licence in by" });
  await expect(banner).toBeVisible();
  await banner.getByRole("link", { name: "Check in" }).click();
  await expect(page.getByRole("main")).toContainText("Check in soon");
  await expect(page.getByRole("button", { name: "Check in now" })).toHaveAttribute(
    "aria-keyshortcuts",
    "C",
  );
  await shoot(page, info, "licence-grace", { sizes: SIZES });
});

test("an unlicensed box shows the request code to send to Shopper", async ({ page }, info) => {
  await replay(page, "/billing/status", {
    readOnly: false,
    licence: { state: "locked", reason: "missing" },
  });
  await replay(page, "/billing", billing({ state: "locked", reason: "missing", request }));
  await page.goto("/billing");
  await expect(heading(page, "Billing")).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("This box has no licence yet");
  await expect(main.getByLabel("Request code", { exact: true })).toHaveText(request);
  await expect(page.getByRole("button", { name: "Check in now" })).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "no valid licence" })).toBeVisible();
  await shoot(page, info, "licence-missing", { sizes: SIZES });
});

test("a valid licence shows its terms and no banner", async ({ page }, info) => {
  await replay(page, "/billing/status", {
    readOnly: false,
    licence: { state: "valid", locksAt: at(55) },
  });
  await replay(
    page,
    "/billing",
    billing({ state: "valid", locksAt: at(55), checkedInAt: at(-5), licence: terms, request }),
  );
  await page.goto("/billing");
  await expect(page.getByRole("main")).toContainText("Perpetual licence");
  await expect(page.getByRole("status").filter({ hasText: "licence" })).toHaveCount(0);
  await shoot(page, info, "licence-valid", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
});
