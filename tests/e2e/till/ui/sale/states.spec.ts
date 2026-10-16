import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { openSale } from "./harness";

// Set SHOPPER_SCREENSHOTS_DIR to keep the 1366x768 shots (docs/plans/day10/screenshots/till).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;

type State = {
  name: string;
  expects: (page: Page) => Promise<unknown>;
  setup?: (page: Page) => Promise<unknown>;
};
const text = (value: string | RegExp) => (page: Page) =>
  expect(page.getByRole("main", { name: "Sale" })).toContainText(value);
const typeQuery = (page: Page) =>
  page.getByRole("combobox").pressSequentially("milo", { delay: 90 });

const states: State[] = [
  { name: "lines", expects: text("Milo 400g tin") },
  { name: "many", expects: text("Titus sardines 125g") },
  { name: "levy", expects: text("Prices include VAT, NHIL, GETFund and COVID-19 levy.") },
  { name: "empty", expects: text("Basket is empty") },
  {
    name: "loading",
    expects: (page) => expect(page.getByRole("status", { name: "Loading basket" })).toBeVisible(),
  },
  {
    name: "busy",
    expects: (page) =>
      expect(page.getByRole("button", { name: "Remove Milo 400g tin" })).toBeDisabled(),
  },
  {
    name: "results",
    setup: typeQuery,
    expects: (page) => expect(page.getByRole("option")).toHaveCount(3),
  },
  {
    name: "searching",
    setup: typeQuery,
    expects: (page) =>
      expect(page.getByRole("status", { name: "Searching the catalogue" })).toBeVisible(),
  },
  { name: "nomatch", setup: typeQuery, expects: text("No matches for “milo”") },
  { name: "searchfail", setup: typeQuery, expects: text("Search is unavailable") },
  { name: "unknown", expects: text("Barcode 5012345600001 was not found") },
  { name: "rejected", expects: text("Nothing was added") },
  { name: "unavailable", expects: text("2 lines cannot be priced") },
  { name: "session", expects: text("Your session has expired") },
  { name: "permission", expects: text("You cannot sell on this register") },
  { name: "storage", expects: text("The register could not read the basket") },
  {
    name: "offline",
    expects: text("Sales are saved on this register and upload when the connection returns."),
  },
  { name: "disconnected", expects: text("Edits are paused so no change is lost.") },
  { name: "connecting", expects: text("Connecting to the register host") },
  {
    name: "syncing",
    expects: (page) => expect(page.getByRole("button", { name: /Syncing/ })).toBeDisabled(),
  },
  {
    name: "editing",
    setup: (page) => page.keyboard.press("F4"),
    expects: (page) => expect(page.getByRole("textbox", { name: /Quantity of/ })).toBeFocused(),
  },
];

for (const state of states) {
  test(`sale screen state ${state.name} is complete and accessible at the till size`, async ({
    page,
  }, testInfo) => {
    await openSale(page, state.name === "editing" ? "lines" : state.name);
    await state.setup?.(page);
    await state.expects(page);
    await expectNoSeriousAxe(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      1366,
    );
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      768,
    );
    const path = shots ? `${shots}/${state.name}.png` : testInfo.outputPath(`${state.name}.png`);
    if (shots) mkdirSync(shots, { recursive: true });
    await page.screenshot({ path });
  });
}

test("every control on the sale screen is at least 44px", async ({ page }) => {
  await openSale(page, "lines");
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, input, [role=combobox]")]
      .filter((node) => node.getClientRects().length > 0)
      .map((node) => ({
        label: node.getAttribute("aria-label") ?? node.textContent,
        box: node.getBoundingClientRect(),
      }))
      .filter(({ box }) => box.height < 44 || box.width < 44)
      .map(({ label, box }) => `${label}: ${box.width}x${box.height}`),
  );
  expect(small).toEqual([]);
});
