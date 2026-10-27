import { expect, test, type Page } from "@playwright/test";
import { unique } from "../../../support/admin";
import { createStaff, signInAs } from "../../../support/admin/people";
import { shoot } from "../../../support/customers/shots";
import { expectNoSeriousAxe } from "../../../support/e2e";
import { busySale, busyTransactions } from "../../../support/payments/busy";

// The owner of E2E Mart is signed in. Busy answers are replayed to draw the explorer and a drill-down full; the
// real API answers the quiet and missing states.
const SIZES = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
] as const;
const kept = (name: string) => `transactions-${name}`;
const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { name, level: 1 });
test.describe.configure({ timeout: 180_000 });

const replayList = (page: Page, seen: URL[] = []) =>
  page.route(
    (url) => url.pathname.endsWith("/api/transactions"),
    (route) => {
      seen.push(new URL(route.request().url()));
      return route.fulfill({ json: busyTransactions });
    },
  );
const replaySale = (page: Page) =>
  page.route(
    (url) => url.pathname.endsWith(`/api/transactions/${busySale.id}`),
    (route) => route.fulfill({ json: busySale }),
  );

test("a busy day lists sales and the unused MoMo payment with counts on each status tab", async ({
  page,
}, info) => {
  await replayList(page);
  await page.goto("/transactions?from=2026-10-27&to=2026-10-27");
  await expect(heading(page, "Transactions")).toBeVisible();
  const table = page.getByRole("region", { name: "Transactions" });
  await expect(table.getByRole("row")).toHaveCount(1 + 8);
  await expect(page.getByRole("tab", { name: /All\s*8/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /Pending MoMo\s*1/ })).toBeVisible();
  const refunded = table.getByRole("row").filter({ hasText: "OSU1-T01-000480" });
  await expect(refunded).toContainText("Refunded");
  await expect(table.getByRole("row").filter({ hasText: "MoMo payment" })).toContainText(
    "Pending MoMo",
  );
  await expect(table.getByRole("row").filter({ hasText: "OSU1-T01-000478" })).toContainText(
    "Cash + MoMo",
  );
  await shoot(page, info, kept("busy"), { sizes: SIZES });
});

test("the keyboard searches with /, steps the day with ] and narrows by status", async ({
  page,
}) => {
  const seen: URL[] = [];
  await replayList(page, seen);
  await page.goto("/transactions?from=2026-10-27&to=2026-10-27");
  await expect(heading(page, "Transactions")).toBeFocused();
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("0244123456");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=0244123456/);
  await expect.poll(() => seen.at(-1)?.searchParams.get("q")).toBe("0244123456");
  await heading(page, "Transactions").click();
  await page.keyboard.press("]");
  await expect(page).toHaveURL(/from=2026-10-28&to=2026-10-28/);
  await page.getByRole("tab", { name: /Refunded/ }).click();
  await expect.poll(() => seen.at(-1)?.searchParams.get("status")).toBe("refunded");
});

test("a receipt opens its drill-down with lines, payment, refund, fiscal document and audit trail", async ({
  page,
}, info) => {
  await replayList(page);
  await replaySale(page);
  await page.goto("/transactions?from=2026-10-27&to=2026-10-27");
  await page.getByRole("link", { name: "OSU1-T01-000481" }).focus();
  await page.keyboard.press("Enter");
  await expect(heading(page, "Receipt OSU1-T01-000481")).toBeFocused();
  const main = page.getByRole("main");
  await expect(main.getByRole("table", { name: "Items purchased" }).getByRole("row")).toHaveCount(
    1 + 4 + 1,
  );
  await expect(main).toContainText("T873149206");
  await expect(main).toContainText("Credit note OSU1-T01-CN-000012");
  await expect(main).toContainText("MoMo refund processed");
  await expect(main).toContainText("GRA-SDC-2026-0004810");
  await expect(main).toContainText("Refund accept");
  await expect(main).toContainText("GH₵ 48.72");
  await shoot(page, info, kept("detail"), { sizes: SIZES });
  await page.keyboard.press("Backspace");
  await expect(heading(page, "Transactions")).toBeVisible();
});

test("M emails the receipt to the customer once per send", async ({ page }) => {
  await replaySale(page);
  const bodies: unknown[] = [];
  await page.route(
    (url) => url.pathname.endsWith(`/api/transactions/${busySale.id}/receipt/email`),
    (route) => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({
        status: 202,
        json: { saleId: busySale.id, email: "ama@example.com", queued: true },
      });
    },
  );
  await page.goto(`/transactions/${busySale.id}`);
  await expect(heading(page, "Receipt OSU1-T01-000481")).toBeFocused();
  await page.keyboard.press("m");
  const dialog = page.getByRole("dialog", { name: "Email the receipt" });
  await expect(dialog).toContainText("Ama Mensah's email");
  await expect(dialog.getByLabel("Email address")).toBeFocused();
  // Backspace edits the address here; it does not leave the receipt.
  await page.keyboard.type("x");
  await page.keyboard.press("Backspace");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/transactions/${busySale.id}`));
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Receipt sent to ama@example.com")).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Email receipt" })).toBeFocused();
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toMatchObject({ requestKey: expect.stringMatching(/^[0-9a-f-]{36}$/) });
});

test("a quiet range says so, and a filtered one offers to clear its filters", async ({
  page,
}, info) => {
  await page.goto("/transactions?from=2020-01-01&to=2020-01-01");
  await expect(page.getByText("No transactions on these days")).toBeVisible({ timeout: 20_000 });
  await shoot(page, info, kept("empty"), { sizes: SIZES });
  await page.goto("/transactions?from=2020-01-01&to=2020-01-01&q=nothing-here");
  await expect(page.getByText("Nothing matches this search")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).not.toHaveURL(/q=/);
});

test("a sale that does not exist says so and offers the way back", async ({ page }, info) => {
  await page.goto("/transactions/019a0000-0000-7000-8000-0000000000aa");
  await expect(heading(page, "Transaction not found")).toBeVisible();
  await shoot(page, info, kept("not-found"), { sizes: SIZES });
  await page.getByRole("link", { name: "Back to transactions" }).first().click();
  await expect(heading(page, "Transactions")).toBeVisible();
});

test("without report.read there is no link and the page is the no-permission state", async ({
  page,
  request,
}, info) => {
  const clerk = await createStaff(request, "inventory", `Stock${unique()}`);
  await page.context().clearCookies();
  await signInAs(page, clerk);
  await expect(page.getByRole("link", { name: "Transactions" })).toHaveCount(0);
  await page.goto("/transactions");
  await expect(page.getByRole("main")).toContainText(
    "You don't have permission to view transactions",
  );
  await shoot(page, info, kept("no-permission"), { sizes: SIZES });
});
