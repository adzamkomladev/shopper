import { expect, test, type Page } from "@playwright/test";
import { asOwner } from "../../../support/admin/stock";
import {
  charge,
  customer,
  payment,
  revokeStatementLink,
  statementLink,
} from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { MART, expectNoSeriousAxe } from "../../../support/e2e";

// A customer opens the link they were sent: no sign-in, no navigation, phone first. The customer owes
// GH₵ 120.00 from before the period, is charged GH₵ 80.00 in it and pays GH₵ 50.00, so closes at GH₵ 150.00.
// The page runs signed out; the seeding is done as the shop's owner.
test.use({ storageState: { cookies: [], origins: [] } });

const heading = (page: Page, name: string, level = 1) => page.getByRole("heading", { name, level });
const BOTH_SIZES = [
  [1366, 768],
  [390, 844],
] as const;

const openStatement = () =>
  asOwner(async (request) => {
    const made = await customer(request, { name: `Esi ${Date.now().toString(36)}` });
    await charge(request, made.id, 1_200_000, 45);
    await charge(request, made.id, 800_000, 10);
    await payment(request, made.id, 500_000, 5);
    return { made, link: await statementLink(request, made.id) };
  });

test("shows the shop, the customer, both balances and the entries, with no navigation", async ({
  page,
}, info) => {
  const { made, link } = await openStatement();
  await page.goto(`/statement/${link.token}`);
  await expect(heading(page, MART.name)).toBeVisible();
  await expect(page.getByText(made.name)).toBeVisible();
  await expect(page.locator(`time[datetime="${link.from}"]`)).toBeVisible();
  await expect(page.locator(`time[datetime="${link.to}"]`)).toBeVisible();
  await expect(page.getByTestId("opening")).toContainText("GH₵ 120.00");
  await expect(page.getByTestId("closing")).toContainText("GH₵ 150.00");
  const entries = page.getByRole("table", { name: "Entries" });
  await expect(entries.getByRole("row")).toHaveCount(3);
  await expect(entries.getByRole("row", { name: /Purchase on account/ })).toContainText(
    "GH₵ 80.00",
  );
  await expect(entries.getByRole("row", { name: /Payment/ })).toContainText("GH₵ 50.00");
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByRole("link")).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await shoot(page, info, "statement-public", { sizes: BOTH_SIZES });

  const download = page.waitForEvent("download");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Download PDF" })).toBeFocused();
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toBe(`statement-${link.from}-${link.to}.pdf`);
});

test("a revoked link says it doesn't work and gives away nothing about the customer", async ({
  page,
}, info) => {
  const { made, link } = await openStatement();
  await asOwner((request) => revokeStatementLink(request, made.id, link.id));
  await page.goto(`/statement/${link.token}`);
  await expect(heading(page, "This statement link doesn't work")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText(made.name);
  await expect(page.getByRole("main")).not.toContainText(MART.name);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await shoot(page, info, "statement-public-not-found", { sizes: BOTH_SIZES });
});

test("a made-up link says it doesn't work", async ({ page }) => {
  await page.goto("/statement/not-a-real-token");
  await expect(heading(page, "This statement link doesn't work")).toBeVisible();
  await expectNoSeriousAxe(page);
});

test("when the server can't be reached the page says so and Try again recovers", async ({
  page,
}) => {
  const { link } = await openStatement();
  let failures = 1;
  await page.route("**/api/public/statements/*", (route) =>
    failures-- > 0 ? route.abort("failed") : route.fallback(),
  );
  await page.goto(`/statement/${link.token}`);
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(heading(page, MART.name)).toBeVisible();
});

test("a PDF that can't be made says so and keeps the page", async ({ page }) => {
  const { link } = await openStatement();
  await page.route("**/api/public/statements/*/pdf", (route) => route.fulfill({ status: 503 }));
  await page.goto(`/statement/${link.token}`);
  await page.getByRole("button", { name: "Download PDF" }).click();
  await expect(page.getByText("The PDF couldn't be made. Try again in a moment.")).toBeVisible();
  await expect(heading(page, MART.name)).toBeVisible();
});
