// On account (Alt+5) and Points (Alt+6) on the tender step, against the harness: what is available, the inline refusals and F5.
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openCheckout, openSale } from "../sale/harness";
import { expectTouchTargets } from "../targets";
import { ama, expectFits, shoot, sizes } from "./harness";

const method = (page: Page, name: string) =>
  page.getByRole("group", { name: "Payment methods" }).getByRole("button", { name });
const amount = (page: Page) => page.getByRole("textbox", { name: "Amount tendered" });
const points = (page: Page) => page.getByRole("textbox", { name: "Points to use" });
const panel = (page: Page) => page.getByRole("region", { name: "Tender" });
const account = (page: Page) => panel(page).getByRole("group", { name: "Account" });
const args = async (page: Page, type: string) => (await calls(page, type)).map((c) => c.args);

async function tender(page: Page, scenario: string) {
  await openSale(page, scenario);
  await openCheckout(page);
}

test("Alt+5 shows what Ama may spend and F5 charges the sale to her account", async ({ page }) => {
  await tender(page, "accounts");
  await page.keyboard.press("Alt+5");
  await expect(method(page, "On account")).toHaveAttribute("aria-pressed", "true");
  await expect(method(page, "On account")).toHaveAttribute("aria-keyshortcuts", "Alt+5");
  await expect(account(page)).toContainText("Limit");
  await expect(account(page)).toContainText("GH₵ 500.00");
  await expect(account(page)).toContainText("Owed");
  await expect(account(page)).toContainText("GH₵ 120.00");
  await expect(account(page)).toContainText("Available");
  await expect(account(page)).toContainText("GH₵ 380.00");
  await expect(amount(page)).toHaveValue("126.50");
  expect(await args(page, "loadAccount")).toEqual([[ama]]);
  await page.keyboard.press("F5");
  await expect.poll(() => args(page, "complete")).toEqual([[]]);
  expect(await args(page, "addAccountTender")).toEqual([[{ kind: "credit", amount: 1_265_000 }]]);
});

test("the amount defaults to the lesser of due and available, and Split takes that part", async ({
  page,
}) => {
  await tender(page, "accounts-limited");
  await page.keyboard.press("Alt+5");
  await expect(account(page)).toContainText("GH₵ 50.00");
  await expect(amount(page)).toHaveValue("50.00");
  await expect(page.getByRole("button", { name: /^Charge/ })).toBeDisabled();
  await page.keyboard.press("F5");
  expect(await args(page, "addAccountTender")).toEqual([]);
  await page.keyboard.press("Alt+4");
  await expect
    .poll(() => args(page, "addAccountTender"))
    .toEqual([[{ kind: "credit", amount: 500_000 }]]);
  expect(await args(page, "complete")).toEqual([]);
  await expect(panel(page)).toContainText("GH₵ 76.50");
});

test("a deposit is shown as a deposit", async ({ page }) => {
  await tender(page, "accounts-deposit");
  await page.keyboard.press("Alt+5");
  await expect(account(page)).toContainText("Deposit");
  await expect(account(page)).toContainText("GH₵ 200.00");
  await expect(account(page)).not.toContainText("Owed");
});

test("an amount over what is available is refused inline, with the amount available", async ({
  page,
}) => {
  await tender(page, "accounts-limited");
  await page.keyboard.press("Alt+5");
  await amount(page).fill("60.00");
  await expect(panel(page).getByRole("alert")).toContainText("Over the limit: GH₵ 50.00 available");
  await expect(page.getByRole("button", { name: /^Charge/ })).toBeDisabled();
  await page.keyboard.press("Alt+4");
  expect(await args(page, "addAccountTender")).toEqual([]);
  await amount(page).fill("40.00");
  await expect(panel(page).getByRole("alert")).toHaveCount(0);
});

test("a refusal from the server stays inline and nothing completes", async ({ page }) => {
  await tender(page, "accounts-refused");
  await page.keyboard.press("Alt+5");
  await expect(account(page)).toContainText("GH₵ 380.00");
  await page.keyboard.press("F5");
  await expect(panel(page).getByRole("alert")).toContainText("GH₵ 20.00 available");
  expect(await args(page, "complete")).toEqual([]);
});

test("a customer who is not eligible is told so, with nothing available", async ({ page }) => {
  await tender(page, "accounts-ineligible");
  await page.keyboard.press("Alt+5");
  await expect(panel(page).getByRole("alert")).toContainText("Not eligible for credit");
  await expect(account(page)).toContainText("GH₵ 0.00");
  await expect(page.getByRole("button", { name: /^Charge/ })).toBeDisabled();
});

test("the summary loads behind a skeleton row, and a failed load can be retried", async ({
  page,
}) => {
  await tender(page, "accounts-slow");
  await page.keyboard.press("Alt+5");
  await expect(panel(page).getByRole("status", { name: "Loading account" })).toBeVisible();
  await expect(account(page)).toContainText("GH₵ 380.00");
  await expect(panel(page).getByRole("status", { name: "Loading account" })).toHaveCount(0);
});

