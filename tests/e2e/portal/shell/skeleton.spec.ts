import { expect, test, type Page } from "@playwright/test";

// Runs on the saved owner session. The API is held so the shell's pending skeleton shows, then
// released: the skeleton's header must sit exactly where the loaded header lands.
const cases = [
  { name: "1440 open", width: 1440, height: 900, open: "true" },
  { name: "1440 rail", width: 1440, height: 900, open: "false" },
  { name: "1366 rail", width: 1366, height: 768, open: "false" },
  { name: "390", width: 390, height: 844, open: "true" },
];

const box = async (page: Page, selector: string) => {
  const rect = (await page.locator(selector).first().boundingBox())!;
  return { x: Math.round(rect.x), y: Math.round(rect.y), height: Math.round(rect.height) };
};

for (const size of cases) {
  test(`at ${size.name} the shell skeleton's header is where the header lands`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.addInitScript(
      (open) => localStorage.setItem("shopper.sidebar.portal", open),
      size.open,
    );
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/**", async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/stock");
    // The shell skeleton holds the page skeleton: the outer one is the shell.
    const skeleton = page.getByRole("status", { name: "Loading" }).first();
    await expect(skeleton).toBeVisible();
    const pending = await box(page, '[role="status"][aria-label="Loading"] > div:last-child > div');
    release();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    const loaded = await box(page, "header");
    expect(Math.abs(pending.x - loaded.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(pending.y - loaded.y)).toBeLessThanOrEqual(2);
    expect(Math.abs(pending.height - loaded.height)).toBeLessThanOrEqual(2);
  });
}
