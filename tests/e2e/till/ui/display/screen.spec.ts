// The customer display against fixture data (apps/till/ui/harness/display.tsx): every state, long names,
// a long basket, no overflow and no serious axe issue at the display sizes.
import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { expectNoSeriousAxe } from "../../../../support/e2e";

// Set SHOPPER_SCREENSHOTS_DIR to keep the shots (docs/plans/day13/screenshots).
const shots = process.env.SHOPPER_SCREENSHOTS_DIR;
const sizes = [
  { name: "1920", width: 1920, height: 1080 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1024", width: 1024, height: 768 },
  { name: "800", width: 800, height: 480 },
];

async function open(page: Page, scenario: string, size = sizes[0]!) {
  const errors: string[] = [];
  page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
  await page.setViewportSize(size);
  await page.goto(`/harness/display.html?scenario=${scenario}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  return errors;
}

const noOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth <= window.innerWidth &&
      document.documentElement.scrollHeight <= window.innerHeight,
  );

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  const path = shots ? `${shots}/display-${name}.png` : testInfo.outputPath(`${name}.png`);
  if (shots) mkdirSync(shots, { recursive: true });
  await page.screenshot({ path });
}

test("idle welcomes the customer to the store", async ({ page }) => {
  await open(page, "idle");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome toAccra Central");
  await expectNoSeriousAxe(page);
});

test("the basket shows quantity, name and amount per line, the total and the item count", async ({
  page,
}) => {
  await open(page, "lines");
  const lines = page.getByRole("list", { name: "Basket lines" }).getByRole("listitem");
  await expect(lines).toHaveCount(5);
  await expect(lines.nth(1)).toContainText("6×");
  await expect(lines.nth(1)).toContainText("Voltic natural water 1.5L");
  await expect(lines.nth(2)).toContainText("0.5×");
  await expect(lines.nth(0)).toContainText("GH₵ 54.50");
  await expect(lines.last()).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("region", { name: "Total" })).toContainText("5 items");
  await expect(page.getByRole("region", { name: "Total" })).toContainText("GH₵");
  await expectNoSeriousAxe(page);
});

test("long names truncate and keep the amount visible", async ({ page }) => {
  await open(page, "long");
  const name = page.getByText("Fan Milk Vanilla ice cream family tub");
  const amount = page.getByRole("listitem").last().locator("span").last();
  expect(await name.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(amount).toBeInViewport({ ratio: 1 });
  expect(await noOverflow(page)).toBe(true);
});

test("the newest line stays visible in a long basket", async ({ page }) => {
  await open(page, "many");
  const last = page.getByRole("list", { name: "Basket lines" }).getByRole("listitem").last();
  await expect(last).toContainText("(16)");
  await expect(last).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("region", { name: "Total" })).toContainText("16 items");
  expect(await noOverflow(page)).toBe(true);
});

test("a paid sale shows what was paid and the change due", async ({ page }) => {
  await open(page, "paid");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Thank you");
  await expect(page.getByText("Paid", { exact: true }).locator("..")).toContainText("GH₵ 69.46");
  await expect(page.getByText("Change due").locator("..")).toContainText("GH₵ 9.46");
  await expectNoSeriousAxe(page);
});

test("an exact payment shows no change card", async ({ page }) => {
  await open(page, "exact");
  await expect(page.getByText("Change due")).toHaveCount(0);
  await expect(page.getByText("GH₵ 60.00")).toBeVisible();
});

test("a lost host shows the register closed", async ({ page }) => {
  await open(page, "closed");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Register closed");
  await expect(page.getByText("Please use another register.")).toContainText("Accra Central");
  await expectNoSeriousAxe(page);
});

for (const size of sizes)
  for (const scenario of ["idle", "lines", "many", "paid", "closed"])
    test(`${scenario} fits ${size.name} without overflow or console errors`, async ({
      page,
    }, testInfo) => {
      const errors = await open(page, scenario, size);
      expect(await noOverflow(page)).toBe(true);
      await shoot(page, testInfo, `${scenario}-${size.name}`);
      expect(errors).toEqual([]);
    });
