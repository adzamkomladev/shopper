// The enrol screen says where the till will enrol. On a shop network that blocks shopper.local, the cashier types
// the box's address (Alt+S); a wrong one is refused with why, the right one restarts the register on the box.
import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";
import { BOX_ADDRESS, startEnrolScenario } from "../../../../support/till/enrol/scenario";

const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const sizes = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [768, 1024],
  [390, 844],
] as const;
let scenario: Awaited<ReturnType<typeof startEnrolScenario>> | undefined;
test.afterEach(async () => scenario?.stop());

async function open(page: Page, baseURL: string | undefined, box = false) {
  if (!baseURL) throw new Error("Playwright baseURL is required");
  scenario = await startEnrolScenario(new URL(baseURL).origin, { box });
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(scenario.url);
  await expect(page.getByRole("heading", { name: "Set up this till" })).toBeVisible();
}

async function shoot(page: Page, name: string) {
  if (!shots) return;
  mkdirSync(shots, { recursive: true });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow, `${name} overflows at ${width}px`).toBe(false);
    await page.screenshot({ path: `${shots}/till-enrol-${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

test("a typed box address is checked by the register, refused with why or used", async ({
  page,
  baseURL,
}) => {
  await open(page, baseURL);
  await expect(page.getByText("Shopper cloud")).toBeVisible();
  await shoot(page, "server-cloud");

  await page.keyboard.press("Alt+S");
  const address = page.getByLabel("Box address");
  await expect(address).toBeFocused();
  await expectNoSeriousAxe(page);
  await page.keyboard.press("Enter");
  await expect(page.getByText("Type the box's address, like 192.168.1.20")).toBeVisible();

  await address.fill("10.0.0.9");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Nothing answered at 10.0.0.9")).toBeVisible();
  await expect(address).toHaveAttribute("aria-invalid", "true");
  await shoot(page, "server-refused");

  // Escape goes back to where the till enrols now; the enrol form is untouched.
  await page.keyboard.press("Escape");
  await expect(page.getByText("Shopper cloud")).toBeVisible();
  await expect(page.getByLabel("Box address")).toHaveCount(0);

  await page.getByRole("button", { name: /Change server/ }).click();
  await page.getByLabel("Box address").fill(BOX_ADDRESS);
  await page.keyboard.press("Enter");
  await expect(page.getByText(`Restarting on ${BOX_ADDRESS}…`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Restarting…" })).toBeDisabled();
  await shoot(page, "server-restarting");
});

test("a till that found the box on its network says so", async ({ page, baseURL }) => {
  await open(page, baseURL, true);
  await expect(page.getByText("Shopper box on this network")).toBeVisible();
  await expectNoSeriousAxe(page);
  await shoot(page, "server-box");
});
