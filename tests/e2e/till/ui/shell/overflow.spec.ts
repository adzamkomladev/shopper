import { expect, test, type Page } from "@playwright/test";

// The till PCs: XGA, 720p, the common laptop, full HD, and 1366x768 / 1920x1080 at Windows' 125% zoom.
const sizes = [
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "1366x768 at 125%", width: 1093, height: 614 },
  { name: "1920x1080 at 125%", width: 1536, height: 864 },
];
const screens = [
  { key: "Control+1", name: "Dashboard" },
  { key: "Control+2", name: "Checkout" },
  { key: "Control+3", name: "Inventory" },
  { key: "Control+4", name: "Sales reports" },
  { key: "Alt+P", name: "Previous purchases" },
  { key: "Alt+H", name: "Shift" },
  { key: "Alt+T", name: "Register settings" },
];

/** Neither the page nor any region of the shell may clip: what does not fit scrolls inside its own area. */
async function expectNoClipping(page: Page) {
  const problems = await page.evaluate(() => {
    const root = document.documentElement;
    const page = [root.scrollWidth > innerWidth && "page scrolls sideways"];
    const clipped = [...document.querySelectorAll<HTMLElement>("main, nav, header, section")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          style.overflowY === "hidden" &&
          element.scrollHeight > element.clientHeight + 1 &&
          element.clientHeight > 0
        );
      })
      .map(
        (element) =>
          `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") ?? ""} clips`,
      );
    return [...page, root.scrollHeight > innerHeight + 1 && "page scrolls down", ...clipped].filter(
      Boolean,
    );
  });
  expect(problems).toEqual([]);
}

for (const size of sizes) {
  test(`at ${size.name} no till screen clips or scrolls the page`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/harness/index.html?scenario=lines");
    const sidebar = page.getByRole("navigation", { name: "Register" });
    await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
    for (const screen of screens) {
      await page.getByRole("banner").click();
      await page.keyboard.press(screen.key);
      await expect(sidebar.locator('[aria-current="page"]')).toHaveAccessibleName(screen.name);
      await expectNoClipping(page);
    }
  });
}
