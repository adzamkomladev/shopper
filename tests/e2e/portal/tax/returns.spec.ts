import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import * as XLSX from "xlsx";
import { createStaff, signInAs } from "../../../support/admin/people";
import { orgId } from "../../../support/customers/portal";
import { shoot } from "../../../support/customers/shots";
import { BOX_API, PORTAL_ORIGIN } from "../../../support/e2e";

// The VAT return worksheet. Its figures come from the integration suite's fixture month; here a quiet month
// is real (the API answers it) and a busy one is the API's answer replayed, so every state is drawn.
const SIZES = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
] as const;
const PERIOD = "2025-03";
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const busy = {
  period: "2025-04",
  from: "2025-04-01",
  to: "2025-04-30",
  standard: { value: 12_500_000, vat: 1_875_000, nhil: 312_500, getfund: 312_500, covid: 0 },
  zeroRated: 600_000,
  exempt: 250_000,
  creditNotes: {
    value: 500_000,
    vat: 75_000,
    nhil: 12_500,
    getfund: 12_500,
    covid: 0,
    zeroRated: 0,
    exempt: 0,
  },
  output: { vat: 1_800_000, nhil: 300_000, getfund: 300_000, covid: 0 },
  input: { vat: 400_000, nhil: 0, getfund: 0 },
  payable: 2_000_000,
};

// Screenshots at five sizes, each with an axe pass, take longer than the default minute.
test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ request }) => {
  await request.put(`${BOX_API}/tax/returns/${PERIOD}/input`, {
    headers: { "X-Shopper-Org": await orgId(request), Origin: PORTAL_ORIGIN },
    data: { vat: 0, nhil: 0, getfund: 0 },
  });
});

test("The accountant can file a VAT return from the worksheet", async ({ page, request }, info) => {
  const accountant = await createStaff(request, "accountant", "Tax");
  await page.context().clearCookies();
  await signInAs(page, accountant);
  await page.goto(`/tax/returns?period=${PERIOD}`);
  await expect(page.getByRole("heading", { name: "Tax", level: 1 })).toBeVisible();
  await expect(page.getByRole("tab", { name: "VAT return" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByLabel("Month")).toHaveValue(PERIOD);
  await expect(page.getByText("Net payable to GRA")).toBeVisible();

  // Input tax from the purchase invoices: saved with the keyboard, and the balance becomes a credit.
  await field(page, "Input VAT").fill("125.50");
  await field(page, "Input NHIL").fill("20");
  await field(page, "Input GETFund levy").fill("20");
  await field(page, "Input VAT").focus();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("Input tax saved")).toBeVisible();
  await expect(page.getByText("Credit to carry forward")).toBeVisible();
  await expect(page.getByRole("region", { name: "Balance" })).toContainText("GH₵ 165.50");
  await shoot(page, info, "tax-return-filed", { sizes: SIZES });

  // E downloads the workbook the accountant files from (focus leaves the fields, or E types into one).
  await page.getByRole("heading", { name: "Tax", level: 1 }).click();
  const download = page.waitForEvent("download");
  await page.keyboard.press("e");
  const file = await download;
  expect(file.suggestedFilename()).toBe(`vat-return-${PERIOD}.xlsx`);
  const book = XLSX.read(await readFile((await file.path())!));
  const rows = XLSX.utils.sheet_to_json<[string, number]>(book.Sheets["VAT return"]!, {
    header: 1,
  });
  expect(rows.find((row) => row[0] === "Input VAT")?.[1]).toBe(125.5);
  expect(rows.find((row) => row[0] === "Net payable")?.[1]).toBe(-165.5);
});

test("a busy month reads in filing order, and bad input tax is refused on its field", async ({
  page,
}, info) => {
  await page.route("**/api/tax/returns/2025-04", (route) => route.fulfill({ json: busy }));
  await page.goto("/tax/returns?period=2025-04");
  for (const section of [
    "Supplies",
    "Output tax, less credit notes",
    "Input tax claimed",
    "Balance",
  ])
    await expect(page.getByRole("heading", { name: section, level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Supplies" })).toContainText("GH₵ 1,250.00");
  await expect(page.getByRole("region", { name: "Balance" })).toContainText("GH₵ 200.00");
  await shoot(page, info, "tax-return-busy", { sizes: SIZES });

  await field(page, "Input VAT").fill("abc");
  await page.getByRole("button", { name: /Save input tax/ }).click();
  await expect(page.getByText("Enter the input VAT in cedis, 0 if none")).toBeVisible();
  await expect(field(page, "Input VAT")).toBeFocused();
});

test("offline, saving and exporting wait for a connection", async ({ page, context }) => {
  await page.goto(`/tax/returns?period=${PERIOD}`);
  await expect(page.getByText("Net payable to GRA")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole("button", { name: /Save input tax/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Export to Excel/ })).toBeDisabled();
  await expect(page.getByRole("main")).toContainText("Reconnect to change or export it");
  await context.setOffline(false);
});

test("with the server unreachable the page says so and Try again recovers", async ({ page }) => {
  let failures = 1;
  await page.route(`**/api/tax/returns/${PERIOD}`, (route) =>
    failures-- > 0 ? route.abort("failed") : route.fallback(),
  );
  await page.goto(`/tax/returns?period=${PERIOD}`);
  await expect(page.getByText("Can't reach the server")).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Net payable to GRA")).toBeVisible();
});

test("a cashier is told the return needs permission, and the nav has no Tax link", async ({
  page,
  request,
}) => {
  const cashier = await createStaff(request, "cashier", "TaxDenied");
  await page.context().clearCookies();
  await signInAs(page, cashier);
  await page.goto("/tax/returns");
  await expect(page.getByText("You don't have permission to view VAT returns")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export to Excel/ })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Tax" }),
  ).toHaveCount(0);
});
