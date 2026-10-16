import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openSale } from "./harness";
import { expectTouchTargets } from "../targets";

const tenderAmount = (page: import("@playwright/test").Page) =>
  page.getByRole("textbox", { name: "Amount tendered" });

test("the tender panel uses GHS amounts and F5 charges the selected cash amount", async ({
  page,
}) => {
  await openSale(page, "lines");
  await expect(page.getByRole("region", { name: "Tender" })).toBeVisible();
  await expectTouchTargets(page);
  await expect(page.getByText("Payments are available in the next checkout step.")).toHaveCount(0);
  for (const name of [
    "1",
    "Backspace",
    "GH₵ 150.00",
    "Cash",
    "MoMo",
    "Card",
    "Split",
    /Charge/,
    "Hold sale",
    "Held sales",
    "Void sale",
  ]) {
    const bounds = await page
      .getByRole("button", { name, exact: typeof name === "string" })
      .first()
      .boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await tenderAmount(page).fill("126.50");
  await page.keyboard.press("F5");
  expect(await calls(page, "charge")).toEqual([
    { type: "charge", args: [{ kind: "cash", amount: 1_265_000 }] },
  ]);
  await expectNoSeriousAxe(page);
});

test("the mobile till keeps tender controls within the viewport", async ({ page }, testInfo) => {
  await openSale(page, "lines");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByText("Milo 400g tin", { exact: true }).first()).toBeVisible();
  const lines = page.getByRole("list", { name: "Basket lines" });
  expect(await lines.evaluate((element) => element.scrollTop)).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("mobile-basket-390.png") });
  await page.getByRole("region", { name: "Tender" }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("button", { name: "Held sales" }).scrollIntoViewIfNeeded();
  const held = await page.getByRole("button", { name: "Held sales" }).boundingBox();
  expect(held?.y).toBeGreaterThanOrEqual(0);
  expect(held!.y + held!.height).toBeLessThanOrEqual(844);
  await page.getByRole("button", { name: /Charge/ }).scrollIntoViewIfNeeded();
  const charge = await page.getByRole("button", { name: /Charge/ }).boundingBox();
  expect(charge?.height).toBeGreaterThanOrEqual(44);
  expect(charge?.y).toBeGreaterThanOrEqual(0);
  expect(charge!.y + charge!.height).toBeLessThanOrEqual(844);
  expect(charge?.x).toBeGreaterThanOrEqual(0);
  expect(charge!.x + charge!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("mobile-tender-390.png") });
});

test("cash preview applies 10p rounding up and down before a tender exists", async ({ page }) => {
  await openSale(page, "round-up");
  await expect(page.getByRole("region", { name: "Tender" })).toContainText("GH₵ 1.30");
  await expect(tenderAmount(page)).toHaveValue("1.30");
  await page.keyboard.press("F5");
  expect(await calls(page, "charge")).toEqual([
    { type: "charge", args: [{ kind: "cash", amount: 13_000 }] },
  ]);

  await openSale(page, "round-down");
  await expect(page.getByRole("region", { name: "Tender" })).toContainText("GH₵ 1.20");
  await expect(tenderAmount(page)).toHaveValue("1.20");
  await page.keyboard.press("F5");
  expect(await calls(page, "charge")).toEqual([
    { type: "charge", args: [{ kind: "cash", amount: 12_000 }] },
  ]);
});

