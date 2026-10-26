import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { e2eRun } from "../../tooling/e2e/run";

/** Fails on serious or critical axe violations and names each rule and target. */
export async function expectNoSeriousAxe(page: Page) {
  // Popovers fade in; contrast measured mid-fade is a false failure.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.effect?.getTiming().iterations === Infinity ||
          animation.playState !== "running",
      ),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target).join(" | ")}`,
    );
  expect(serious).toEqual([]);
}

export const BOX_API = process.env.E2E_BOX_URL ?? e2eRun.url(3101);
export const PORTAL_ORIGIN = process.env.E2E_PORTAL_URL ?? e2eRun.url(5183);
export const BOOTSTRAP_TOKEN = "e2e-only-bootstrap-token";
export const OWNER_PASSWORD = "e2e-owner-password-123";
export const OWNER_NAME = "E2E Owner";
export const BRANCH_NAME = "Accra Central";

export type Shop = { code: string; name: string; email: string };
export const MART: Shop = { code: "e2e-mart", name: "E2E Mart", email: "owner@mart.e2e.example" };
export const ANNEX: Shop = {
  code: "e2e-annex",
  name: "E2E Annex",
  email: "owner@annex.e2e.example",
};

// Better Auth lets one IP make 3 sign-in or sign-up requests, counted in a chain that only restarts
// after a 10s gap, and through the dev proxy every browser shares one IP. Wait for a fresh window
// instead of letting a 4th request be refused. Playwright starts a worker per project, so the
// count lives in a file.
const AUTH_LIMIT = 3;
// The request leaves the browser a little after this is called, so the window gets some slack.
const AUTH_WINDOW_MS = 10_000 + 3_000;
const AUTH_COUNT_FILE = e2eRun.path(
  "tests/e2e/.auth/auth-requests.json",
  "auth/auth-requests.json",
);

/** Call right before every request that signs in or up. */
export async function waitForAuthSlot() {
  const { count, last } = existsSync(AUTH_COUNT_FILE)
    ? (JSON.parse(readFileSync(AUTH_COUNT_FILE, "utf8")) as { count: number; last: number })
    : { count: 0, last: 0 };
  const wait = last + AUTH_WINDOW_MS - Date.now();
  if (count >= AUTH_LIMIT && wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const chained = Date.now() - last < AUTH_WINDOW_MS;
  mkdirSync(dirname(AUTH_COUNT_FILE), { recursive: true });
  writeFileSync(
    AUTH_COUNT_FILE,
    JSON.stringify({ count: chained ? count + 1 : 1, last: Date.now() }),
  );
}

/** Types shop code, email and password with the keyboard alone, then presses Enter on the form. */
export async function typeCredentials(page: Page, shop: Shop, password = OWNER_PASSWORD) {
  await page.goto("/login");
  await expect(page.getByLabel("Shop code")).toBeFocused();
  for (const [index, value] of [shop.code, shop.email, password].entries()) {
    if (index) await page.keyboard.press("Tab");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type(value);
  }
  await waitForAuthSlot();
  await page.keyboard.press("Enter");
}

/** Full keyboard sign-in: credentials, Enter, then Enter on the success card's Continue. */
export async function signInWithKeyboard(page: Page, shop: Shop, password = OWNER_PASSWORD) {
  await typeCredentials(page, shop, password);
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/products$/);
}