test("a summary that could not load says so and Try again asks again", async ({ page }) => {
  await tender(page, "accounts-failed");
  await page.keyboard.press("Alt+5");
  await expect(panel(page).getByRole("alert")).toContainText("The account could not be read");
  await panel(page).getByRole("button", { name: "Try again" }).click();
  await expect.poll(async () => (await args(page, "loadAccount")).length).toBe(2);
});

test("Alt+6 takes points: 1 240 points = GH₵ 12.40, and over is refused inline", async ({
  page,
}) => {
  await tender(page, "accounts");
  await page.keyboard.press("Alt+6");
  await expect(method(page, "Points")).toHaveAttribute("aria-pressed", "true");
  await expect(method(page, "Points")).toHaveAttribute("aria-keyshortcuts", "Alt+6");
  await expect(panel(page)).toContainText("1 240 points = GH₵ 12.40");
  await expect(points(page)).toHaveValue("1240");
  await expect(page.getByRole("button", { name: /^Charge/ })).toBeDisabled();
  await points(page).fill("1300");
  await expect(panel(page).getByRole("alert")).toContainText("Only 1 240 points available");
  await page.keyboard.press("Alt+4");
  expect(await args(page, "addAccountTender")).toEqual([]);
  await points(page).fill("500");
  await expect(panel(page)).toContainText("500 points = GH₵ 5.00");
  await page.keyboard.press("Alt+4");
  await expect
    .poll(() => args(page, "addAccountTender"))
    .toEqual([[{ kind: "loyalty", points: 500 }]]);
  await expect(panel(page)).toContainText("GH₵ 121.50");
});

test("points are refused when the shop has loyalty off", async ({ page }) => {
  await tender(page, "accounts-deposit");
  await page.keyboard.press("Alt+6");
  await expect(panel(page).getByRole("alert")).toContainText("Loyalty is off");
  await expect(page.getByRole("button", { name: /^Charge/ })).toBeDisabled();
});

test("without a customer both are disabled and say why", async ({ page }) => {
  await tender(page, "lines");
  for (const name of ["On account", "Points"]) await expect(method(page, name)).toBeDisabled();
  await expect(method(page, "On account")).toHaveAccessibleDescription(
    "Add a customer to sell on account or with points",
  );
  await page.keyboard.press("Alt+5");
  await page.keyboard.press("Alt+6");
  await expect(method(page, "Cash")).toHaveAttribute("aria-pressed", "true");
  expect(await args(page, "loadAccount")).toEqual([]);
});

test("offline both are disabled with Needs a connection and cash still works", async ({ page }) => {
  await tender(page, "accounts-offline");
  for (const name of ["On account", "Points"]) await expect(method(page, name)).toBeDisabled();
  await expect(panel(page).getByText("Needs a connection", { exact: true })).toBeVisible();
  await page.keyboard.press("Alt+5");
  expect(await args(page, "loadAccount")).toEqual([]);
  await expect(method(page, "Cash")).toBeEnabled();
});

test("the till-size panel keeps Split and Charge on screen for every method", async ({ page }) => {
  for (const [scenario, key] of [
    ["lines", "Alt+1"],
    ["accounts", "Alt+1"],
    ["accounts", "Alt+5"],
    ["accounts", "Alt+6"],
  ] as const) {
    await tender(page, scenario);
    await page.keyboard.press(key);
    if (key !== "Alt+1") await expect(account(page)).toBeVisible();
    for (const name of ["Split", /^Charge/]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box!.y + box!.height, `${scenario} ${key} ${name}`).toBeLessThanOrEqual(708);
    }
    await expect(method(page, "Points")).toBeInViewport({ ratio: 1 });
  }
});

test("the legend lists the account keys", async ({ page }) => {
  await openSale(page, "accounts");
  const legend = page.getByRole("list", { name: "Keyboard shortcuts" });
  await expect(legend).toContainText("Alt+5/6");
  await expect(legend).toContainText("Alt+A");
});

for (const size of sizes.filter((s) => s.name !== "1440")) {
  test(`at ${size.name}: on account and points fit, pass axe and touch targets`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openSale(page, "accounts-limited");
    await page.setViewportSize({ width: size.width, height: size.height });
    await openCheckout(page);
    await page.keyboard.press("Alt+5");
    await expect(account(page)).toContainText("Available");
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `tender-account-${size.name}`);
    await amount(page).fill("60.00");
    await expect(panel(page).getByRole("alert")).toBeVisible();
    await expectFits(page, size.width);
    await shoot(page, `tender-account-over-${size.name}`);
    await page.keyboard.press("Alt+6");
    await expect(points(page)).toBeVisible();
    await expectFits(page, size.width);
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await shoot(page, `tender-points-${size.name}`);
  });
}
