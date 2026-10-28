// A till fresh from the installer enrols itself: by typing the shop code and the code, or by scanning the QR the
// portal shows (a keyboard-wedge scanner types it), then moves on to sign-in.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { GOOD_CODE, SHOP, startEnrolScenario } from "../../../../support/till/enrol/scenario";

const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
let scenario: Awaited<ReturnType<typeof startEnrolScenario>> | undefined;

test.beforeEach(async ({ baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  scenario = await startEnrolScenario(new URL(baseURL).origin);
});
test.afterEach(async () => scenario?.stop());

const shopCode = (page: Page) => page.getByLabel("Shop code");
const code = (page: Page) => page.getByLabel("Enrolment code");
const name = (page: Page) => page.getByLabel("Till name");

async function open(page: Page, width = 1366, height = 768) {
  await page.setViewportSize({ width, height });
  await page.goto(scenario!.url);
  await expect(page.getByRole("heading", { name: "Set up this till" })).toBeVisible();
  await expect(shopCode(page)).toBeFocused();
}

test("each refusal says what to do, and a good code moves on to sign-in", async ({ page }) => {
  await open(page);
  await expectNoSeriousAxe(page);
  if (shots) {
    mkdirSync(shots, { recursive: true });
    for (const [width, height] of [
      [1366, 768],
      [1920, 1080],
      [768, 1024],
      [390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `${shots}/till-enrol-${width}.png` });
    }
    await page.setViewportSize({ width: 1366, height: 768 });
  }

  // Missing fields are named where they are.
  await page.keyboard.press("Enter");
  await expect(page.getByText("Enter the shop code from the portal")).toBeVisible();
  await expect(shopCode(page)).toBeFocused();

  await shopCode(page).fill("no-such-shop");
  await code(page).fill("123456");
  await page.keyboard.press("Enter");
  await expect(page.getByText("No shop has that code")).toBeVisible();

  await shopCode(page).fill(SHOP.slug);
  await code(page).fill("111111");
  await page.keyboard.press("Enter");
  await expect(page.getByText("That code didn't work")).toBeVisible();
  await expect(code(page)).toBeFocused();
  await expect(code(page)).toHaveValue("");

  scenario!.state.mode = "locked";
  await code(page).fill("222222");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Too many tries")).toBeVisible();

  scenario!.state.mode = "down";
  await code(page).fill("333333");
  await page.keyboard.press("Enter");
  await expect(page.getByText("The server did not answer")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/till-enrol-error-1366.png` });

  scenario!.state.mode = "ok";
  // Typed as the portal shows it, with the space.
  await code(page).fill(`${GOOD_CODE.slice(0, 3)} ${GOOD_CODE.slice(3)}`);
  await name(page).fill("Front till");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Front till is set up for Kumasi Mart")).toBeVisible();
  // The host restarts as an enrolled till on the same bridge; the page reconnects and shows sign-in.
  await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible({ timeout: 30_000 });
});

test("a scanned enrolment QR fills the screen and submits it", async ({ page }) => {
  await open(page, 390, 844);
  // A refusal leaves focus on the code field; a scan typed there must not be cut to six characters.
  await code(page).focus();
  await page.keyboard.type(`shopper:enrol?shop=${SHOP.slug}&code=${GOOD_CODE}`);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Username" })).toBeVisible({ timeout: 30_000 });
  expect(scenario!.state.enrolled).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
