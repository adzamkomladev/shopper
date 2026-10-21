// The Shift screen and its X report: what a manager reads, what a cashier never sees, and printing.
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";
import { expectFits, openShiftScreen, shiftCalls, shoot, sizes, toast, open } from "./harness";

const report = (page: import("@playwright/test").Page) =>
  page.getByRole("region", { name: "X report" });

test("the header names who opened the shift and the float, with the three actions and their keys", async ({
  page,
}, testInfo) => {
  await openShiftScreen(page);
  const header = page.getByRole("region", { name: "Shift details" });
  await expect(header).toContainText("Opened Oct 15, 2026, 8:00 AM");
  await expect(header).toContainText("Ama Mensah");
  await expect(header).toContainText("Float");
  await expect(header).toContainText("GH₵ 200.00");
  await expect(page.getByRole("button", { name: /^Print X report/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+X",
  );
  await expect(page.getByRole("button", { name: /^Close shift/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+Z",
  );
  await expect(page.getByRole("button", { name: /^Reprint Z/ })).toHaveAttribute(
    "aria-keyshortcuts",
    "Alt+R",
  );
  await expectNoSeriousAxe(page);
  await expectTouchTargets(page);
  await shoot(page, testInfo, "shift-1366");
});

test("the X report shows the tiles, the tenders, the cash box, the movements and the cashiers", async ({
  page,
}) => {
  await openShiftScreen(page);
  const x = report(page);
  await expect(x).toBeVisible();
  await expect(x.getByRole("heading", { name: "X report" })).toBeVisible();
  await expect(x.getByText("Not a close")).toBeVisible();
  await expect(x.getByRole("group", { name: "Sales" })).toContainText("14");
  await expect(x.getByRole("group", { name: "Sales" })).toContainText("GH₵ 192.00");
  await expect(x.getByRole("group", { name: "Tax" })).toContainText("GH₵ 32.00");
  await expect(x.getByRole("group", { name: "Refunds" })).toContainText("GH₵ 10.00");
  const tenders = x.getByRole("table", { name: "Tenders" });
  await expect(tenders.getByRole("columnheader")).toHaveText([
    "Tender",
    "Sales",
    "Refunds",
    "Expected",
  ]);
  await expect(tenders.getByRole("row", { name: /^Cash/ })).toContainText("GH₵ 240.00");
  await expect(tenders.getByRole("row", { name: /^Cash/ })).toContainText("−GH₵ 10.00");
  await expect(tenders.getByRole("row", { name: /^Card/ })).not.toContainText("−");
  await expect(tenders.getByRole("row", { name: /^Card/ })).toContainText("GH₵ 30.00");
  await expect(tenders.getByRole("row", { name: /^Mobile money/ })).toContainText("GH₵ 12.00");
  const cash = x.getByRole("region", { name: "Cash in the drawer" });
  await expect(cash).toContainText("Float");
  await expect(cash).toContainText("Cash sales");
  await expect(cash).toContainText("Cash refunds");
  await expect(cash).toContainText("Drops");
  await expect(cash).toContainText("Expected in drawer");
  await expect(cash).toContainText("GH₵ 240.00");
  const movements = x.getByRole("region", { name: "Drops and no-sales" });
  await expect(movements).toContainText("Bank run");
  await expect(movements).toContainText("Change for a customer");
  await expect(x.getByRole("region", { name: "Cashiers" })).toContainText("Kofi Boateng");
  await expect(x.getByRole("region", { name: "Audit anchor" })).toHaveCount(0);
});

test("a cashier without report.read gets no X report, no Print X and no expected figure", async ({
  page,
}) => {
  await openShiftScreen(page, "shift-open", "&permissions=sale.create,shift.read,shift.write");
  await expect(page.getByRole("region", { name: "Shift details" })).toContainText("GH₵ 200.00");
  await expect(report(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Print X report/ })).toHaveCount(0);
  await expect(page.getByText(/expected/i)).toHaveCount(0);
  await page.keyboard.press("Alt+X");
  expect(await shiftCalls(page, "printX")).toEqual([]);
  expect(await shiftCalls(page, "loadReport")).toEqual([]);
  await expect(page.getByRole("button", { name: /^Close shift/ })).toBeVisible();
});

test("Alt+X prints the X and confirms with a toast", async ({ page }) => {
  await openShiftScreen(page);
  await page.keyboard.press("Alt+X");
  await expect(toast(page)).toContainText("X report printed");
  expect(await shiftCalls(page, "printX")).toHaveLength(1);
});

test("a printer that is down is named and the report stays on screen", async ({ page }) => {
  await openShiftScreen(page, "shift-print-offline");
  await page.keyboard.press("Alt+X");
  await expect(toast(page)).toContainText("The printer is offline");
  await expect(report(page)).toBeVisible();
});

test("Alt+R reprints the last Z", async ({ page }) => {
  await openShiftScreen(page, "shift-last-accepted");
  await page.keyboard.press("Alt+R");
  await expect(toast(page)).toContainText("Z report printed");
  expect(await shiftCalls(page, "reprintZ")).toHaveLength(1);
});

test("with no Z yet there is nothing to reprint", async ({ page }) => {
  await openShiftScreen(page, "shift-open-first");
  await expect(page.getByRole("button", { name: /^Reprint Z/ })).toHaveCount(0);
  await page.keyboard.press("Alt+R");
  expect(await shiftCalls(page, "reprintZ")).toEqual([]);
});

test("the report loads behind a skeleton, and a failure offers Try again", async ({ page }) => {
  await openShiftScreen(page, "shift-report-loading");
  await expect(page.getByRole("status", { name: "Loading the X report" })).toBeVisible();
  await expectNoSeriousAxe(page);

  await openShiftScreen(page, "shift-report-error");
  const failed = page.getByRole("alert").filter({ hasText: "The X report could not be read" });
  await expect(failed).toContainText("The register is busy. Try again in a moment.");
  await expectNoSeriousAxe(page);
  await failed.getByRole("button", { name: "Try again" }).click();
  await expect(report(page)).toBeVisible();
});

test("a register that lost its host says the report needs it", async ({ page }) => {
  await openShiftScreen(page, "shift-disconnected");
  await expect(page.getByText("Register host disconnected")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Reconnect/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Close shift/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Print X report/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Reprint Z/ })).toBeDisabled();
  await expect(page.getByText("Reconnect to close the shift or print reports")).toBeVisible();
});

for (const size of sizes)
  test(`at ${size.name}: the Shift screen fits`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await open(page, "shift-open");
    await page.getByRole("tablist", { name: "Register sections" }).waitFor();
    await page.keyboard.press("Alt+H");
    await expect(report(page)).toBeVisible();
    await expectFits(page);
    await expectNoSeriousAxe(page);
    await shoot(page, testInfo, `shift-${size.name}`);
  });
