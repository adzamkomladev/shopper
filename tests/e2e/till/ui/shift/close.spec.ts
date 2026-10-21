// Closing the shift: a blind count, the terminal totals, the variance per tender, the printed Z.
import { expect, test } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { expectTouchTargets } from "../targets";
import {
  card,
  count,
  countBalanced,
  expectFits,
  flow,
  momo,
  open,
  shiftCalls,
  shoot,
  sizes,
  startClose,
  step,
  submitTotals,
  toast,
} from "./harness";

test("the count is blind: nothing expected is on screen before the count is submitted", async ({
  page,
}, testInfo) => {
  await startClose(page);
  await expect(step(page, "Count cash")).toHaveAttribute("aria-current", "step");
  await expect(count(page, "200")).toBeFocused();
  await countBalanced(page);
  await expect(flow(page)).toContainText("Counted GH₵ 240.00");
  await expect(flow(page)).not.toContainText(/expected|variance|short|over\b/i);
  await expect(page.getByRole("region", { name: "X report" })).toHaveCount(0);
  await expectNoSeriousAxe(page);
  await expectTouchTargets(page);
  await shoot(page, testInfo, "close-count-1366");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(step(page, "Card & MoMo")).toHaveAttribute("aria-current", "step");
  await expect(flow(page)).not.toContainText(/expected|variance/i);
  await shoot(page, testInfo, "close-totals-1366");
  await page.keyboard.press("Escape");
  await expect(step(page, "Count cash")).toHaveAttribute("aria-current", "step");
  await expect(count(page, "20")).toHaveValue("2");
  expect(await shiftCalls(page, "shiftDeclare")).toEqual([]);
});

test("Enter moves between count boxes, an empty count is blocked and a typed 0 is an empty drawer", async ({
  page,
}) => {
  await startClose(page);
  const next = page.getByRole("button", { name: /^Next: Card & MoMo/ });
  await expect(flow(page)).toContainText("Count at least one note or coin");
  await expect(next).toBeDisabled();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(step(page, "Count cash")).toHaveAttribute("aria-current", "step");
  await page.keyboard.type("1");
  await page.keyboard.press("Enter");
  await expect(count(page, "100")).toBeFocused();
  await expect(step(page, "Count cash")).toHaveAttribute("aria-current", "step");
  await count(page, "200").fill("");
  await expect(next).toBeDisabled();
  await count(page, "200").fill("0");
  await expect(next).toBeEnabled();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(step(page, "Card & MoMo")).toHaveAttribute("aria-current", "step");
  await expect(flow(page)).toContainText("Submitting makes this count final");
  await card(page).fill("0");
  await page.keyboard.press("Enter");
  await expect(momo(page)).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await shiftCalls(page, "shiftDeclare")).toEqual([]);
});

test("Print X is off while the count is open", async ({ page }) => {
  await startClose(page);
  await page.keyboard.press("Alt+X");
  expect(await shiftCalls(page, "printX")).toEqual([]);
  await expect(page.getByRole("button", { name: /^Print X report/ })).toHaveCount(0);
});

test("Esc on the first step leaves the close and nothing is recorded", async ({ page }) => {
  await startClose(page);
  await count(page, "100").fill("3");
  await page.keyboard.press("Escape");
  await expect(flow(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Close shift/ })).toBeFocused();
  expect(await shiftCalls(page, "shiftDeclare")).toEqual([]);
});

