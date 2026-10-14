import { expect, test, type Page } from "@playwright/test";
import { calls, openSale } from "./sale/harness";

// KeyboardEvent.timeStamp drives the scan detector, so every key is stamped from a test clock. The
// keys are real Playwright key presses; only the clock the page reads is controlled.
const barcode = "5012345678900";
let clock = 0;

test.beforeEach(async ({ page }) => {
  clock = 1_000;
  await page.addInitScript(() => {
    let now: number | null = null;
    const real = Object.getOwnPropertyDescriptor(Event.prototype, "timeStamp")!;
    Object.defineProperty(Event.prototype, "timeStamp", {
      get() {
        return now ?? real.get!.call(this);
      },
    });
    (window as unknown as { setClock: (value: number) => void }).setClock = (value) =>
      (now = value);
  });
  await openSale(page, "lines");
  await expect(page.getByRole("combobox")).toBeFocused();
});

async function press(page: Page, key: string, gap: number) {
  clock += gap;
  await page.evaluate(
    (value) => (window as unknown as { setClock: (v: number) => void }).setClock(value),
    clock,
  );
  await page.keyboard.press(key);
}

/** Types each character `gap` ms after the last key, then Enter `enterGap` ms after the last character. */
async function burst(page: Page, text: string, gap: number, enterGap = gap) {
  for (const char of text) await press(page, char, gap);
  await press(page, "Enter", enterGap);
}

const adds = (page: Page) => calls(page, "add");
const searches = async (page: Page) =>
  (await calls(page, "search")).map((call) => call.args[0]).filter((query) => query !== "");
const field = (page: Page) => page.getByRole("combobox");

test("a burst with every gap at 59 ms, including Enter, is a scan", async ({ page }) => {
  await burst(page, barcode, 59);
  expect(await adds(page)).toEqual([{ type: "add", args: [{ code: barcode }] }]);
  await expect(field(page)).toHaveValue("");
  await page.waitForTimeout(150);
  expect(await searches(page)).toEqual([]);
});

test("a 60 ms gap is typing, not a scan, and the text is searched", async ({ page }) => {
  await burst(page, barcode, 60);
  expect(await adds(page)).toEqual([]);
  await expect(field(page)).toHaveValue(barcode);
  await expect.poll(() => searches(page)).toEqual([barcode]);
});

test("a slow terminating Enter after a fast burst is not a scan", async ({ page }) => {
  await burst(page, barcode, 10, 61);
  expect(await adds(page)).toEqual([]);
  await expect(field(page)).toHaveValue(barcode);
});

test("one slow keystroke in the middle makes the whole entry typing", async ({ page }) => {
  for (const char of barcode.slice(0, 6)) await press(page, char, 10);
  for (const char of barcode.slice(6)) await press(page, char, char === barcode[6] ? 61 : 10);
  await press(page, "Enter", 10);
  expect(await adds(page)).toEqual([]);
});

test("a slow search never adds on its own and searches the typed text", async ({ page }) => {
  for (const char of "milo") await press(page, char, 200);
  await expect.poll(() => searches(page)).toContain("milo");
  expect(await adds(page)).toEqual([]);
});

test("one fast key and Enter is a double tap, not a scan", async ({ page }) => {
  await burst(page, "5", 10);
  expect(await adds(page)).toEqual([]);
});

test("Shift for capitals does not break a burst", async ({ page }) => {
  await press(page, "Shift+KeyA", 10);
  await press(page, "Shift+KeyB", 10);
  await press(page, "1", 10);
  await press(page, "2", 10);
  await press(page, "Enter", 10);
  expect(await adds(page)).toEqual([{ type: "add", args: [{ code: "AB12" }] }]);
});

test("a Ctrl chord inside the field is ignored by the detector", async ({ page }) => {
  for (const char of "5012") await press(page, char, 10);
  await press(page, "Control+KeyA", 10);
  await press(page, "Enter", 10);
  // The chord neither counts as a character nor breaks the burst: the four characters still cover the field.
  expect(await adds(page)).toEqual([{ type: "add", args: [{ code: "5012" }] }]);
});

test("a paste never counts as a scan", async ({ page }) => {
  await press(page, "5", 10);
  await press(page, "0", 10);
  await page.getByRole("combobox").evaluate((input) => {
    input.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: new DataTransfer() }),
    );
  });
  await page.getByRole("combobox").pressSequentially("12");
  await press(page, "Enter", 10);
  expect(await adds(page)).toEqual([]);
  await page.getByRole("combobox").fill(barcode);
  await press(page, "Enter", 10);
  expect(await adds(page)).toEqual([]);
});

test("IME composition keys are ignored, including the Enter that confirms them", async ({
  page,
}) => {
  await page.getByRole("combobox").fill("あい");
  await page.getByRole("combobox").evaluate((input) => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Process", isComposing: true, bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  expect(await adds(page)).toEqual([]);
  await expect(field(page)).toHaveValue("あい");
});

test("back to back scans each add their own code", async ({ page }) => {
  await burst(page, barcode, 20);
  await burst(page, "5012345678917", 20);
  await burst(page, "6161100491234", 20);
  expect((await adds(page)).map((call) => call.args)).toEqual([
    [{ code: barcode }],
    [{ code: "5012345678917" }],
    [{ code: "6161100491234" }],
  ]);
  await expect(field(page)).toHaveValue("");
});

test("only the main scan field scans: the quantity field applies a fast entry as a quantity", async ({
  page,
}) => {
  await page.keyboard.press("F4");
  const quantity = page.getByRole("textbox", { name: /Quantity of/ });
  await expect(quantity).toBeFocused();
  await press(page, "Control+KeyA", 10);
  await burst(page, "300", 10);
  expect(await adds(page)).toEqual([]);
  expect((await calls(page, "setQuantity")).map((call) => call.args[1])).toEqual([300_000]);
});
