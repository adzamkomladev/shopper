import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Client } from "pg";
import { E2E_DATABASE_URL } from "../../../../tooling/database/e2e";
import { createStaff, signInAs } from "../../../support/admin/people";
import { orgId } from "../../../support/customers/portal";
import { shopHeaders } from "../../../support/admin";
import { BOX_API } from "../../../support/e2e";
import { shoot } from "../../../support/customers/shots";

// The books on the saved owner session: a manual entry posted and reversed by keyboard, Post held back until the
// entry balances, the statements drawn and downloaded, an account's lines with their running balance, and the lock
// date refusing an entry inside the locked period. The lock is cleared before each test.
test.describe.configure({ timeout: 180_000 });

const today = new Date().toISOString().slice(0, 10);

test.beforeEach(async ({ request }) => {
  const client = new Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  await client.query("UPDATE org SET ledger_locked_through = NULL WHERE id = $1", [
    await orgId(request),
  ]);
  await client.end();
});

/** A balanced cash sale posted through the real API, so a test never depends on another having run first. */
async function postEntry(request: APIRequestContext) {
  const headers = await shopHeaders(request);
  const chart = (await (await request.get(`${BOX_API}/ledger/accounts`, { headers })).json()) as {
    accounts: { id: string; systemKey: string | null }[];
  };
  const account = (key: string) => chart.accounts.find((row) => row.systemKey === key)!.id;
  const posted = await request.post(`${BOX_API}/ledger/journal`, {
    headers,
    data: {
      id: crypto.randomUUID(),
      postedOn: today,
      memo: "Opening cash",
      lines: [
        { accountId: account("cash_safe"), amount: 1_000_000 },
        { accountId: account("owner_equity"), amount: -1_000_000 },
      ],
    },
  });
  expect(posted.status(), await posted.text()).toBe(201);
}

async function pick(page: Page, line: number, account: string) {
  await page.getByRole("combobox", { name: `Line ${line} account` }).click();
  await page.getByRole("option", { name: account }).click();
}

test("the owner posts a balanced entry by keyboard and reverses it once", async ({
  page,
}, info) => {
  const memo = `Owner cash ${Date.now()}`;
  await page.goto("/ledger/journal");
  // The first page of a cold server can take a while; later steps keep the default.
  await expect(page.getByRole("tab", { name: "Journal" })).toHaveAttribute(
    "aria-selected",
    "true",
    {
      timeout: 30_000,
    },
  );
  await page.getByRole("heading", { name: "General ledger", level: 1 }).focus();
  await page.keyboard.press("n");
  const dialog = page.getByRole("dialog", { name: "New journal entry" });
  await expect(page.getByLabel("What it is for")).toBeFocused();
  await page.keyboard.type(memo);
  await pick(page, 1, "1020 Bank");
  await page.getByLabel("Line 1 debit").fill("250");
  await pick(page, 2, "3000 Owner's equity");
  await page.getByLabel("Line 2 credit").fill("200");
  const post = dialog.getByRole("button", { name: "Post entry" });
  await expect(post).toBeDisabled();
  await expect(dialog).toContainText("Debits and credits differ by GH₵ 50.00");
  await page.getByLabel("Line 2 credit").fill("250");
  await expect(post).toBeEnabled();
  await shoot(page, info, "ledger-entry", {
    sizes: [
      [1440, 900],
      [390, 844],
    ],
  });
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Entry posted")).toBeVisible();
  await expect(dialog).toBeHidden();
  const entry = page.getByRole("region", { name: `${today} ${memo}` });
  await expect(entry).toContainText("GH₵ 250.00");
  await shoot(page, info, "ledger-journal");

  await entry.getByRole("button", { name: /Reverse/ }).click();
  await page.getByRole("button", { name: "Reverse entry" }).click();
  await expect(page.getByText("Entry reversed")).toBeVisible();
  await expect(entry).toContainText("Reversed");
  await expect(entry.getByRole("button", { name: /Reverse/ })).toHaveCount(0);
  await expect(page.getByRole("region", { name: `${today} Reversal of ${memo}` })).toBeVisible();
});

test("the statements balance and download as CSV", async ({ page, request }, info) => {
  await postEntry(request);
  await page.goto(`/ledger/statements?to=${today}`);
  const trial = page.getByRole("table", { name: "Trial balance" });
  await expect(trial).toBeVisible({ timeout: 30_000 });
  const totals = trial.locator("tfoot td");
  await expect(totals.nth(1)).toHaveText(await totals.nth(2).innerText());
  await shoot(page, info, "ledger-trial");
  const download = page.waitForEvent("download");
  await page.keyboard.press("d");
  expect((await download).suggestedFilename()).toBe(`trial-${today}.csv`);

  await page.getByRole("tab", { name: "Profit and loss" }).click();
  await expect(
    page.getByRole("table", { name: "Profit and loss" }).or(page.getByText(/Nothing posted/)),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Balance sheet" }).click();
  await expect(page.getByRole("table", { name: "Balance sheet" })).toContainText(
    "Liabilities and equity",
  );
  await shoot(page, info, "ledger-balance");
});

test("an account opens on its lines and the lock date refuses an entry inside it", async ({
  page,
}, info) => {
  await page.goto("/ledger");
  await expect(page.getByText("The books are open")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "Bank", exact: true }).click();
  await expect(page.getByRole("heading", { name: /1020 Bank/, level: 1 })).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Account lines" }).or(page.getByText(/Nothing posted/)),
  ).toBeVisible();
  await shoot(page, info, "ledger-account");

  await page.goto("/ledger");
  await page.getByRole("heading", { name: "General ledger", level: 1 }).focus();
  await page.keyboard.press("l");
  await page.getByLabel("Locked through").fill(today);
  await page.getByRole("button", { name: `Lock through ${today}` }).click();
  await expect(page.getByText(`The books are locked through ${today}`)).toBeVisible();

  await page.goto("/ledger/journal");
  await page.getByRole("button", { name: "New entry" }).click();
  await page.getByLabel("What it is for").fill("Inside the lock");
  await pick(page, 1, "1020 Bank");
  await page.getByLabel("Line 1 debit").fill("1");
  await pick(page, 2, "3000 Owner's equity");
  await page.getByLabel("Line 2 credit").fill("1");
  await expect(page.getByRole("dialog")).toContainText(
    `The books are locked through ${today}. Pick a later day.`,
  );
  await expect(page.getByRole("button", { name: "Post entry" })).toBeDisabled();
});

test("a cashier is told the books are not theirs to view", async ({ page, request }) => {
  const cashier = await createStaff(request, "cashier", "Books");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/ledger");
  await expect(page.getByText(/view the books/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "General ledger" })).toHaveCount(0);
});

test("the owner finds the general ledger in the sidebar and lands on the accounts", async ({
  page,
}) => {
  await page.goto("/reports");
  const link = page.getByRole("link", { name: "General ledger" });
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();
  await expect(page).toHaveURL(/\/ledger$/);
  await expect(page.getByRole("heading", { name: "General ledger", level: 1 })).toBeVisible();
});
