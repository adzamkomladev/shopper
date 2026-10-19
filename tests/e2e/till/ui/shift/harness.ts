import { mkdirSync } from "node:fs";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { calls, openSale } from "../sale/harness";

// Set SHOPPER_SCREENSHOTS_DIR to keep the shots (docs/plans/day15/screenshots/till).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;

export const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1366", width: 1366, height: 768 },
  { name: "768", width: 768, height: 1024 },
  { name: "390", width: 390, height: 844 },
] as const;

/** The shift screens are rendered with fixture data by apps/till/ui/harness; the scenario picks the register's shift. */
export const open = (page: Page, scenario: string, query = "") =>
  page.goto(`/harness/index.html?scenario=${scenario}${query}`);

/** The shell, then the Shift screen with Alt+H. */
export async function openShiftScreen(page: Page, scenario = "shift-open", query = "") {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, scenario, query);
  await page.getByRole("tablist", { name: "Register sections" }).waitFor();
  await page.keyboard.press("Alt+H");
  await expect(page.getByRole("heading", { name: "Shift", exact: true })).toBeVisible();
}

/** The Checkout tab of a register that may not sell yet. */
export async function openBlockedSale(page: Page, scenario: string) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, scenario);
  await expect(page.getByRole("heading", { name: "Register closed", exact: true })).toBeVisible();
}

export { calls, openSale };
export const dialog = (page: Page, name: string) => page.getByRole("dialog", { name });
export const toast = (page: Page) => page.locator("[data-sonner-toast]");
export const shiftCalls = async (page: Page, type: string) =>
  (await calls(page, type)).map((call) => call.args);

/** Types `text` into a labelled field and moves on, as a cashier would. */
export const fill = (field: Locator, text: string) => field.fill(text);

export const count = (page: Page, face: string) =>
  page.getByRole("textbox", { name: `Count of GH₵ ${face}`, exact: true });

/** Counts the drawer as exactly GH₵ 240.00: one GH₵ 200 note and two GH₵ 20 notes. */
export async function countBalanced(page: Page) {
  await count(page, "200").fill("1");
  await count(page, "20").fill("2");
}

export async function expectFits(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
}

export async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const path = shots ? `${shots}/${name}.png` : testInfo.outputPath(`${name}.png`);
  if (shots) mkdirSync(shots, { recursive: true });
  await page.screenshot({ path, fullPage: false });
}

/** The blind close of the Shift screen, from its first step. */
export const flow = (page: Page) => page.getByRole("region", { name: "Close shift" });
export const step = (page: Page, name: string) =>
  flow(page).getByRole("list", { name: "Steps" }).getByRole("listitem", { name });
export const card = (page: Page) =>
  page.getByRole("textbox", { name: "Card terminal total (GH₵)" });
export const momo = (page: Page) =>
  page.getByRole("textbox", { name: "MoMo terminal total (GH₵)" });
export const variances = (page: Page) => page.getByRole("table", { name: "Variance by tender" });

export async function startClose(page: Page, scenario = "shift-open") {
  await openShiftScreen(page, scenario);
  await page.keyboard.press("Alt+Z");
  await expect(flow(page)).toBeVisible();
}

export async function submitTotals(page: Page, cash: () => Promise<void>, totals = ["30", "12"]) {
  await cash();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(card(page)).toBeFocused();
  await card(page).fill(totals[0]!);
  await momo(page).fill(totals[1]!);
  await page.keyboard.press("ControlOrMeta+Enter");
}

/** Chooses the first manager with the keyboard and types their PIN, ready to submit. */
export async function approve(page: Page, pin: string) {
  const manager = page.getByRole("combobox", { name: "Manager" });
  await manager.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(manager).toContainText("Kofi Mensah");
  await page.keyboard.press("Tab");
  await page.keyboard.type(pin);
}