test("a count within the threshold closes at once and shows the Z, printed", async ({
  page,
}, testInfo) => {
  await startClose(page);
  await submitTotals(page, () => countBalanced(page));
  expect(await shiftCalls(page, "shiftDeclare")).toEqual([
    [{ "200000": 2, "2000000": 1 }, 300_000, 120_000],
  ]);
  await expect(page.getByRole("status").filter({ hasText: "Shift closed" })).toContainText(
    "Z report printed",
  );
  const z = page.getByRole("region", { name: "Z report" });
  await expect(z).toBeVisible();
  const table = z.getByRole("table", { name: "Tenders" });
  await expect(table.getByRole("columnheader")).toHaveText([
    "Tender",
    "Expected",
    "Declared",
    "Variance",
  ]);
  await expect(table.getByRole("row", { name: /^Cash/ })).toContainText("Balanced");
  await expect(z.getByRole("region", { name: "Counted cash" })).toContainText("2 × GH₵ 20");
  await expect(z.getByRole("region", { name: "Audit anchor" })).toContainText("#42");
  await expect(z.getByRole("region", { name: "Audit anchor" })).toContainText(
    "0123456789abcdef 0123456789abcdef 0123456789abcdef 0123456789abcdef",
  );
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "close-z-1366");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("main", { name: "Shift" }).getByText("Open a shift to start selling"),
  ).toBeVisible();
});

test("a short drawer within the threshold is written as Short, an over as Over", async ({
  page,
}) => {
  await startClose(page);
  await submitTotals(page, async () => {
    await count(page, "200").fill("1");
    await count(page, "20").fill("2");
    await count(page, "5").fill("1");
  }, ["27.5", "12"]);
  const table = page.getByRole("region", { name: "Z report" }).getByRole("table", {
    name: "Tenders",
  });
  await expect(table.getByRole("row", { name: /^Cash/ })).toContainText("Over GH₵ 5.00");
  await expect(table.getByRole("row", { name: /^Card/ })).toContainText("Short GH₵ 2.50");
  await expect(table.getByRole("row", { name: /^Mobile money/ })).toContainText("Balanced");
});

test("when the printer is down the Z is saved and Alt+R reprints it", async ({ page }) => {
  await startClose(page, "shift-close-printer-offline");
  await submitTotals(page, () => countBalanced(page));
  const status = page.getByRole("status").filter({ hasText: "Shift closed" });
  await expect(status).toContainText("Z saved. It did not print");
  await expect(page.getByRole("region", { name: "Z report" })).toBeVisible();
  await page.getByRole("button", { name: /^Reprint Z/ }).waitFor();
  await page.keyboard.press("Alt+R");
  await expect(toast(page)).toContainText("Z report printed");
  expect(await shiftCalls(page, "reprintZ")).toHaveLength(1);
});

test("a basket with a payment blocks the count and says how to clear it", async ({ page }) => {
  await startClose(page, "shift-close-busy");
  await submitTotals(page, () => countBalanced(page));
  await expect(page.getByRole("alert")).toContainText(
    "Finish or void the basket with a payment first",
  );
  await expect(step(page, "Card & MoMo")).toHaveAttribute("aria-current", "step");
  await expect(card(page)).toHaveValue("30");
});

test("a lost connection mid-close names the problem and keeps the count", async ({ page }) => {
  await startClose(page, "shift-close-lost");
  await submitTotals(page, () => countBalanced(page));
  await expect(page.getByRole("alert")).toContainText("The register connection ended");
  await expect(card(page)).toHaveValue("30");
});

for (const size of sizes)
  test(`at ${size.name}: every close step fits`, async ({ page }, testInfo) => {
    await page.setViewportSize(size);
    await open(page, "shift-open");
    await page.getByRole("tablist", { name: "Register sections" }).waitFor();
    await page.keyboard.press("Alt+H");
    await page.keyboard.press("Alt+Z");
    await expect(flow(page)).toBeVisible();
    await expectFits(page);
    await expectTouchTargets(page);
    await shoot(page, testInfo, `close-count-${size.name}`);
    await count(page, "200").fill("1");
    await count(page, "10").fill("3");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expectFits(page);
    await expectTouchTargets(page);
    await shoot(page, testInfo, `close-totals-${size.name}`);
    await card(page).fill("30");
    await momo(page).fill("12");
    await page.keyboard.press("ControlOrMeta+Enter");
    await expect(step(page, "Result")).toHaveAttribute("aria-current", "step");
    await expectFits(page);
    await expectNoSeriousAxe(page);
    await shoot(page, testInfo, `close-result-${size.name}`);
  });
