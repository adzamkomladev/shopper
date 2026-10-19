import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { calls, openFromMenu, openSale } from "../sale/harness";
import { expectNoOverflow, shoot } from "../settings/harness";
import { expectTouchTargets } from "../targets";

// Set SHOPPER_SCREENSHOTS_DIR=docs/plans/day12/screenshots/purchases to keep the shots.
async function openDetail(page: Page, scenario = "lines") {
  await openSale(page, scenario);
  await openFromMenu(page, "Previous purchases");
  await page.getByRole("button", { name: /#10482/ }).click();
  await expect(page.getByRole("heading", { name: /^Purchase #/ })).toBeVisible();
}

const card = (page: Page) => page.getByRole("region", { name: "Receipt metadata" });
const headerReprint = (page: Page) =>
  page
    .getByRole("region", { name: "Purchase details" })
    .getByRole("button", { name: /^Reprint\b/ })
    .first();
const cardReprint = (page: Page) => card(page).getByRole("button", { name: /^Reprint receipt/ });
const toast = (page: Page) => page.locator("[data-sonner-toast]");
/** The detail scrolls inside the page, so a card pushed past the edge is not an overflow of the document. */
async function expectInsideViewport(page: Page, target: Locator) {
  const [box, width] = await Promise.all([target.boundingBox(), page.evaluate(() => innerWidth)]);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
}
const reprints = (page: Page) => calls(page, "reprint");

test("the receipt card shows only what the register recorded", async ({ page }) => {
  await openDetail(page);
  await expect(card(page)).toContainText("Receipt number");
  await expect(card(page)).toContainText("10482");
  await expect(card(page)).toContainText("Till 1 · Ama Mensah");
  await expect(card(page).getByText("Printed", { exact: true })).toBeVisible();
  await expect(card(page)).toContainText("Waiting to upload");
  for (const invented of ["Order number", "Transaction ID", "Ledger batch"])
    await expect(page.getByText(invented)).toHaveCount(0);

  await openDetail(page, "reprint-twice");
  await expect(card(page)).toContainText("Printed · reprinted 2×");
  await expect(card(page)).toContainText("Uploaded");

  await openDetail(page, "reprint-noprinter");
  await expect(card(page)).toContainText("Not printed");
  await expect(card(page)).toContainText("Not stored");
});

test("Reprint in the header and in the card print, show Printing, then report success", async ({
  page,
}) => {
  await openDetail(page, "reprint-slow");
  await expect(headerReprint(page)).toContainText("Alt+R");
  await headerReprint(page).click();
  const printing = page.getByRole("button", { name: /^Printing…/ });
  await expect(printing).toHaveCount(2);
  await expect(printing.first()).toBeDisabled();
  await expect(printing.last()).toBeDisabled();
  await expect(toast(page)).toContainText("Receipt sent to the printer");
  await expect(card(page).getByRole("status")).toContainText("Receipt sent to the printer");
  await expect(card(page)).toContainText("Printed · reprinted 1×");
  expect(await reprints(page)).toHaveLength(1);

  await cardReprint(page).click();
  await expect(card(page)).toContainText("Printed · reprinted 2×");
  expect(await reprints(page)).toHaveLength(2);
});

test("Reprint keeps keyboard focus while it runs", async ({ page }) => {
  await openDetail(page, "reprint-slow");
  await cardReprint(page).focus();
  await page.keyboard.press("Enter");
  const printing = card(page).getByRole("button", { name: /^Printing…/ });
  await expect(printing).toHaveAttribute("aria-disabled", "true");
  await expect(printing).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card(page)).toContainText("Printed · reprinted 1×");
  expect(await reprints(page)).toHaveLength(1);
  await expect(cardReprint(page)).toBeFocused();
});

test("Alt+V brings the opened preview into view", async ({ page }) => {
  await openDetail(page, "reprint-twice");
  await expect(page.getByRole("region", { name: "Receipt preview" })).toHaveCount(0);
  await page.keyboard.press("Alt+V");
  await expect(page.getByRole("region", { name: "Receipt preview" })).toBeInViewport();
});

test("Alt+R reprints and Alt+V toggles the preview, both from the keyboard alone", async ({
  page,
}) => {
  await openDetail(page);
  await page.keyboard.press("Alt+R");
  await expect(card(page)).toContainText("Printed · reprinted 1×");
  expect(await reprints(page)).toHaveLength(1);

  const preview = page.getByRole("region", { name: "Receipt preview" });
  await expect(preview).toHaveCount(0);
  await page.keyboard.press("Alt+V");
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Shopper Market");
  await expect(preview).toContainText("TOTAL");
  await expect(preview).not.toContainText("REPRINT");
  await expect(card(page).getByRole("button", { name: /^Hide preview/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(await page.evaluate(() => document.fonts.check("700 22px Geist"))).toBe(true);
  await page.keyboard.press("Alt+V");
  await expect(preview).toHaveCount(0);
});

test("the whole reprint path works with Tab and Enter", async ({ page }) => {
  await openDetail(page);
  await page.getByRole("region", { name: "Purchase details" }).focus();
  for (let tab = 0; tab < 12; tab += 1) {
    await page.keyboard.press("Tab");
    if (await headerReprint(page).evaluate((node) => node === document.activeElement)) break;
  }
  await expect(headerReprint(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(card(page)).toContainText("Printed · reprinted 1×");
  await cardReprint(page).focus();
  await page.keyboard.press("Tab");
  await expect(card(page).getByRole("button", { name: /^Preview receipt/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Receipt preview" })).toBeVisible();
});

test("Alt+R belongs to the screen on show: Settings keeps Test print and the list has no reprint", async ({
  page,
}) => {
  await openDetail(page, "settings-connected");
  await page.keyboard.press("Alt+T");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await page.keyboard.press("Alt+R");
  expect(await reprints(page)).toHaveLength(0);
  expect(await calls(page, "testPrint")).toHaveLength(1);
  await page.keyboard.press("Alt+P");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /#10482/ })).toBeVisible();
  await page.keyboard.press("Alt+R");
  expect(await reprints(page)).toHaveLength(0);
});

test("a printer that fails shows the fix in a toast and inline", async ({ page }, testInfo) => {
  await openDetail(page, "reprint-offline");
  await cardReprint(page).click();
  await expect(card(page).getByRole("alert")).toContainText(
    "Print failed: connection refused (192.168.1.50:9100). Check the printer is on and on the same network.",
  );
  await expect(toast(page)).toContainText("Check the printer is on and on the same network.");
  await expect(cardReprint(page)).toBeEnabled();
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "state-reprint-failed");
});

test("a print that failed at the till says so in the delivery row", async ({ page }, testInfo) => {
  await openDetail(page, "reprint-failedprint");
  await expect(card(page)).toContainText(
    "Print failed: connection refused (192.168.1.50:9100). Check the printer is on and on the same network.",
  );
  await shoot(page, testInfo, "state-print-failed");
});

test("with no printer Reprint is disabled and points to Settings", async ({ page }, testInfo) => {
  await openDetail(page, "reprint-noprinter");
  await expect(cardReprint(page)).toBeDisabled();
  await expect(headerReprint(page)).toBeDisabled();
  await expect(card(page)).toContainText("Add a printer in Settings");
  await expect(card(page)).toContainText("Alt+T");
  await expect(cardReprint(page)).toHaveAccessibleDescription(/Add a printer in Settings/);
  await page.keyboard.press("Alt+R");
  expect(await reprints(page)).toHaveLength(0);
  // A blocked shortcut still answers: the reason is a toast.
  await expect(toast(page)).toContainText("Add a printer in Settings");
  await expectNoSeriousAxe(page);
  await shoot(page, testInfo, "state-no-printer");
});

test("without permission Reprint is disabled and says why", async ({ page }, testInfo) => {
  await openDetail(page, "reprint-nopermission");
  await expect(cardReprint(page)).toBeDisabled();
  await expect(headerReprint(page)).toBeDisabled();
  await expect(card(page)).toContainText("Your role cannot reprint receipts");
  await page.keyboard.press("Alt+R");
  expect(await reprints(page)).toHaveLength(0);
  await shoot(page, testInfo, "state-no-permission");
});

for (const [width, height, label] of [
  [1366, 768, "till"],
  [1440, 900, "laptop"],
  [1920, 1080, "desktop"],
  [768, 1024, "tablet"],
  [390, 844, "mobile"],
] as const) {
  test(`the receipt card and preview fit at ${label} ${width}x${height}`, async ({
    page,
  }, testInfo) => {
    await openDetail(page, "reprint-twice");
    await page.setViewportSize({ width, height });
    await expectNoOverflow(page);
    await expectInsideViewport(page, card(page));
    await expectTouchTargets(page);
    await expectNoSeriousAxe(page);
    await card(page).scrollIntoViewIfNeeded();
    await shoot(page, testInfo, `${label}`);
    await page.keyboard.press("Alt+V");
    const preview = page.getByRole("region", { name: "Receipt preview" });
    await expect(preview).toBeVisible();
    await expect(preview).toContainText("Shopper Market");
    const [box, frame] = await Promise.all([
      preview.locator("> div > div").boundingBox(),
      preview.boundingBox(),
    ]);
    expect(box!.width).toBeLessThanOrEqual(frame!.width);
    await expectInsideViewport(page, preview);
    await expectNoOverflow(page);
    await expectNoSeriousAxe(page);
    await card(page).scrollIntoViewIfNeeded();
    await shoot(page, testInfo, `${label}-preview`);
  });
}

test("the preview uses the configured 58 mm paper", async ({ page }) => {
  await openDetail(page, "reprint-58");
  await page.keyboard.press("Alt+V");
  const preview = page.getByRole("region", { name: "Receipt preview" });
  await expect(preview).toContainText("58 mm paper");
  const box = await preview.locator("> div > div").boundingBox();
  // The paper is 384 dots wide, plus its 1 px border on each side.
  expect(Math.round(box!.width)).toBe(386);
});