test("quick cash and Split add a partial cash tender without completing the sale", async ({
  page,
}) => {
  await openSale(page, "lines");
  await expect(page.getByRole("button", { name: "GH₵ 150.00" })).toBeVisible();
  await tenderAmount(page).fill("50.00");
  await expect(page.getByRole("button", { name: /Split/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+4",
  );
  await page.keyboard.press("Alt+4");
  await expect(tenderAmount(page)).toHaveValue("76.50");
  await expect(page.getByRole("region", { name: "Tender" })).toContainText("Received GH₵ 50.00");
  expect(await calls(page, "addTender")).toEqual([
    { type: "addTender", args: [{ kind: "cash", amount: 500_000 }] },
  ]);
  expect(await calls(page, "charge")).toEqual([]);
});

test("Alt+3 opens card approval and records its approval code and optional last four", async ({
  page,
}) => {
  await openSale(page, "lines");
  await page.keyboard.press("Alt+3");
  const dialog = page.getByRole("dialog", { name: "Card payment" });
  await expect(dialog).toBeVisible();
  await expectTouchTargets(page);
  const approval = dialog.getByRole("textbox", { name: "Approval code" });
  const submit = dialog.getByRole("button", { name: "Add card tender" });
  for (const invalid of ["AB-123", "AB 123"]) {
    await approval.fill(invalid);
    await expect(submit).toBeDisabled();
    await expect(dialog).toContainText("4–12 letters or numbers (A–Z, 0–9)");
  }
  await approval.fill(" 6A91Q2 ");
  await expect(submit).toBeEnabled();
  await dialog.getByRole("textbox", { name: "Card last four digits" }).fill("4821");
  await submit.click();
  expect(await calls(page, "addTender")).toEqual([
    {
      type: "addTender",
      args: [{ kind: "card", amount: 1_265_000, approvalCode: "6A91Q2", last4: "4821" }],
    },
  ]);
  await page.keyboard.press("F5");
  await expect(page.getByRole("dialog", { name: "Card payment" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sale receipt" })).toBeVisible();
  expect(await calls(page, "complete")).toHaveLength(1);
  await expectNoSeriousAxe(page);
});

test("F5 completes a fully confirmed MoMo payment without reopening the dialog", async ({
  page,
}) => {
  await openSale(page, "momo");
  await page.keyboard.press("Alt+2");
  const dialog = page.getByRole("dialog", { name: "Mobile money payment" });
  await expectTouchTargets(page);
  await dialog.getByRole("textbox", { name: "Phone number" }).fill("0551234567");
  await dialog.getByRole("button", { name: "Request payment" }).click();
  await expect(page.getByText("Enter the one-time code sent to the customer.")).toBeVisible();
  await expectTouchTargets(page);
  await page.getByRole("textbox", { name: "One-time code" }).fill("123456");
  await page.getByRole("button", { name: "Submit code" }).click();
  await expect(page.getByText("Mobile money confirmed")).toBeVisible();
  await page.keyboard.press("F5");
  await expect(page.getByRole("dialog", { name: "Mobile money payment" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sale receipt" })).toBeVisible();
  expect(await calls(page, "complete")).toHaveLength(1);
});

test("MoMo explains when offline and offers phone, network, OTP and retry when online", async ({
  page,
}) => {
  await openSale(page, "offline");
  await expect(page.getByRole("button", { name: /MoMo/ })).toBeDisabled();
  await expect(page.getByText("Mobile money needs an internet connection.")).toBeVisible();

  await openSale(page, "momo");
  await page.keyboard.press("Alt+2");
  const dialog = page.getByRole("dialog", { name: "Mobile money payment" });
  await dialog.getByRole("textbox", { name: "Phone number" }).fill("0551234567");
  await dialog.getByRole("combobox", { name: "Network" }).click();
  await page.getByRole("option", { name: "MTN" }).click();
  await dialog.getByRole("button", { name: "Request payment" }).click();
  expect(await calls(page, "startMomo")).toEqual([
    {
      type: "startMomo",
      args: [{ phone: "0551234567", network: "mtn", amount: 1_265_000 }],
    },
  ]);

  await openSale(page, "momo-otp");
  await expect(page.getByText("Enter the one-time code sent to the customer.")).toBeVisible();
  await page.getByRole("textbox", { name: "One-time code" }).fill("123456");
  await page.getByRole("button", { name: "Submit code" }).click();
  expect(await calls(page, "submitMomoOtp")).toHaveLength(1);
  await expectNoSeriousAxe(page);
});

test("a partial cash tender blocks underpayment and then charges the exact remainder", async ({
  page,
}) => {
  await openSale(page, "insufficient");
  await expect(page.getByRole("region", { name: "Tender" })).toContainText("GH₵ 76.50");
  await tenderAmount(page).fill("50.00");
  await expect(page.getByRole("button", { name: /Charge/ })).toBeDisabled();
  await expect(page.getByText("Add another tender to finish this sale.")).toBeVisible();
  await tenderAmount(page).fill("76.50");
  await expect(page.getByRole("button", { name: /Charge/ })).toBeEnabled();
  await page.keyboard.press("F5");
  expect(await calls(page, "charge")).toEqual([
    { type: "charge", args: [{ kind: "cash", amount: 765_000 }] },
  ]);
  await expect(page.getByRole("region", { name: "Sale receipt" })).toBeVisible();
});

test("F6 holds, F7 resumes a held sale, and F11 voids only with permission and a reason", async ({
  page,
}) => {
  await openSale(page, "lines");
  await page.keyboard.press("F6");
  expect(await calls(page, "holdSale")).toHaveLength(1);
  await page.keyboard.press("F7");
  await expect(page.getByRole("dialog", { name: "Held sales" })).toBeVisible();
  await page.getByRole("button", { name: /Resume Milo/ }).click();
  expect(await calls(page, "resumeSale")).toHaveLength(1);

  await page.keyboard.press("F11");
  const dialog = page.getByRole("dialog", { name: "Void sale" });
  await expectTouchTargets(page);
  await dialog.getByRole("textbox", { name: "Reason" }).fill("Customer changed their mind");
  await dialog.getByRole("button", { name: "Void sale" }).click();
  expect(await calls(page, "voidSale")).toEqual([
    { type: "voidSale", args: ["Customer changed their mind"] },
  ]);

  await openSale(page, "no-void-permission");
  await page.keyboard.press("F11");
  await expect(page.getByRole("dialog", { name: "Void sale" })).toHaveCount(0);
  await expect(page.getByText("A manager permission is required to void a sale.")).toBeVisible();
});

test("a completed sale shows its receipt and change; Enter starts a new sale", async ({ page }) => {
  await openSale(page, "lines");
  await tenderAmount(page).fill("200.00");
  await page.keyboard.press("F5");
  const receipt = page.getByRole("region", { name: "Sale receipt" });
  await expect(receipt).toContainText("GH₵ 3.50");
  expect((await receipt.boundingBox())?.width).toBeGreaterThan(350);
  await expect(page.getByRole("button", { name: /New sale/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Enter",
  );
  await page.keyboard.press("Enter");
  expect(await calls(page, "newSale")).toHaveLength(1);
  await expect(tenderAmount(page)).toHaveValue("126.50");
  await expectNoSeriousAxe(page);
});
