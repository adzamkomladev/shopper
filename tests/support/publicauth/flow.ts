import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe, waitForAuthSlot } from "../e2e";
import { emailedLink } from "./mail";
import { unique } from "./shop";
import { waitForPublicSlot } from "./slots";

export const NEW_PASSWORD = "a-long-new-password-1";

export function newRegistration() {
  const tag = unique();
  return {
    name: "Kofi Mensah",
    email: `kofi-${tag}@shop.example.com`,
    shopName: `Kofi Mart ${tag}`,
    shopCode: `kofi-${tag}`,
  };
}
export type Registration = ReturnType<typeof newRegistration>;

/** Opens /signup, fills the form and submits it, ending on the check-email screen. */
export async function submitSignup(page: Page, data: Registration) {
  await page.goto("/signup");
  await expect(page.getByLabel("Your name")).toBeFocused();
  await page.getByLabel("Your name").fill(data.name);
  await page.getByLabel("Email").fill(data.email);
  await page.getByLabel("Shop name").fill(data.shopName);
  await page.getByLabel("Shop code").fill(data.shopCode);
  await waitForPublicSlot();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
}

/** Opens the emailed link and presses Verify email, ending on the password step. */
export async function verifyFromEmail(page: Page, request: APIRequestContext, data: Registration) {
  const link = await emailedLink(request, data.email);
  await page.goto(`${link.pathname}${link.search}`);
  await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
  await waitForPublicSlot();
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page.getByRole("heading", { name: "Set up your shop" })).toBeVisible();
  return link;
}

export async function submitPassword(page: Page, password = NEW_PASSWORD) {
  await page.getByLabel("Password").fill(password);
  await waitForPublicSlot();
  await waitForAuthSlot();
  await page.getByRole("button", { name: "Create shop" }).click();
}

export const SIZES = [
  [1366, 768],
  [1440, 900],
  [390, 844],
] as const;

/** Screenshots the screen at till, desktop and phone sizes, attaches them and saves them for review. */
export async function shoot(page: Page, info: TestInfo, name: string) {
  for (const [width, height] of SIZES) {
    await page.setViewportSize({ width, height });
    const path = info.outputPath(`${name}-${width}x${height}.png`);
    await page.evaluate(() => document.fonts.ready);
    await expectNoSeriousAxe(page);
    await page.screenshot({ path, fullPage: true, animations: "disabled" });
    await info.attach(`${name}-${width}x${height}`, { path, contentType: "image/png" });
  }
}

/** Everything the page writes to its console, and its uncaught errors, as plain text. */
export function collectConsole(page: Page) {
  const lines: string[] = [];
  page.on("console", (message) => lines.push(message.text()));
  page.on("pageerror", (error) => lines.push(error.message));
  return lines;
}

export async function navigateWithinApp(page: Page, url: string) {
  await page.evaluate((next) => {
    history.pushState({}, "", next);
    dispatchEvent(new PopStateEvent("popstate"));
  }, url);
}
